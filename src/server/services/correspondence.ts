import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { can, requirePerm, type Actor } from "@/server/access";
import { AppError, ForbiddenError, NotFoundError } from "@/server/errors";
import { correspondenceRef } from "@/server/refno";
import { audit } from "@/server/audit";
import { saveFile } from "@/server/storage";
import { notifyUsers } from "@/server/services/notifications";

type Upload = { name: string; buf: Buffer };

export const correspondenceSchema = z.object({
  direction: z.enum(["INCOMING", "OUTGOING"]),
  subject: z.string().trim().min(3).max(300),
  summary: z.string().trim().max(5000).optional(),
  senderOrg: z.string().trim().min(2).max(200),
  recipientOrg: z.string().trim().min(2).max(200),
  letterDate: z.string().min(1).transform((v) => new Date(v)),
  receivedDate: z.string().optional().transform((v) => (v ? new Date(v) : undefined)),
  confidentiality: z.enum(["NORMAL", "CONFIDENTIAL"]),
  caseReference: z.string().trim().optional(),
  handlerId: z.string().optional().transform((v) => v || undefined),
});

function visibleWhere(actor: Actor): Prisma.CorrespondenceWhereInput {
  requirePerm(actor, ["correspondence.view", "correspondence.manage"]);
  if (can(actor, "correspondence.approve")) return {};
  return { OR: [{ confidentiality: "NORMAL" }, { createdById: actor.id }, { handlerId: actor.id }] };
}

export async function listCorrespondence(actor: Actor, f: { q?: string; direction?: string; status?: string } = {}) {
  return prisma.correspondence.findMany({
    where: {
      AND: [
        visibleWhere(actor),
        f.direction ? { direction: f.direction } : {},
        f.status ? { status: f.status } : {},
        f.q ? { OR: [{ documentNo: { contains: f.q } }, { subject: { contains: f.q } }, { senderOrg: { contains: f.q } }, { recipientOrg: { contains: f.q } }] } : {},
      ],
    },
    include: { case: true, _count: { select: { documents: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
}

export async function getCorrespondence(actor: Actor, id: string) {
  const c = await prisma.correspondence.findFirst({
    where: { AND: [{ id }, visibleWhere(actor)] },
    include: { case: true, documents: true, history: { orderBy: { createdAt: "asc" } } },
  });
  if (!c) throw new NotFoundError();
  return c;
}

export async function createCorrespondence(actor: Actor, raw: unknown, files: Upload[]) {
  requirePerm(actor, "correspondence.manage");
  const input = correspondenceSchema.parse(raw);
  if (isNaN(input.letterDate.getTime())) throw new AppError("Invalid letter date.");
  let caseId: string | undefined;
  if (input.caseReference) {
    const c = await prisma.case.findUnique({ where: { referenceNo: input.caseReference.toUpperCase() } });
    if (!c) throw new AppError(`No case with reference ${input.caseReference}.`);
    caseId = c.id;
  }
  return prisma.$transaction(async (tx) => {
    const { caseReference: _ignored, ...data } = input;
    const doc = await tx.correspondence.create({
      data: { ...data, caseId, documentNo: await correspondenceRef(tx, input.direction), createdById: actor.id },
    });
    for (const f of files) {
      const s = await saveFile(f.name, f.buf);
      await tx.document.create({ data: { ...s, correspondenceId: doc.id, uploadedById: actor.id } });
    }
    await tx.correspondenceAction.create({ data: { correspondenceId: doc.id, actorId: actor.id, actorName: actor.fullName, action: "Registered", note: `Document number ${doc.documentNo}` } });
    await audit(tx, actor.id, "CORRESPONDENCE_CREATE", "Correspondence", doc.id, { documentNo: doc.documentNo });
    if (input.handlerId) await notifyUsers(tx, [input.handlerId], { title: `Correspondence ${doc.documentNo} assigned to you`, body: doc.subject, link: `/staff/correspondence/${doc.id}` });
    return doc;
  });
}

const FLOW: Record<string, Record<string, string[]>> = {
  INCOMING: { REGISTERED: ["UNDER_REVIEW", "ARCHIVED"], UNDER_REVIEW: ["ARCHIVED"], ARCHIVED: [] },
  OUTGOING: { REGISTERED: ["UNDER_REVIEW"], UNDER_REVIEW: ["APPROVED", "REGISTERED"], APPROVED: ["DISPATCHED"], DISPATCHED: ["ARCHIVED"], ARCHIVED: [] },
};

export function nextStatuses(direction: string, status: string) {
  return FLOW[direction]?.[status] ?? [];
}

export async function changeCorrespondenceStatus(actor: Actor, id: string, to: string, note?: string) {
  const c = await getCorrespondence(actor, id);
  if (to === "APPROVED") requirePerm(actor, "correspondence.approve");
  else requirePerm(actor, "correspondence.manage");
  if (!nextStatuses(c.direction, c.status).includes(to)) throw new AppError(`Cannot move from ${c.status} to ${to}.`);
  await prisma.$transaction(async (tx) => {
    await tx.correspondence.update({
      where: { id },
      data: { status: to, ...(to === "APPROVED" ? { approvedById: actor.id, approvedAt: new Date() } : {}), ...(to === "ARCHIVED" ? { archivedAt: new Date() } : {}) },
    });
    await tx.correspondenceAction.create({ data: { correspondenceId: id, actorId: actor.id, actorName: actor.fullName, action: `Status: ${c.status} → ${to}`, note: note?.trim() || null } });
    await audit(tx, actor.id, "CORRESPONDENCE_STATUS", "Correspondence", id, { from: c.status, to });
    if (to === "UNDER_REVIEW" && c.direction === "OUTGOING") {
      const approvers = await tx.user.findMany({ where: { isActive: true, role: { permissions: { some: { permission: { code: "correspondence.approve" } } } } }, select: { id: true } });
      await notifyUsers(tx, approvers.map((a) => a.id), { title: `Outgoing letter ${c.documentNo} awaiting approval`, body: c.subject, link: `/staff/correspondence/${id}` });
    }
  });
}

export async function addCorrespondenceFiles(actor: Actor, id: string, files: Upload[], note?: string) {
  requirePerm(actor, "correspondence.manage");
  const c = await getCorrespondence(actor, id);
  if (c.status === "ARCHIVED") throw new ForbiddenError("Archived records cannot be changed.");
  if (!files.length && !note?.trim()) throw new AppError("Attach a file or write a note.");
  await prisma.$transaction(async (tx) => {
    for (const f of files) {
      const s = await saveFile(f.name, f.buf);
      await tx.document.create({ data: { ...s, correspondenceId: id, uploadedById: actor.id } });
    }
    await tx.correspondenceAction.create({ data: { correspondenceId: id, actorId: actor.id, actorName: actor.fullName, action: files.length ? `Attached ${files.length} file(s)` : "Note", note: note?.trim() || null } });
  });
}
