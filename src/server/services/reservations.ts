import { z } from "zod";
import { prisma, type Tx } from "@/server/db";
import { can, requirePerm, reservationWhere, type Actor } from "@/server/access";
import { AppError, ForbiddenError, NotFoundError } from "@/server/errors";
import { reservationRef } from "@/server/refno";
import { audit } from "@/server/audit";
import { notifyRole, notifyUsers } from "@/server/services/notifications";

export const reservationSchema = z
  .object({
    facilityId: z.string().min(1, "Choose a facility"),
    title: z.string().trim().min(3).max(200),
    purpose: z.string().trim().max(2000).optional(),
    attendees: z.coerce.number().int().min(1).max(5000),
    startAt: z.string().min(1).transform((v) => new Date(v)),
    endAt: z.string().min(1).transform((v) => new Date(v)),
  })
  .refine((r) => !isNaN(r.startAt.getTime()) && !isNaN(r.endAt.getTime()), "Invalid date/time")
  .refine((r) => r.endAt > r.startAt, { message: "End time must be after start time", path: ["endAt"] })
  .refine((r) => r.startAt.getTime() > Date.now(), { message: "Start time must be in the future", path: ["startAt"] })
  .refine((r) => r.endAt.getTime() - r.startAt.getTime() <= 14 * 3600_000, { message: "A single reservation may not exceed 14 hours", path: ["endAt"] });

async function assertFree(tx: Tx, facilityId: string, start: Date, end: Date, excludeId?: string, statuses = ["APPROVED", "PENDING"]) {
  const clash = await tx.reservation.findFirst({
    where: { facilityId, status: { in: statuses }, startAt: { lt: end }, endAt: { gt: start }, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (clash) throw new AppError(`The facility is already ${clash.status === "APPROVED" ? "booked" : "requested"} for an overlapping time (${clash.referenceNo}).`);
}

export async function requestReservation(actor: Actor, raw: unknown) {
  requirePerm(actor, "reservation.request");
  const input = reservationSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const f = await tx.facility.findFirst({ where: { id: input.facilityId, isActive: true } });
    if (!f) throw new AppError("Unknown facility.");
    if (input.attendees > f.capacity) throw new AppError(`${f.name} holds at most ${f.capacity} people.`);
    await assertFree(tx, f.id, input.startAt, input.endAt);
    const r = await tx.reservation.create({ data: { ...input, referenceNo: await reservationRef(tx), requestedById: actor.id } });
    await audit(tx, actor.id, "RESERVATION_CREATE", "Reservation", r.id, { facility: f.name });
    const msg = { title: `Reservation request ${r.referenceNo}`, body: `${f.name}: ${r.title}`, link: `/staff/reservations` };
    if (f.managerId) await notifyUsers(tx, [f.managerId], msg);
    else await notifyRole(tx, "reservation.manage", msg);
    return r;
  });
}

export async function listReservations(actor: Actor, f: { from?: Date; to?: Date; facilityId?: string; status?: string; all?: boolean } = {}) {
  // Approved bookings are visible to everyone who may request, so they can see availability.
  const scope = f.all && can(actor, "reservation.request") ? {} : reservationWhere(actor);
  return prisma.reservation.findMany({
    where: {
      AND: [scope, f.from ? { endAt: { gt: f.from } } : {}, f.to ? { startAt: { lt: f.to } } : {}, f.facilityId ? { facilityId: f.facilityId } : {}, f.status ? { status: f.status } : {}],
    },
    include: { facility: true, requestedBy: true },
    orderBy: { startAt: "asc" },
    take: 500,
  });
}

export async function decideReservation(actor: Actor, id: string, approve: boolean, note?: string) {
  requirePerm(actor, "reservation.manage");
  if (!approve && (!note || note.trim().length < 5)) throw new AppError("Give the reason for rejection.");
  return prisma.$transaction(async (tx) => {
    const r = await tx.reservation.findUnique({ where: { id } });
    if (!r) throw new NotFoundError();
    if (r.status !== "PENDING") throw new AppError("Only pending reservations can be decided.");
    if (approve) await assertFree(tx, r.facilityId, r.startAt, r.endAt, r.id, ["APPROVED"]);
    const status = approve ? "APPROVED" : "REJECTED";
    await tx.reservation.update({ where: { id }, data: { status, decisionNote: note?.trim() || null, decidedById: actor.id, decidedAt: new Date() } });
    await audit(tx, actor.id, `RESERVATION_${status}`, "Reservation", id, { note });
    await notifyUsers(tx, [r.requestedById], { title: `Reservation ${r.referenceNo} ${approve ? "approved" : "rejected"}`, body: note?.trim() || r.title, link: `/staff/reservations` });
  });
}

export async function cancelReservation(actor: Actor, id: string, note?: string) {
  return prisma.$transaction(async (tx) => {
    const r = await tx.reservation.findUnique({ where: { id } });
    if (!r) throw new NotFoundError();
    if (r.requestedById !== actor.id && !can(actor, "reservation.manage")) throw new ForbiddenError();
    if (!["PENDING", "APPROVED"].includes(r.status)) throw new AppError("This reservation is no longer active.");
    await tx.reservation.update({ where: { id }, data: { status: "CANCELLED", decisionNote: note?.trim() || "Cancelled" } });
    await audit(tx, actor.id, "RESERVATION_CANCEL", "Reservation", id);
    if (r.requestedById !== actor.id) await notifyUsers(tx, [r.requestedById], { title: `Reservation ${r.referenceNo} cancelled`, body: note?.trim() || "", link: `/staff/reservations` });
  });
}
