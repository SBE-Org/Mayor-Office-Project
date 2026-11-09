import { z } from "zod";
import { prisma, type Tx } from "@/server/db";
import { can, caseWhere, requirePerm, type Actor } from "@/server/access";
import { AppError, ForbiddenError, NotFoundError } from "@/server/errors";
import { caseRef } from "@/server/refno";
import { audit } from "@/server/audit";
import { saveFile } from "@/server/storage";
import { notifyCitizen, notifyRole, notifyUsers } from "@/server/services/notifications";
import { CASE_CHANNELS, CASE_TYPES, CONFIDENTIALITY, DECISION_TYPES, PRIORITIES, RESPONSE_TYPES, type CaseStatus } from "@/shared/constants";

type Upload = { name: string; buf: Buffer };

const optDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : undefined))
  .refine((d) => !d || !isNaN(d.getTime()), "Invalid date");

export const citizenInfoSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  phone: z.string().trim().regex(/^\+?[0-9 ]{9,15}$/, "Enter a valid phone number"),
  email: z.string().trim().email().optional().or(z.literal("").transform(() => undefined)),
  subCityId: z.string().optional().transform((v) => v || undefined),
  woreda: z.string().trim().max(60).optional(),
  kebele: z.string().trim().max(60).optional(),
});

export const submitCaseSchema = z.object({
  type: z.enum(CASE_TYPES),
  categoryId: z.string().min(1, "Choose a category"),
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(20, "Please describe the matter in at least 20 characters").max(10000),
  subCityId: z.string().optional().transform((v) => v || undefined),
  channel: z.enum(CASE_CHANNELS).optional(),
  priority: z.enum(PRIORITIES).optional(),
  confidentiality: z.enum(CONFIDENTIALITY).optional(),
});

async function log(
  tx: Tx,
  caseId: string,
  actor: Actor | null,
  action: string,
  opts: { from?: string; to?: string; note?: string; isPublic?: boolean } = {},
) {
  await tx.caseAction.create({
    data: {
      caseId,
      actorId: actor?.id ?? null,
      actorName: actor ? `${actor.fullName} (${actor.roleName})` : null,
      action,
      fromStatus: opts.from ?? null,
      toStatus: opts.to ?? null,
      note: opts.note ?? null,
      isPublic: opts.isPublic ?? false,
    },
  });
}

async function attach(tx: Tx, caseId: string, actor: Actor, files: Upload[]) {
  for (const f of files) {
    const s = await saveFile(f.name, f.buf);
    await tx.document.create({ data: { ...s, caseId, uploadedById: actor.id } });
  }
}

async function findCitizenOrCreate(tx: Tx, actor: Actor, info: z.infer<typeof citizenInfoSchema>) {
  const existing = await tx.citizen.findFirst({ where: { phone: info.phone, fullName: info.fullName } });
  if (existing) return existing;
  return tx.citizen.create({ data: { ...info, registeredById: actor.id } });
}

/** Online submission by a citizen, or walk-in / offline registration by office staff. */
export async function submitCase(actor: Actor, raw: unknown, files: Upload[] = [], citizenRaw?: unknown) {
  const input = submitCaseSchema.parse(raw);
  const isStaff = !can(actor, "portal.citizen");
  if (isStaff) requirePerm(actor, "case.register");
  else if (!actor.citizenId) throw new ForbiddenError();

  const category = await prisma.caseCategory.findFirst({ where: { id: input.categoryId, isActive: true } });
  if (!category) throw new AppError("Unknown case category.");

  const created = await prisma.$transaction(async (tx) => {
    const citizenId = isStaff
      ? (await findCitizenOrCreate(tx, actor, citizenInfoSchema.parse(citizenRaw))).id
      : actor.citizenId!;
    const status: CaseStatus = isStaff ? "REGISTERED" : "SUBMITTED";
    const c = await tx.case.create({
      data: {
        referenceNo: await caseRef(tx),
        citizenId,
        type: input.type,
        title: input.title,
        description: input.description,
        categoryId: input.categoryId,
        subCityId: input.subCityId,
        channel: isStaff ? input.channel ?? "WALK_IN" : "ONLINE",
        // citizens may flag a matter as confidential; only reviewers can set STRICT
        priority: isStaff ? input.priority ?? "NORMAL" : "NORMAL",
        confidentiality: isStaff ? input.confidentiality ?? "NORMAL" : input.confidentiality === "CONFIDENTIAL" ? "CONFIDENTIAL" : "NORMAL",
        status,
        registeredById: isStaff ? actor.id : null,
        verifiedAt: isStaff ? new Date() : null,
      },
    });
    await attach(tx, c.id, actor, files);
    await log(tx, c.id, actor, isStaff ? "Registered at the Mayor's Office" : "Submitted online", {
      to: status,
      isPublic: true,
      note: `Reference number ${c.referenceNo}`,
    });
    await audit(tx, actor.id, "CASE_CREATE", "Case", c.id, { referenceNo: c.referenceNo, channel: c.channel });
    await notifyCitizen(tx, citizenId, {
      title: `Case ${c.referenceNo} received`,
      body: `Your submission "${c.title}" has been received. Use the reference number to track progress.`,
      link: `/portal/cases/${c.id}`,
    });
    await notifyRole(tx, "case.review", { title: `New case ${c.referenceNo}`, body: c.title, link: `/staff/cases/${c.id}` });
    return c;
  });
  return created;
}

export async function listCases(
  actor: Actor,
  f: { q?: string; status?: string; categoryId?: string; departmentId?: string; priority?: string; overdue?: boolean; take?: number } = {},
) {
  const and: object[] = [caseWhere(actor)];
  if (f.q) and.push({ OR: [{ referenceNo: { contains: f.q } }, { title: { contains: f.q } }, { citizen: { fullName: { contains: f.q } } }] });
  if (f.status) and.push({ status: f.status });
  if (f.categoryId) and.push({ categoryId: f.categoryId });
  if (f.departmentId) and.push({ departmentId: f.departmentId });
  if (f.priority) and.push({ priority: f.priority });
  if (f.overdue) and.push({ deadline: { lt: new Date() }, status: { notIn: ["CLOSED", "RESPONDED"] } });
  return prisma.case.findMany({
    where: { AND: and },
    include: { citizen: true, category: true, department: true, executive: true },
    orderBy: { createdAt: "desc" },
    take: f.take ?? 200,
  });
}

export async function getCase(actor: Actor, id: string) {
  const isCitizen = can(actor, "portal.citizen");
  const c = await prisma.case.findFirst({
    where: { AND: [{ id }, caseWhere(actor)] },
    include: {
      citizen: { include: { subCity: true } },
      category: true,
      subCity: true,
      department: true,
      assignedOfficer: true,
      deptOfficer: true,
      executive: true,
      documents: { orderBy: { createdAt: "asc" } },
      actions: { where: isCitizen ? { isPublic: true } : {}, orderBy: { createdAt: "asc" } },
      forwardings: { include: { fromUser: true, toUser: true }, orderBy: { createdAt: "asc" } },
      decisions: { include: { executive: true, delegatedTo: true }, orderBy: { createdAt: "asc" } },
      responses: { include: { department: true }, orderBy: { createdAt: "asc" } },
      assignments: { include: { department: true }, orderBy: { createdAt: "asc" } },
      feedback: true,
    },
  });
  if (!c) throw new NotFoundError();
  if (isCitizen) {
    // Citizens see their own submission and public progress only.
    return { ...c, forwardings: [], decisions: [], responses: [], assessment: null, recommendation: null, assignedOfficer: null, deptOfficer: null, executive: null };
  }
  return c;
}

async function loadForAction(tx: Tx, actor: Actor, id: string, allowed?: CaseStatus[]) {
  const c = await tx.case.findFirst({ where: { AND: [{ id }, caseWhere(actor)] } });
  if (!c) throw new NotFoundError();
  if (allowed && !allowed.includes(c.status as CaseStatus)) {
    throw new AppError(`This action is not available while the case is "${c.status.replace(/_/g, " ").toLowerCase()}".`);
  }
  return c;
}

export async function verifyCase(actor: Actor, id: string) {
  requirePerm(actor, "case.register");
  return prisma.$transaction(async (tx) => {
    const c = await loadForAction(tx, actor, id, ["SUBMITTED"]);
    await tx.case.update({ where: { id }, data: { status: "REGISTERED", verifiedAt: new Date(), registeredById: c.registeredById ?? actor.id } });
    await log(tx, id, actor, "Verified and registered", { from: c.status, to: "REGISTERED", isPublic: true });
    await audit(tx, actor.id, "CASE_VERIFY", "Case", id);
  });
}

export const reviewSchema = z.object({
  categoryId: z.string().min(1),
  priority: z.enum(PRIORITIES),
  confidentiality: z.enum(CONFIDENTIALITY),
  handling: z.enum(["ADMINISTRATIVE", "DEPARTMENT", "EXECUTIVE"]),
  assessment: z.string().trim().min(5).max(5000),
  recommendation: z.string().trim().max(5000).optional(),
  subCityId: z.string().optional().transform((v) => v || undefined),
});

export async function reviewCase(actor: Actor, id: string, raw: unknown) {
  requirePerm(actor, "case.review");
  const input = reviewSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const c = await loadForAction(tx, actor, id, ["SUBMITTED", "REGISTERED", "UNDER_REVIEW", "DECIDED"]);
    await tx.case.update({
      where: { id },
      data: { ...input, status: "UNDER_REVIEW", assignedOfficerId: c.assignedOfficerId ?? actor.id, verifiedAt: c.verifiedAt ?? new Date() },
    });
    const changes = [
      c.priority !== input.priority && `priority ${c.priority} → ${input.priority}`,
      c.confidentiality !== input.confidentiality && `confidentiality ${c.confidentiality} → ${input.confidentiality}`,
      c.categoryId !== input.categoryId && "category changed",
    ].filter(Boolean);
    await log(tx, id, actor, "Reviewed and assessed", {
      from: c.status,
      to: "UNDER_REVIEW",
      note: `Handling: ${input.handling}. ${changes.join(", ")}`.trim(),
    });
    if (c.status !== "UNDER_REVIEW") await log(tx, id, null, "Case is under review", { isPublic: true });
    await audit(tx, actor.id, "CASE_REVIEW", "Case", id, input);
  });
}

export async function requestInfo(actor: Actor, id: string, message: string) {
  requirePerm(actor, ["case.review"]);
  if (!message || message.trim().length < 5) throw new AppError("Describe the information needed.");
  return prisma.$transaction(async (tx) => {
    const c = await loadForAction(tx, actor, id, ["SUBMITTED", "REGISTERED", "UNDER_REVIEW", "DECIDED", "ASSIGNED", "IN_PROGRESS"]);
    await tx.case.update({ where: { id }, data: { status: "INFO_REQUESTED" } });
    await log(tx, id, actor, "Additional information requested", { from: c.status, to: "INFO_REQUESTED", note: message.trim(), isPublic: true });
    await audit(tx, actor.id, "CASE_INFO_REQUEST", "Case", id);
    await notifyCitizen(tx, c.citizenId, {
      title: `More information needed for ${c.referenceNo}`,
      body: message.trim(),
      link: `/portal/cases/${id}`,
    });
  });
}

export async function citizenProvideInfo(actor: Actor, id: string, text: string, files: Upload[]) {
  requirePerm(actor, "portal.citizen");
  if (!text || text.trim().length < 3) throw new AppError("Please write a short response.");
  return prisma.$transaction(async (tx) => {
    const c = await loadForAction(tx, actor, id, ["INFO_REQUESTED"]);
    await attach(tx, id, actor, files);
    await tx.case.update({ where: { id }, data: { status: "UNDER_REVIEW" } });
    await log(tx, id, actor, "Citizen provided additional information", { from: c.status, to: "UNDER_REVIEW", note: text.trim(), isPublic: true });
    await notifyUsers(tx, [c.assignedOfficerId], { title: `Information received for ${c.referenceNo}`, body: text.trim().slice(0, 200), link: `/staff/cases/${id}` });
    if (!c.assignedOfficerId) await notifyRole(tx, "case.review", { title: `Information received for ${c.referenceNo}`, body: text.trim().slice(0, 200), link: `/staff/cases/${id}` });
  });
}

export const assignSchema = z.object({
  departmentId: z.string().min(1, "Choose a department"),
  reason: z.string().trim().min(5).max(2000),
  deadline: optDate,
});

async function doAssign(tx: Tx, actor: Actor, c: { id: string; status: string; referenceNo: string; title: string; categoryId: string; citizenId: string }, input: z.infer<typeof assignSchema>) {
  const dept = await tx.department.findFirst({ where: { id: input.departmentId, isActive: true } });
  if (!dept) throw new AppError("Unknown department.");
  const cat = await tx.caseCategory.findUnique({ where: { id: c.categoryId } });
  const deadline = input.deadline ?? new Date(Date.now() + (cat?.defaultDeadlineDays ?? 15) * 86400_000);
  await tx.caseAssignment.updateMany({ where: { caseId: c.id, status: "ACTIVE" }, data: { status: "REASSIGNED" } });
  await tx.caseAssignment.create({ data: { caseId: c.id, departmentId: dept.id, assignedById: actor.id, reason: input.reason, deadline } });
  await tx.case.update({ where: { id: c.id }, data: { departmentId: dept.id, deptOfficerId: null, status: "ASSIGNED", deadline, handling: "DEPARTMENT" } });
  await log(tx, c.id, actor, `Assigned to ${dept.name}`, { from: c.status, to: "ASSIGNED", note: `${input.reason} (deadline ${deadline.toISOString().slice(0, 10)})` });
  await log(tx, c.id, null, `Referred to ${dept.name} for action`, { isPublic: true });
  await notifyRole(tx, "case.dept.assign", { title: `Case ${c.referenceNo} assigned to your department`, body: c.title, link: `/staff/cases/${c.id}` }, { departmentId: dept.id });
  await notifyCitizen(tx, c.citizenId, { title: `Update on ${c.referenceNo}`, body: `Your case has been referred to ${dept.name}.`, link: `/portal/cases/${c.id}` });
  return dept;
}

export async function assignToDepartment(actor: Actor, id: string, raw: unknown) {
  requirePerm(actor, "case.assign");
  const input = assignSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const c = await loadForAction(tx, actor, id, ["REGISTERED", "UNDER_REVIEW", "DECIDED", "ASSIGNED", "IN_PROGRESS", "RESPONDED"]);
    await doAssign(tx, actor, c, input);
    await audit(tx, actor.id, "CASE_ASSIGN", "Case", id, input);
  });
}

export const forwardSchema = z.object({
  executiveId: z.string().min(1, "Choose the Mayor or a Deputy Mayor"),
  summary: z.string().trim().min(10).max(5000),
  recommendedAction: z.string().trim().min(5).max(5000),
  reason: z.string().trim().min(5).max(2000),
});

export async function executives() {
  return prisma.user.findMany({
    where: { isActive: true, role: { permissions: { some: { permission: { code: "case.decide" } } } } },
    include: { role: true },
    orderBy: { fullName: "asc" },
  });
}

export async function forwardToExecutive(actor: Actor, id: string, raw: unknown) {
  requirePerm(actor, "case.forward");
  const input = forwardSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const c = await loadForAction(tx, actor, id, ["REGISTERED", "UNDER_REVIEW", "DECIDED", "RESPONDED"]);
    const exec = await tx.user.findFirst({
      where: { id: input.executiveId, isActive: true, role: { permissions: { some: { permission: { code: "case.decide" } } } } },
    });
    if (!exec) throw new AppError("The selected official is not authorised to receive cases for executive decision.");
    await tx.caseForwarding.updateMany({ where: { caseId: id, status: "PENDING" }, data: { status: "ACTED" } });
    await tx.caseForwarding.create({ data: { caseId: id, fromUserId: actor.id, toUserId: exec.id, reason: input.reason, summary: input.summary, recommendedAction: input.recommendedAction } });
    await tx.case.update({ where: { id }, data: { status: "AWAITING_EXECUTIVE", executiveId: exec.id, recommendation: input.recommendedAction, handling: "EXECUTIVE" } });
    await log(tx, id, actor, `Forwarded to ${exec.fullName}${exec.title ? ` (${exec.title})` : ""}`, { from: c.status, to: "AWAITING_EXECUTIVE", note: input.reason });
    await log(tx, id, null, "Submitted for executive review", { isPublic: true });
    await audit(tx, actor.id, "CASE_FORWARD", "Case", id, { to: exec.id, reason: input.reason });
    await notifyUsers(tx, [exec.id], { title: `Case ${c.referenceNo} requires your attention`, body: input.summary.slice(0, 200), link: `/staff/cases/${id}` });
  });
}

export const decisionSchema = z.object({
  decisionType: z.enum(DECISION_TYPES),
  instruction: z.string().trim().min(5, "Write the instruction or decision").max(5000),
  departmentId: z.string().optional().transform((v) => v || undefined),
  delegateToId: z.string().optional().transform((v) => v || undefined),
  deadline: optDate,
});

export async function recordDecision(actor: Actor, id: string, raw: unknown) {
  requirePerm(actor, "case.decide");
  const input = decisionSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const c = await loadForAction(tx, actor, id, ["AWAITING_EXECUTIVE"]);
    // Only the official the case was forwarded to may decide; the Mayor may act on any forwarded case.
    const isMayor = can(actor, "case.view.all") && can(actor, "case.view.confidential");
    if (c.executiveId !== actor.id && !isMayor) throw new ForbiddenError("This case was forwarded to another official.");
    const pending = await tx.caseForwarding.findFirst({ where: { caseId: id, status: "PENDING" }, orderBy: { createdAt: "desc" } });

    let delegate: { id: string; fullName: string } | null = null;
    if (input.decisionType === "DELEGATE") {
      if (!input.delegateToId) throw new AppError("Choose the official to delegate to.");
      delegate = await tx.user.findFirst({ where: { id: input.delegateToId, isActive: true, role: { permissions: { some: { permission: { code: "case.decide" } } } } } });
      if (!delegate || delegate.id === actor.id) throw new AppError("Choose another authorised official.");
    }
    if (input.decisionType === "APPROVE_RECOMMENDATION" && !c.recommendation) throw new AppError("There is no recommendation on this case to approve.");

    await tx.executiveDecision.create({
      data: {
        caseId: id,
        forwardingId: pending?.id,
        executiveId: actor.id,
        decisionType: input.decisionType,
        instruction: input.instruction,
        assignedDepartmentId: input.departmentId,
        delegatedToId: delegate?.id,
        deadline: input.deadline,
      },
    });
    if (pending) await tx.caseForwarding.update({ where: { id: pending.id }, data: { status: "ACTED" } });

    const label = input.decisionType.replace(/_/g, " ").toLowerCase();
    if (delegate) {
      await tx.caseForwarding.create({ data: { caseId: id, fromUserId: actor.id, toUserId: delegate.id, reason: "Delegated by executive decision", summary: input.instruction } });
      await tx.case.update({ where: { id }, data: { executiveId: delegate.id } });
      await log(tx, id, actor, `Executive decision: delegated to ${delegate.fullName}`, { note: input.instruction });
      await notifyUsers(tx, [delegate.id], { title: `Case ${c.referenceNo} delegated to you`, body: input.instruction.slice(0, 200), link: `/staff/cases/${id}` });
    } else if (input.decisionType === "RETURN_FOR_REVIEW") {
      await tx.case.update({ where: { id }, data: { status: "UNDER_REVIEW", executiveId: null } });
      await log(tx, id, actor, "Executive decision: returned for further review", { from: c.status, to: "UNDER_REVIEW", note: input.instruction });
    } else if (input.departmentId) {
      await tx.case.update({ where: { id }, data: { status: "DECIDED" } });
      await log(tx, id, actor, `Executive decision: ${label}`, { from: c.status, to: "DECIDED", note: input.instruction });
      await doAssign(tx, actor, { ...c, status: "DECIDED" }, { departmentId: input.departmentId, reason: `Executive instruction: ${input.instruction}`, deadline: input.deadline });
    } else {
      await tx.case.update({ where: { id }, data: { status: "DECIDED" } });
      await log(tx, id, actor, `Executive decision: ${label}`, { from: c.status, to: "DECIDED", note: input.instruction });
    }
    if (input.decisionType !== "DELEGATE") await log(tx, id, null, "Executive review completed", { isPublic: true });
    await audit(tx, actor.id, "EXECUTIVE_DECISION", "Case", id, { decisionType: input.decisionType });
    await notifyUsers(tx, [pending?.fromUserId, c.assignedOfficerId], { title: `Executive decision on ${c.referenceNo}`, body: `${label}: ${input.instruction.slice(0, 180)}`, link: `/staff/cases/${id}` });
  });
}

function assertDeptAccess(actor: Actor, c: { departmentId: string | null; deptOfficerId: string | null }) {
  const own = c.deptOfficerId === actor.id;
  const head = can(actor, "case.view.department") && actor.departmentId && c.departmentId === actor.departmentId;
  if (!own && !head) throw new ForbiddenError("This case is not with your department.");
}

export async function allocateToOfficer(actor: Actor, id: string, officerId: string) {
  requirePerm(actor, "case.dept.assign");
  return prisma.$transaction(async (tx) => {
    const c = await loadForAction(tx, actor, id, ["ASSIGNED", "IN_PROGRESS"]);
    assertDeptAccess(actor, c);
    const officer = await tx.user.findFirst({ where: { id: officerId, isActive: true, departmentId: c.departmentId } });
    if (!officer) throw new AppError("Choose an officer from your department.");
    await tx.case.update({ where: { id }, data: { deptOfficerId: officer.id, status: "IN_PROGRESS" } });
    await tx.caseAssignment.updateMany({ where: { caseId: id, status: "ACTIVE" }, data: { assignedOfficerId: officer.id } });
    await log(tx, id, actor, `Allocated to department officer ${officer.fullName}`, { from: c.status, to: "IN_PROGRESS" });
    await audit(tx, actor.id, "CASE_ALLOCATE", "Case", id, { officerId });
    await notifyUsers(tx, [officer.id], { title: `Case ${c.referenceNo} allocated to you`, body: c.title, link: `/staff/cases/${id}` });
  });
}

export const responseSchema = z.object({
  responseType: z.enum(RESPONSE_TYPES),
  content: z.string().trim().min(10).max(10000),
});

export async function departmentRespond(actor: Actor, id: string, raw: unknown, files: Upload[] = []) {
  requirePerm(actor, "case.respond");
  const input = responseSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const c = await loadForAction(tx, actor, id, ["ASSIGNED", "IN_PROGRESS"]);
    assertDeptAccess(actor, c);
    const assignment = await tx.caseAssignment.findFirst({ where: { caseId: id, status: "ACTIVE" } });
    await tx.departmentResponse.create({
      data: { caseId: id, assignmentId: assignment?.id, departmentId: c.departmentId!, responderId: actor.id, responderName: actor.fullName, responseType: input.responseType, content: input.content },
    });
    await attach(tx, id, actor, files);
    let to: CaseStatus = c.status as CaseStatus;
    if (input.responseType === "COMPLETED") {
      to = "RESPONDED";
      if (assignment) await tx.caseAssignment.update({ where: { id: assignment.id }, data: { status: "COMPLETED" } });
    } else if (input.responseType === "PROGRESS") to = "IN_PROGRESS";
    if (to !== c.status) await tx.case.update({ where: { id }, data: { status: to } });
    await log(tx, id, actor, `Department response: ${input.responseType.replace(/_/g, " ").toLowerCase()}`, { from: c.status, to, note: input.content });
    if (input.responseType === "COMPLETED") await log(tx, id, null, "The responsible office reported action taken; awaiting verification", { isPublic: true });
    await audit(tx, actor.id, "DEPT_RESPONSE", "Case", id, { type: input.responseType });
    const msg = { title: `Department response on ${c.referenceNo}`, body: input.content.slice(0, 200), link: `/staff/cases/${id}` };
    if (c.assignedOfficerId) await notifyUsers(tx, [c.assignedOfficerId], msg);
    else await notifyRole(tx, "case.close", msg);
  });
}

export async function closeCase(actor: Actor, id: string, resolution: string) {
  requirePerm(actor, "case.close");
  if (!resolution || resolution.trim().length < 10) throw new AppError("Record the final resolution (at least 10 characters).");
  return prisma.$transaction(async (tx) => {
    const c = await loadForAction(tx, actor, id, ["REGISTERED", "UNDER_REVIEW", "DECIDED", "RESPONDED", "IN_PROGRESS", "ASSIGNED"]);
    await tx.case.update({ where: { id }, data: { status: "CLOSED", resolution: resolution.trim(), closedAt: new Date() } });
    await tx.caseAssignment.updateMany({ where: { caseId: id, status: "ACTIVE" }, data: { status: "COMPLETED" } });
    await log(tx, id, actor, "Outcome verified and case closed", { from: c.status, to: "CLOSED", note: resolution.trim(), isPublic: true });
    await audit(tx, actor.id, "CASE_CLOSE", "Case", id);
    await notifyCitizen(tx, c.citizenId, { title: `Case ${c.referenceNo} closed`, body: resolution.trim().slice(0, 250), link: `/portal/cases/${id}` });
  });
}

export async function reopenCase(actor: Actor, id: string, reason: string) {
  requirePerm(actor, "case.reopen");
  if (!reason || reason.trim().length < 10) throw new AppError("Give the justification for reopening (at least 10 characters).");
  return prisma.$transaction(async (tx) => {
    const c = await loadForAction(tx, actor, id, ["CLOSED"]);
    await tx.case.update({ where: { id }, data: { status: "UNDER_REVIEW", closedAt: null } });
    await log(tx, id, actor, "Case reopened", { from: c.status, to: "UNDER_REVIEW", note: reason.trim(), isPublic: true });
    await audit(tx, actor.id, "CASE_REOPEN", "Case", id, { reason });
    await notifyCitizen(tx, c.citizenId, { title: `Case ${c.referenceNo} reopened`, body: "Your case has been reopened for further review.", link: `/portal/cases/${id}` });
  });
}

export async function escalateOverdue(actor: Actor, id: string) {
  requirePerm(actor, "case.assign");
  return prisma.$transaction(async (tx) => {
    const c = await loadForAction(tx, actor, id, ["ASSIGNED", "IN_PROGRESS"]);
    if (!c.deadline || c.deadline > new Date()) throw new AppError("This case is not overdue.");
    await tx.case.update({ where: { id }, data: { priority: c.priority === "URGENT" ? "URGENT" : "HIGH" } });
    await log(tx, id, actor, "Escalated as overdue", { note: `Deadline was ${c.deadline.toISOString().slice(0, 10)}` });
    await audit(tx, actor.id, "CASE_ESCALATE", "Case", id);
    await notifyRole(tx, "case.dept.assign", { title: `OVERDUE: case ${c.referenceNo}`, body: `Response deadline passed on ${c.deadline.toISOString().slice(0, 10)}.`, link: `/staff/cases/${id}` }, { departmentId: c.departmentId });
  });
}

export async function addNote(actor: Actor, id: string, note: string, isPublic: boolean, files: Upload[] = []) {
  if (can(actor, "portal.citizen")) throw new ForbiddenError();
  if ((!note || note.trim().length < 2) && !files.length) throw new AppError("Write a note or attach a document.");
  return prisma.$transaction(async (tx) => {
    const c = await loadForAction(tx, actor, id);
    await attach(tx, id, actor, files);
    await log(tx, id, actor, files.length ? `Note added with ${files.length} document(s)` : "Note added", { note: note?.trim() || undefined, isPublic });
    if (isPublic) await notifyCitizen(tx, c.citizenId, { title: `Update on ${c.referenceNo}`, body: note.trim().slice(0, 250), link: `/portal/cases/${id}` });
  });
}

export async function submitFeedback(actor: Actor, id: string, rating: number, comment?: string) {
  requirePerm(actor, "portal.citizen");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError("Choose a rating between 1 and 5.");
  const c = await prisma.case.findFirst({ where: { AND: [{ id }, caseWhere(actor)] } });
  if (!c) throw new NotFoundError();
  if (c.status !== "CLOSED") throw new AppError("Feedback can be given once the case is closed.");
  const existing = await prisma.feedback.findFirst({ where: { caseId: id, citizenId: c.citizenId } });
  if (existing) throw new AppError("You have already rated this case.");
  await prisma.feedback.create({ data: { caseId: id, citizenId: c.citizenId, rating, comment: comment?.trim() || null } });
}

/** Public tracking: reference number + phone number, public history only. */
export async function trackCase(referenceNo: string, phone: string) {
  const c = await prisma.case.findFirst({
    where: { referenceNo: referenceNo.trim().toUpperCase(), citizen: { phone: phone.trim() } },
    include: { category: true, actions: { where: { isPublic: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!c) return null;
  return { referenceNo: c.referenceNo, title: c.confidentiality === "NORMAL" ? c.title : "Confidential matter", status: c.status, category: c.category.name, createdAt: c.createdAt, actions: c.actions.map((a) => ({ action: a.action, note: a.note, createdAt: a.createdAt })) };
}
