import { prisma } from "@/server/db";
import { can, caseWhere, requirePerm, type Actor } from "@/server/access";

export type ReportRange = { from: Date; to: Date };

export function parseRange(sp: { from?: string; to?: string }): ReportRange {
  const to = sp.to ? new Date(`${sp.to}T23:59:59`) : new Date();
  const from = sp.from ? new Date(`${sp.from}T00:00:00`) : new Date(to.getTime() - 90 * 86400_000);
  return { from: isNaN(from.getTime()) ? new Date(Date.now() - 90 * 86400_000) : from, to: isNaN(to.getTime()) ? new Date() : to };
}

function countBy<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
}

/** Reports are limited to the cases the actor may see (department heads see their department only). */
export async function buildReport(actor: Actor, range: ReportRange) {
  requirePerm(actor, "report.view");
  const scope = can(actor, "case.view.all") || can(actor, "dashboard.admin") ? {} : caseWhere(actor);
  const cases = await prisma.case.findMany({
    where: { AND: [scope, { createdAt: { gte: range.from, lte: range.to } }] },
    select: {
      id: true, status: true, priority: true, createdAt: true, closedAt: true, deadline: true,
      category: { select: { name: true } }, department: { select: { name: true } }, subCity: { select: { name: true } },
    },
  });
  const now = new Date();
  const closed = cases.filter((c) => c.closedAt);
  const avgDays = closed.length ? closed.reduce((s, c) => s + (c.closedAt!.getTime() - c.createdAt.getTime()), 0) / closed.length / 86400_000 : null;
  const overdue = cases.filter((c) => c.deadline && c.deadline < now && !["CLOSED", "RESPONDED"].includes(c.status));

  // Department performance
  const deptMap = new Map<string, { name: string; assigned: number; completed: number; overdue: number; totalDays: number }>();
  for (const c of cases) {
    if (!c.department) continue;
    const d = deptMap.get(c.department.name) ?? { name: c.department.name, assigned: 0, completed: 0, overdue: 0, totalDays: 0 };
    d.assigned++;
    if (c.closedAt || c.status === "RESPONDED") {
      d.completed++;
      if (c.closedAt) d.totalDays += (c.closedAt.getTime() - c.createdAt.getTime()) / 86400_000;
    }
    if (overdue.includes(c)) d.overdue++;
    deptMap.set(c.department.name, d);
  }
  const departments = [...deptMap.values()].map((d) => ({ ...d, rate: d.assigned ? Math.round((d.completed / d.assigned) * 100) : 0, avgDays: d.completed ? +(d.totalDays / d.completed).toFixed(1) : null }));

  const fullAccess = can(actor, "case.view.all") || can(actor, "dashboard.admin");
  const appts = fullAccess || can(actor, "appointment.view")
    ? await prisma.appointment.findMany({ where: { startAt: { gte: range.from, lte: range.to } }, select: { status: true, official: { select: { fullName: true } } } })
    : [];
  const reservations = fullAccess
    ? await prisma.reservation.findMany({ where: { startAt: { gte: range.from, lte: range.to }, status: "APPROVED" }, select: { startAt: true, endAt: true, facility: { select: { name: true } } } })
    : [];
  const hoursByFacility = new Map<string, number>();
  for (const r of reservations) hoursByFacility.set(r.facility.name, (hoursByFacility.get(r.facility.name) ?? 0) + (r.endAt.getTime() - r.startAt.getTime()) / 3600_000);
  const workingDays = Math.max(1, Math.round(((range.to.getTime() - range.from.getTime()) / 86400_000) * (5 / 7)));

  const fb = fullAccess ? await prisma.feedback.findMany({ where: { createdAt: { gte: range.from, lte: range.to } }, select: { rating: true } }) : [];

  return {
    range,
    totals: { cases: cases.length, open: cases.length - closed.length, closed: closed.length, overdue: overdue.length, avgResolutionDays: avgDays == null ? null : +avgDays.toFixed(1) },
    byStatus: countBy(cases, (c) => c.status),
    byCategory: countBy(cases, (c) => c.category.name),
    byDepartment: countBy(cases, (c) => c.department?.name ?? "Not assigned"),
    bySubCity: countBy(cases, (c) => c.subCity?.name ?? "Not specified"),
    byPriority: countBy(cases, (c) => c.priority),
    departments,
    appointments: { total: appts.length, byStatus: countBy(appts, (a) => a.status), byOfficial: countBy(appts, (a) => a.official.fullName) },
    reservations: {
      total: reservations.length,
      utilization: [...hoursByFacility.entries()].map(([name, hours]) => ({ name, hours: +hours.toFixed(1), percent: Math.min(100, Math.round((hours / (workingDays * 9)) * 100)) })),
    },
    satisfaction: { responses: fb.length, average: fb.length ? +(fb.reduce((s, f) => s + f.rating, 0) / fb.length).toFixed(2) : null },
  };
}

export type Report = Awaited<ReturnType<typeof buildReport>>;
