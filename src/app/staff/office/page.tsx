import Link from "next/link";
import { AlertTriangle, CalendarClock, DoorOpen, FileInput, Inbox, Mail, Send, UserCheck } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { can, caseWhere, appointmentWhere } from "@/server/access";
import { Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { CaseTable } from "@/components/CaseTable";
import { fmtTime, startOfDay, addDays } from "@/shared/format";

export const metadata = { title: "Office dashboard" };

export default async function OfficeDashboard() {
  const a = await requireActor("dashboard.office");
  const scope = caseWhere(a);
  const today = startOfDay(new Date());
  const now = new Date();
  const count = (extra: object) => prisma.case.count({ where: { AND: [scope, extra] } });

  const [toVerify, inReview, infoReq, awaitingExec, decided, responded, overdue] = await Promise.all([
    count({ status: "SUBMITTED" }),
    count({ status: { in: ["REGISTERED", "UNDER_REVIEW"] } }),
    count({ status: "INFO_REQUESTED" }),
    count({ status: "AWAITING_EXECUTIVE" }),
    count({ status: "DECIDED" }),
    count({ status: "RESPONDED" }),
    count({ deadline: { lt: now }, status: { in: ["ASSIGNED", "IN_PROGRESS"] } }),
  ]);
  const showAppts = can(a, "appointment.view") || can(a, "appointment.walkin");
  const [pendingAppts, todayAppts] = showAppts
    ? await Promise.all([
        prisma.appointment.count({ where: { AND: [appointmentWhere(a), { status: "REQUESTED" }] } }),
        prisma.appointment.findMany({ where: { AND: [appointmentWhere(a), { status: "APPROVED", startAt: { gte: today, lt: addDays(today, 1) } }] }, include: { citizen: true, official: true }, orderBy: { startAt: "asc" } }),
      ])
    : [0, []];
  const pendingRes = can(a, "reservation.manage") ? await prisma.reservation.count({ where: { status: "PENDING" } }) : 0;
  const corrPending = can(a, "correspondence.view") ? await prisma.correspondence.count({ where: { status: { in: ["REGISTERED", "UNDER_REVIEW"] } } }) : 0;
  const actionNeeded = can(a, "case.review") || can(a, "case.register")
    ? await prisma.case.findMany({
        where: { AND: [scope, { status: { in: can(a, "case.review") ? ["SUBMITTED", "REGISTERED", "UNDER_REVIEW", "DECIDED", "RESPONDED"] : ["SUBMITTED"] } }] },
        include: { citizen: true, category: true, department: true, executive: true },
        orderBy: { createdAt: "asc" },
        take: 15,
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mayor's Office administration"
        subtitle={`${a.fullName} · ${a.roleName}`}
        actions={
          <>
            {can(a, "case.register") && <Link href="/staff/cases/new" className="btn-primary"><FileInput className="h-4 w-4" /> Register case</Link>}
            {can(a, "appointment.walkin") && <Link href="/staff/appointments/new" className="btn-navy"><UserCheck className="h-4 w-4" /> Walk-in visitor</Link>}
          </>
        }
      />
      {(can(a, "case.register") || can(a, "case.review")) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Online submissions to verify" value={toVerify} tone={toVerify ? "warn" : "default"} href="/staff/cases?status=SUBMITTED" icon={<Inbox className="h-5 w-5" />} />
          {can(a, "case.review") && <Stat label="Registered / under review" value={inReview} href="/staff/cases?status=UNDER_REVIEW" />}
          {can(a, "case.review") && <Stat label="Executive decision returned" value={decided} tone={decided ? "warn" : "default"} href="/staff/cases?status=DECIDED" />}
          {can(a, "case.review") && <Stat label="Department responses to verify" value={responded} tone={responded ? "warn" : "default"} href="/staff/cases?status=RESPONDED" />}
          {can(a, "case.review") && <Stat label="Awaiting executive" value={awaitingExec} href="/staff/cases?status=AWAITING_EXECUTIVE" icon={<Send className="h-5 w-5" />} />}
          {can(a, "case.review") && <Stat label="Waiting on citizen" value={infoReq} href="/staff/cases?status=INFO_REQUESTED" />}
          {can(a, "case.review") && <Stat label="Overdue at departments" value={overdue} tone={overdue ? "danger" : "default"} href="/staff/cases?overdue=1" icon={<AlertTriangle className="h-5 w-5" />} />}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {showAppts && <Stat label="Appointment requests" value={pendingAppts} tone={pendingAppts ? "warn" : "default"} href="/staff/appointments?status=REQUESTED" icon={<CalendarClock className="h-5 w-5" />} />}
        {can(a, "reservation.manage") && <Stat label="Reservation requests" value={pendingRes} href="/staff/reservations" icon={<DoorOpen className="h-5 w-5" />} />}
        {can(a, "correspondence.view") && <Stat label="Correspondence in progress" value={corrPending} href="/staff/correspondence" icon={<Mail className="h-5 w-5" />} />}
      </div>

      {actionNeeded.length > 0 && (
        <Card title="Cases needing office action" actions={<Link href="/staff/cases" className="link text-xs">All cases</Link>}>
          <CaseTable rows={actionNeeded} />
        </Card>
      )}

      {showAppts && (
        <Card title="Today's visitors" actions={<Link href="/staff/appointments?view=day" className="link text-xs">Day view</Link>}>
          {!todayAppts.length ? <Empty>No approved appointments today.</Empty> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {todayAppts.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span><b>{fmtTime(p.startAt)}</b> · {p.citizen.fullName} → {p.official.fullName}</span>
                  {p.checkedInAt ? <Badge value="COMPLETED" text="Checked in" /> : <Link href={`/staff/appointments/${p.id}`} className="btn-outline btn-sm">Check in</Link>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
