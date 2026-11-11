import type { Prisma } from "@prisma/client";
import type { PermissionCode, RoleCode } from "@/shared/permissions";
import { ForbiddenError } from "@/server/errors";

export type Actor = {
  id: string;
  fullName: string;
  email: string;
  role: RoleCode;
  roleName: string;
  title: string | null;
  departmentId: string | null;
  citizenId: string | null;
  permissions: Set<string>;
  sessionId?: string;
};

export function can(a: Actor | null | undefined, p: PermissionCode) {
  return !!a && a.permissions.has(p);
}
export function canAny(a: Actor | null | undefined, ps: PermissionCode[]) {
  return !!a && ps.some((p) => a.permissions.has(p));
}
export function requirePerm(a: Actor, p: PermissionCode | PermissionCode[]) {
  const list = Array.isArray(p) ? p : [p];
  if (!list.some((x) => a.permissions.has(x))) throw new ForbiddenError();
}

/** Row-level visibility of cases for the given actor. */
export function caseWhere(a: Actor): Prisma.CaseWhereInput {
  if (can(a, "portal.citizen")) return a.citizenId ? { citizenId: a.citizenId } : { id: "__none__" };
  const ors: Prisma.CaseWhereInput[] = [];
  const conf = can(a, "case.view.confidential");
  if (can(a, "case.view.all") && conf) return {}; // unrestricted (note: Prisma treats OR: [{}] as matching nothing)
  if (can(a, "case.view.all")) ors.push({ confidentiality: "NORMAL" });
  else if (conf) ors.push({ confidentiality: { not: "NORMAL" } });
  if (can(a, "case.view.department") && a.departmentId) ors.push({ departmentId: a.departmentId });
  if (can(a, "case.view.assigned")) ors.push({ assignedOfficerId: a.id }, { deptOfficerId: a.id });
  if (can(a, "case.view.forwarded")) ors.push({ executiveId: a.id }, { forwardings: { some: { toUserId: a.id } } });
  if (can(a, "case.register")) ors.push({ registeredById: a.id, confidentiality: { not: "STRICT" } });
  if (!ors.length) return { id: "__none__" };
  return { OR: ors };
}

export function appointmentWhere(a: Actor): Prisma.AppointmentWhereInput {
  if (can(a, "portal.citizen")) return a.citizenId ? { citizenId: a.citizenId } : { id: "__none__" };
  if (can(a, "appointment.view") || can(a, "appointment.manage")) return {};
  const ors: Prisma.AppointmentWhereInput[] = [];
  ors.push({ officialId: a.id }); // own calendar, including case appointments as case officer
  if (can(a, "appointment.walkin")) ors.push({ createdById: a.id });
  return ors.length ? { OR: ors } : { id: "__none__" };
}

export function reservationWhere(a: Actor): Prisma.ReservationWhereInput {
  if (can(a, "reservation.manage")) return {};
  if (can(a, "reservation.request")) return { requestedById: a.id };
  return { id: "__none__" };
}

export function homePath(a: Actor): string {
  if (can(a, "portal.citizen")) return "/portal";
  if (can(a, "dashboard.executive")) return "/staff/executive";
  if (can(a, "dashboard.office")) return "/staff/office";
  if (can(a, "dashboard.department")) return "/staff/department";
  if (can(a, "dashboard.admin")) return "/staff/admin";
  return "/staff/profile";
}
