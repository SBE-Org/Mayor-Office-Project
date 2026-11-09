import Link from "next/link";
import { AlertTriangle, CalendarCheck, CheckCircle2, Clock, FolderOpen, Inbox, Lock, Paperclip, Timer } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { can, caseWhere } from "@/server/access";
import { Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { fmtDateTime, fmtTime, startOfDay, addDays } from "@/shared/format";

export const metadata = { title: "Executive dashboard" };

export default async function ExecutiveDashboard() {
  const a = await requireActor("dashboard.executive");
  const scope = caseWhere(a);
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const now = new Date();
  const isMayor = can(a, "case.view.all");

  const count = (extra: object) => prisma.case.count({ where: { AND: [scope, extra] } });
  const [total, todayCount, awaitingMine, urgent, assigned, overdue, closed] = await Promise.all([
    count({}),
    count({ createdAt: { gte: today } }),
    prisma.case.count({ where: { status: "AWAITING_EXECUTIVE", executiveId: a.id } }),
    count({ status: { not: "CLOSED" }, OR: [{ priority: "URGENT" }, { confidentiality: { not: "NORMAL" } }] }),
    count({ status: { in: ["ASSIGNED", "IN_PROGRESS"] } }),
    count({ deadline: { lt: now }, status: { in: ["ASSIGNED", "IN_PROGRESS"] } }),
    count({ status: "CLOSED" }),
  ]);
  const pendingDecisions = isMayor ? await prisma.case.count({ where: { status: "AWAITING_EXECUTIVE" } }) : awaitingMine;

  const queue = await prisma.case.findMany({
    where: { status: "AWAITING_EXECUTIVE", executiveId: a.id },
    include: {
      citizen: true, category: true, department: true,
      forwardings: { where: { toUserId: a.id }, orderBy: { createdAt: "desc" }, take: 1, include: { fromUser: true } },
      _count: { select: { documents: true, actions: true } },
    },
    orderBy: { updatedAt: "asc" },
  });
  const rank: Record<string, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
  queue.sort((x, y) => (rank[x.priority] ?? 9) - (rank[y.priority] ?? 9));
  const othersQueue = isMayor
    ? await prisma.case.findMany({ where: { status: "AWAITING_EXECUTIVE", executiveId: { not: a.id } }, include: { executive: true, category: true }, orderBy: { updatedAt: "asc" } })
    : [];
  const appointments = await prisma.appointment.findMany({
    where: { officialId: a.id, status: "APPROVED", startAt: { gte: today, lt: tomorrow } },
    include: { citizen: true },
    orderBy: { startAt: "asc" },
  });
  const upcoming = await prisma.appointment.findMany({
    where: { officialId: a.id, status: { in: ["APPROVED", "REQUESTED"] }, startAt: { gte: tomorrow, lt: addDays(today, 8) } },
    include: { citizen: true },
    orderBy: { startAt: "asc" },
    take: 8,
  });
  const meetings = await prisma.reservation.findMany({
    where: { status: "APPROVED", startAt: { gte: today, lt: addDays(today, 8) } },
    include: { facility: true },
    orderBy: { startAt: "asc" },
    take: 6,
  });

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${a.fullName}`} subtitle={a.title ?? a.roleName} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Requiring my attention" value={awaitingMine} tone={awaitingMine ? "warn" : "default"} icon={<Inbox className="h-5 w-5" />} />
        <Stat label={isMayor ? "Pending executive decisions (all)" : "Pending decisions"} value={pendingDecisions} icon={<Clock className="h-5 w-5" />} />
        <Stat label="Urgent / confidential open" value={urgent} tone={urgent ? "danger" : "default"} href="/staff/cases?priority=URGENT" icon={<Lock className="h-5 w-5" />} />
        <Stat label="Today's appointments" value={appointments.length} href="/staff/appointments?view=day" icon={<CalendarCheck className="h-5 w-5" />} />
        <Stat label={isMayor ? "Total cases" : "Cases forwarded to me"} value={total} href="/staff/cases" icon={<FolderOpen className="h-5 w-5" />} />
        <Stat label="Received today" value={todayCount} icon={<Inbox className="h-5 w-5" />} />
        <Stat label="With departments" value={assigned} href="/staff/cases?status=ASSIGNED" icon={<Timer className="h-5 w-5" />} />
        <Stat label="Overdue" value={overdue} tone={overdue ? "danger" : "default"} href="/staff/cases?overdue=1" icon={<AlertTriangle className="h-5 w-5" />} />
        <Stat label="Completed" value={closed} tone="good" href="/staff/cases?status=CLOSED" icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      <Card title={`Cases requiring ${isMayor ? "the Mayor's" : "my"} attention (${queue.length})`}>
        {!queue.length ? (
          <Empty>No cases are waiting for your decision.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {queue.map((c) => {
              const f = c.forwardings[0];
              return (
                <li key={c.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">{c.referenceNo}</span>
                        <Badge value={c.priority} kind="priority" />
                        {c.confidentiality !== "NORMAL" && <Badge value={c.confidentiality} kind="conf" />}
                        <span className="text-xs text-slate-500">{c.category.name}</span>
                      </div>
                      <h3 className="mt-1 font-semibold text-slate-900">{c.title}</h3>
                      <p className="text-sm text-slate-600">Citizen: {c.citizen.fullName} · Responsible: {c.department?.name ?? "Mayor's Office"}</p>
                      <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
                        <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs font-semibold uppercase text-slate-500">Summary</p><p>{f?.summary ?? c.description.slice(0, 200)}</p></div>
                        <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs font-semibold uppercase text-slate-500">Reviewing officer&apos;s assessment</p><p>{c.assessment ?? "—"}</p></div>
                        <div className="rounded-lg bg-brand-50 p-2"><p className="text-xs font-semibold uppercase text-brand-800">Recommended action</p><p>{f?.recommendedAction ?? c.recommendation ?? "—"}</p></div>
                      </div>
                      <p className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>Forwarded by {f?.fromUser.fullName ?? "—"} on {fmtDateTime(f?.createdAt)}</span>
                        <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" /> {c._count.documents} document(s)</span>
                        <span>{c._count.actions} recorded actions</span>
                      </p>
                    </div>
                    <Link href={`/staff/cases/${c.id}#decide`} className="btn-primary">Review &amp; decide</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {isMayor && othersQueue.length > 0 && (
        <Card title="Forwarded to Deputy Mayors / other officials">
          <ul className="divide-y divide-slate-100 text-sm">
            {othersQueue.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/staff/cases/${c.id}`} className="link">{c.referenceNo} — {c.title}</Link>
                <span className="text-xs text-slate-500">with {c.executive?.fullName}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Today's appointments" actions={<Link href="/staff/appointments" className="link text-xs">Calendar</Link>}>
          {!appointments.length ? <Empty>No appointments today.</Empty> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {appointments.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 py-2">
                  <div><p className="font-medium">{fmtTime(p.startAt)}–{fmtTime(p.endAt)} · {p.citizen.fullName}</p><p className="text-slate-600">{p.purpose}</p></div>
                  {p.checkedInAt ? <span className="badge bg-brand-100 text-brand-800">Arrived</span> : <Link href={`/staff/appointments/${p.id}`} className="link text-xs">Open</Link>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Upcoming (next 7 days)">
          {!upcoming.length && !meetings.length ? <Empty>Nothing scheduled.</Empty> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {upcoming.map((p) => (
                <li key={p.id} className="flex justify-between gap-2 py-2">
                  <Link href={`/staff/appointments/${p.id}`} className="hover:underline">{fmtDateTime(p.startAt)} · Appointment: {p.citizen.fullName}</Link>
                  <Badge value={p.status} />
                </li>
              ))}
              {meetings.map((m) => (
                <li key={m.id} className="flex justify-between gap-2 py-2">
                  <span>{fmtDateTime(m.startAt)} · {m.title}</span>
                  <span className="text-xs text-slate-500">{m.facility.name}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
