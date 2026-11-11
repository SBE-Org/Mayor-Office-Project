import { z } from "zod";
import { prisma, type Tx } from "@/server/db";
import { appointmentWhere, can, caseWhere, requirePerm, type Actor } from "@/server/access";
import { AppError, ForbiddenError, NotFoundError } from "@/server/errors";
import { appointmentRef } from "@/server/refno";
import { audit } from "@/server/audit";
import { notifyCitizen, notifyRole, notifyUsers } from "@/server/services/notifications";
import { citizenInfoSchema } from "@/server/services/cases";
import { assertLocation } from "@/server/services/directory";
import { ACTIVE_APPOINTMENT_STATUSES, APPOINTMENT_CATEGORIES, OFFICE_HOURS } from "@/shared/constants";

/** What citizens see for an official in the appointment drop-down. */
export const officialLabel = (u: { appointmentLabel: string | null; title: string | null; role: { name: string } }) => u.appointmentLabel || u.title || u.role.name;

/**
 * Officials citizens can request appointments with. The list, its labels (Mayor, Deputy Mayor, …)
 * and order are managed by the Super Administrator under Appointment officials.
 */
export async function officials() {
  const list = await prisma.user.findMany({
    where: { isActive: true, acceptsAppointments: true, role: { code: { not: "CITIZEN" } } },
    include: { role: true },
    orderBy: [{ appointmentOrder: "asc" }, { fullName: "asc" }],
  });
  return list.map((u) => ({ ...u, label: officialLabel(u) }));
}

const officialSettingSchema = z.object({
  acceptsAppointments: z.boolean(),
  appointmentLabel: z.string().trim().max(120).optional().transform((v) => v || null),
  appointmentOrder: z.coerce.number().int().min(0).max(999).default(0),
});

/** Super Administrator: show / hide an official in the citizen drop-down, set its label and position in the list. */
export async function setAppointmentOfficial(actor: Actor, userId: string, raw: unknown) {
  requirePerm(actor, "user.manage");
  const data = officialSettingSchema.parse(raw);
  const u = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!u || u.role.code === "CITIZEN") throw new NotFoundError();
  if (data.acceptsAppointments && !u.isActive) throw new AppError("Activate the account before listing it for appointments.");
  await prisma.user.update({ where: { id: userId }, data });
  await audit(prisma, actor.id, "APPOINTMENT_OFFICIAL_UPDATE", "User", userId, data);
}

function parseLocal(v: string) {
  const d = new Date(v);
  if (isNaN(d.getTime())) throw new AppError("Invalid date/time.");
  return d;
}

/** Validates office-hours rules (configurable assumption in constants.ts). */
export function validateSlot(start: Date, minutes: number) {
  const end = new Date(start.getTime() + minutes * 60_000);
  const day = start.getDay();
  if (day === 0 || day === 6) throw new AppError("Appointments are available Monday to Friday only.");
  if (start.getTime() < Date.now()) throw new AppError("Choose a time in the future.");
  const h = start.getHours() + start.getMinutes() / 60;
  const he = end.getHours() + end.getMinutes() / 60;
  if (h < OFFICE_HOURS.start || he > OFFICE_HOURS.end) throw new AppError(`Appointments must be between ${OFFICE_HOURS.start}:00 and ${OFFICE_HOURS.end}:00.`);
  if (h < OFFICE_HOURS.lunchEnd && he > OFFICE_HOURS.lunchStart) throw new AppError("Appointments cannot overlap the lunch break (12:00–13:00).");
  if (start.getMinutes() % OFFICE_HOURS.slotMinutes !== 0) throw new AppError("Choose a start time on the half hour.");
  return end;
}

export async function assertNoConflict(tx: Tx, officialId: string, start: Date, end: Date, excludeId?: string) {
  const clash = await tx.appointment.findFirst({
    where: {
      officialId,
      status: { in: ACTIVE_APPOINTMENT_STATUSES },
      startAt: { lt: end },
      endAt: { gt: start },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  if (clash) throw new AppError("This time is already booked for the selected official. Please choose another slot.");
}

/** Slots for one official on one day, flagged as free / taken. */
export async function availability(officialId: string, dateStr: string) {
  const day = new Date(`${dateStr}T00:00:00`);
  if (isNaN(day.getTime())) return [];
  const next = new Date(day.getTime() + 86400_000);
  const booked = await prisma.appointment.findMany({
    where: { officialId, status: { in: ACTIVE_APPOINTMENT_STATUSES }, startAt: { lt: next }, endAt: { gt: day } },
    select: { startAt: true, endAt: true },
  });
  const slots: { time: string; free: boolean }[] = [];
  if (day.getDay() === 0 || day.getDay() === 6) return slots;
  for (let m = OFFICE_HOURS.start * 60; m < OFFICE_HOURS.end * 60; m += OFFICE_HOURS.slotMinutes) {
    if (m >= OFFICE_HOURS.lunchStart * 60 && m < OFFICE_HOURS.lunchEnd * 60) continue;
    const s = new Date(day.getTime() + m * 60_000);
    const e = new Date(s.getTime() + OFFICE_HOURS.slotMinutes * 60_000);
    const taken = booked.some((b) => b.startAt < e && b.endAt > s);
    slots.push({ time: `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`, free: !taken && s.getTime() > Date.now() });
  }
  return slots;
}

export const appointmentSchema = z.object({
  officialId: z.string().min(1, "Choose an official"),
  category: z.enum(APPOINTMENT_CATEGORIES),
  purpose: z.string().trim().min(10, "Describe the purpose (at least 10 characters)").max(2000),
  date: z.string().min(1, "Choose a date"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time"),
  duration: z.coerce.number().refine((n) => n === 30 || n === 60, "Duration must be 30 or 60 minutes").default(30),
});

export async function requestAppointment(actor: Actor, raw: unknown, citizenRaw?: unknown) {
  const input = appointmentSchema.parse(raw);
  const isCitizen = can(actor, "portal.citizen");
  if (!isCitizen) requirePerm(actor, "appointment.walkin");
  if (isCitizen && !actor.citizenId) throw new ForbiddenError();
  const start = parseLocal(`${input.date}T${input.time}:00`);
  const end = validateSlot(start, input.duration);
  const official = (await officials()).find((o) => o.id === input.officialId);
  if (!official) throw new AppError("The selected official does not accept appointments.");
  const info = isCitizen ? null : citizenInfoSchema.parse(citizenRaw);
  if (info) await assertLocation(info);

  return prisma.$transaction(async (tx) => {
    await assertNoConflict(tx, official.id, start, end);
    let citizenId = actor.citizenId;
    if (info) {
      const existing = await tx.citizen.findFirst({ where: { phone: info.phone, fullName: info.fullName } });
      citizenId = existing ? existing.id : (await tx.citizen.create({ data: { ...info, registeredById: actor.id } })).id;
    }
    const autoApprove = !isCitizen && can(actor, "appointment.manage");
    const a = await tx.appointment.create({
      data: {
        referenceNo: await appointmentRef(tx),
        citizenId: citizenId!,
        officialId: official.id,
        category: input.category,
        purpose: input.purpose,
        startAt: start,
        endAt: end,
        channel: isCitizen ? "ONLINE" : "WALK_IN",
        status: autoApprove ? "APPROVED" : "REQUESTED",
        decidedById: autoApprove ? actor.id : null,
        decidedAt: autoApprove ? new Date() : null,
        createdById: actor.id,
      },
    });
    await audit(tx, actor.id, "APPOINTMENT_CREATE", "Appointment", a.id, { officialId: official.id, start });
    await notifyCitizen(tx, a.citizenId, {
      title: `Appointment ${a.referenceNo} ${autoApprove ? "confirmed" : "requested"}`,
      body: `With ${official.fullName} on ${start.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.`,
      link: `/portal/appointments`,
    });
    await notifyRole(tx, "appointment.manage", { title: `Appointment request ${a.referenceNo}`, body: `With ${official.fullName}`, link: `/staff/appointments/${a.id}` });
    return a;
  });
}

// ---------------------------------------------------------------- case appointments (with the case officer)

export const caseAppointmentSchema = z.object({
  date: z.string().min(1, "Choose a date"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time"),
  duration: z.coerce.number().refine((n) => n === 30 || n === 60, "Duration must be 30 or 60 minutes").default(30),
  purpose: z.string().trim().min(5, "Write a short note (at least 5 characters)").max(2000),
});

async function caseForAppointment(actor: Actor, caseId: string) {
  const c = await prisma.case.findFirst({ where: { AND: [{ id: caseId }, caseWhere(actor)] }, include: { assignedOfficer: true } });
  if (!c) throw new NotFoundError();
  if (c.status === "CLOSED") throw new AppError("This case is closed.");
  if (!c.assignedOfficer || !c.assignedOfficer.isActive) throw new AppError("A case officer has not been assigned to this case yet.");
  return { ...c, assignedOfficer: c.assignedOfficer };
}

async function logCase(tx: Tx, caseId: string, actor: Actor, action: string, note: string) {
  await tx.caseAction.create({ data: { caseId, actorId: actor.id, actorName: `${actor.fullName} (${actor.roleName})`, action, note, isPublic: true } });
}

const when = (d: Date) => d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

/** The case officer (or appointment manager) gives the citizen an appointment. Confirmed immediately. */
export async function scheduleCaseAppointment(actor: Actor, caseId: string, raw: unknown) {
  const input = caseAppointmentSchema.parse(raw);
  if (can(actor, "portal.citizen")) throw new ForbiddenError();
  const c = await caseForAppointment(actor, caseId);
  if (c.assignedOfficerId !== actor.id && !can(actor, "appointment.manage")) throw new ForbiddenError("Only the case officer can give an appointment for this case.");
  const start = parseLocal(`${input.date}T${input.time}:00`);
  const end = validateSlot(start, input.duration);
  return prisma.$transaction(async (tx) => {
    await assertNoConflict(tx, c.assignedOfficer.id, start, end);
    const a = await tx.appointment.create({
      data: {
        referenceNo: await appointmentRef(tx),
        citizenId: c.citizenId,
        officialId: c.assignedOfficer.id,
        caseId: c.id,
        category: "PERSONAL_CASE",
        purpose: input.purpose,
        startAt: start,
        endAt: end,
        status: "APPROVED",
        decidedById: actor.id,
        decidedAt: new Date(),
        createdById: actor.id,
      },
    });
    await logCase(tx, c.id, actor, "Appointment given", `${when(start)} with ${c.assignedOfficer.fullName} (${a.referenceNo}). ${input.purpose}`);
    await audit(tx, actor.id, "CASE_APPOINTMENT_GIVEN", "Appointment", a.id, { caseId: c.id, start });
    await notifyCitizen(tx, c.citizenId, {
      title: `Appointment for case ${c.referenceNo}`,
      body: `You have an appointment with ${c.assignedOfficer.fullName} on ${when(start)}. ${input.purpose}`,
      link: `/portal/cases/${c.id}`,
    });
    if (c.assignedOfficer.id !== actor.id) await notifyUsers(tx, [c.assignedOfficer.id], { title: `Appointment ${a.referenceNo} for case ${c.referenceNo}`, body: when(start), link: `/staff/cases/${c.id}` });
    return a;
  });
}

/** The citizen asks the case officer for an appointment; the officer approves or rejects it. */
export async function requestCaseAppointment(actor: Actor, caseId: string, raw: unknown) {
  requirePerm(actor, "portal.citizen");
  const input = caseAppointmentSchema.parse(raw);
  const c = await caseForAppointment(actor, caseId);
  if (await prisma.appointment.findFirst({ where: { caseId: c.id, status: "REQUESTED" } })) throw new AppError("You already have an appointment request waiting for the case officer.");
  const start = parseLocal(`${input.date}T${input.time}:00`);
  const end = validateSlot(start, input.duration);
  return prisma.$transaction(async (tx) => {
    await assertNoConflict(tx, c.assignedOfficer.id, start, end);
    const a = await tx.appointment.create({
      data: {
        referenceNo: await appointmentRef(tx),
        citizenId: c.citizenId,
        officialId: c.assignedOfficer.id,
        caseId: c.id,
        category: "PERSONAL_CASE",
        purpose: input.purpose,
        startAt: start,
        endAt: end,
        status: "REQUESTED",
        createdById: actor.id,
      },
    });
    await logCase(tx, c.id, actor, "Appointment requested", `${when(start)} (${a.referenceNo}). Waiting for the case officer.`);
    await audit(tx, actor.id, "CASE_APPOINTMENT_REQUEST", "Appointment", a.id, { caseId: c.id, start });
    await notifyUsers(tx, [c.assignedOfficer.id], { title: `Appointment request for case ${c.referenceNo}`, body: `${when(start)}: ${input.purpose.slice(0, 150)}`, link: `/staff/cases/${c.id}` });
    return a;
  });
}

/** Appointments belonging to one case (checked against case visibility). */
export async function caseAppointments(actor: Actor, caseId: string) {
  const c = await prisma.case.findFirst({ where: { AND: [{ id: caseId }, caseWhere(actor)] }, select: { id: true } });
  if (!c) throw new NotFoundError();
  return prisma.appointment.findMany({ where: { caseId }, include: { official: true }, orderBy: { startAt: "asc" } });
}

export async function listAppointments(actor: Actor, f: { from?: Date; to?: Date; officialId?: string; status?: string } = {}) {
  return prisma.appointment.findMany({
    where: {
      AND: [
        appointmentWhere(actor),
        f.from ? { startAt: { gte: f.from } } : {},
        f.to ? { startAt: { lt: f.to } } : {},
        f.officialId ? { officialId: f.officialId } : {},
        f.status ? { status: f.status } : {},
      ],
    },
    include: { citizen: true, official: true },
    orderBy: { startAt: "asc" },
    take: 500,
  });
}

export async function getAppointment(actor: Actor, id: string) {
  const a = await prisma.appointment.findFirst({ where: { AND: [{ id }, appointmentWhere(actor)] }, include: { citizen: true, official: true } });
  if (!a) throw new NotFoundError();
  return a;
}

async function loadManageable(tx: Tx, actor: Actor, id: string) {
  const a = await tx.appointment.findFirst({ where: { AND: [{ id }, appointmentWhere(actor)] }, include: { official: true } });
  if (!a) throw new NotFoundError();
  // Officials manage their own calendar; a case officer manages the appointments of their cases.
  const isOwn = a.officialId === actor.id && (can(actor, "appointment.own") || !!a.caseId || a.official.acceptsAppointments);
  if (!can(actor, "appointment.manage") && !isOwn) throw new ForbiddenError();
  return a;
}

export async function decideAppointment(actor: Actor, id: string, approve: boolean, note?: string) {
  if (!approve && (!note || note.trim().length < 5)) throw new AppError("Give the reason for rejection so the citizen is informed.");
  return prisma.$transaction(async (tx) => {
    const a = await loadManageable(tx, actor, id);
    if (a.status !== "REQUESTED") throw new AppError("Only requested appointments can be approved or rejected.");
    if (approve) await assertNoConflict(tx, a.officialId, a.startAt, a.endAt, a.id);
    const status = approve ? "APPROVED" : "REJECTED";
    await tx.appointment.update({ where: { id }, data: { status, decisionNote: note?.trim() || null, decidedById: actor.id, decidedAt: new Date() } });
    await audit(tx, actor.id, `APPOINTMENT_${status}`, "Appointment", id, { note });
    await notifyCitizen(tx, a.citizenId, {
      title: `Appointment ${a.referenceNo} ${approve ? "approved" : "not approved"}`,
      body: approve
        ? `Confirmed with ${a.official.fullName} on ${a.startAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}.${note ? " " + note : ""}`
        : `Reason: ${note}`,
      link: a.caseId ? `/portal/cases/${a.caseId}` : `/portal/appointments`,
    });
    if (a.caseId)
      await tx.caseAction.create({
        data: { caseId: a.caseId, actorId: actor.id, actorName: `${actor.fullName} (${actor.roleName})`, action: approve ? "Appointment request approved" : "Appointment request not approved", note: approve ? `${when(a.startAt)} (${a.referenceNo})` : `Reason: ${note}`, isPublic: true },
      });
    if (approve) await notifyUsers(tx, [a.officialId], { title: `Appointment confirmed ${a.referenceNo}`, body: a.purpose.slice(0, 150), link: `/staff/appointments/${id}` });
  });
}

export async function rescheduleAppointment(actor: Actor, id: string, date: string, time: string, duration: number, note: string) {
  if (!note || note.trim().length < 5) throw new AppError("Explain the reason for rescheduling.");
  const start = parseLocal(`${date}T${time}:00`);
  const end = validateSlot(start, duration === 60 ? 60 : 30);
  return prisma.$transaction(async (tx) => {
    const a = await loadManageable(tx, actor, id);
    if (!ACTIVE_APPOINTMENT_STATUSES.includes(a.status)) throw new AppError("Only active appointments can be rescheduled.");
    await assertNoConflict(tx, a.officialId, start, end, a.id);
    await tx.appointment.update({ where: { id }, data: { startAt: start, endAt: end, status: "APPROVED", decisionNote: note.trim(), decidedById: actor.id, decidedAt: new Date() } });
    await audit(tx, actor.id, "APPOINTMENT_RESCHEDULE", "Appointment", id, { from: a.startAt, to: start, note });
    await notifyCitizen(tx, a.citizenId, {
      title: `Appointment ${a.referenceNo} rescheduled`,
      body: `New time: ${start.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}. Reason: ${note.trim()}`,
      link: `/portal/appointments`,
    });
    await notifyUsers(tx, [a.officialId], { title: `Appointment rescheduled ${a.referenceNo}`, body: note.trim(), link: `/staff/appointments/${id}` });
  });
}

export async function cancelAppointment(actor: Actor, id: string, note?: string) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.appointment.findFirst({ where: { AND: [{ id }, appointmentWhere(actor)] } });
    if (!a) throw new NotFoundError();
    const isCitizenOwner = can(actor, "portal.citizen") && a.citizenId === actor.citizenId;
    if (!isCitizenOwner && !can(actor, "appointment.manage")) throw new ForbiddenError();
    if (!ACTIVE_APPOINTMENT_STATUSES.includes(a.status)) throw new AppError("This appointment is no longer active.");
    await tx.appointment.update({ where: { id }, data: { status: "CANCELLED", decisionNote: note?.trim() || (isCitizenOwner ? "Cancelled by citizen" : null) } });
    await audit(tx, actor.id, "APPOINTMENT_CANCEL", "Appointment", id, { note });
    if (!isCitizenOwner) await notifyCitizen(tx, a.citizenId, { title: `Appointment ${a.referenceNo} cancelled`, body: note?.trim() || "Your appointment was cancelled.", link: `/portal/appointments` });
    else await notifyRole(tx, "appointment.manage", { title: `Appointment ${a.referenceNo} cancelled by citizen`, body: "", link: `/staff/appointments/${id}` });
  });
}

export async function checkInAppointment(actor: Actor, id: string) {
  requirePerm(actor, ["appointment.walkin", "appointment.manage"]);
  const a = await prisma.appointment.findFirst({ where: { id, status: "APPROVED" } });
  if (!a) throw new AppError("Only approved appointments can be checked in.");
  await prisma.appointment.update({ where: { id }, data: { checkedInAt: new Date() } });
  await audit(prisma, actor.id, "APPOINTMENT_CHECKIN", "Appointment", id);
  await notifyUsers(prisma, [a.officialId], { title: `Visitor arrived for ${a.referenceNo}`, body: "The visitor has checked in at reception.", link: `/staff/appointments/${id}` });
}

export async function completeAppointment(actor: Actor, id: string, outcome: string, followUp: string, noShow: boolean) {
  if (!noShow && (!outcome || outcome.trim().length < 5)) throw new AppError("Record the meeting outcome.");
  return prisma.$transaction(async (tx) => {
    const a = await loadManageable(tx, actor, id);
    if (a.status !== "APPROVED") throw new AppError("Only approved appointments can be completed.");
    await tx.appointment.update({ where: { id }, data: { status: noShow ? "NO_SHOW" : "COMPLETED", outcome: outcome?.trim() || null, followUp: followUp?.trim() || null } });
    await audit(tx, actor.id, noShow ? "APPOINTMENT_NO_SHOW" : "APPOINTMENT_COMPLETE", "Appointment", id);
  });
}

/** Reminder hook: notify citizens about tomorrow's approved appointments (run daily, e.g. via cron hitting /api/v1/jobs/reminders). */
export async function sendReminders() {
  const from = new Date();
  from.setHours(24, 0, 0, 0);
  const to = new Date(from.getTime() + 86400_000);
  const list = await prisma.appointment.findMany({ where: { status: "APPROVED", startAt: { gte: from, lt: to } }, include: { official: true } });
  for (const a of list) {
    await notifyCitizen(prisma, a.citizenId, {
      title: `Reminder: appointment ${a.referenceNo} tomorrow`,
      body: `With ${a.official.fullName} at ${a.startAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}. Please bring your ID and reference number.`,
      link: `/portal/appointments`,
    });
  }
  return list.length;
}
