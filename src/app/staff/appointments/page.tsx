import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/access";
import { listAppointments, officials } from "@/server/services/appointments";
import { APPOINTMENT_STATUSES, label } from "@/shared/constants";
import { Calendar, rangeFor, type CalView } from "@/components/Calendar";
import { Badge, Card, Empty, PageHeader, Select, opts } from "@/components/ui";
import { fmtDateTime } from "@/shared/format";

export const metadata = { title: "Appointments" };

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; officialId?: string; status?: string }> }) {
  const a = await requireActor(["appointment.view", "appointment.manage", "appointment.own", "appointment.walkin"]);
  const sp = await searchParams;
  const view = (["day", "week", "month"].includes(sp.view ?? "") ? sp.view : "week") as CalView;
  const anchor = sp.date && !isNaN(new Date(sp.date).getTime()) ? new Date(`${sp.date}T00:00:00`) : new Date();
  const { from, to } = rangeFor(view, anchor);
  const [events, offs, requests] = await Promise.all([
    listAppointments(a, { from, to, officialId: sp.officialId, status: sp.status }),
    officials(),
    listAppointments(a, { status: "REQUESTED", from: new Date() }),
  ]);
  const shown = events.filter((e) => !["CANCELLED", "REJECTED"].includes(e.status) || sp.status);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        subtitle={can(a, "appointment.view") ? "Calendars of the Mayor, Deputy Mayors and authorised officials" : "Your appointment calendar"}
        actions={can(a, "appointment.walkin") ? <Link href="/staff/appointments/new" className="btn-primary">Book / walk-in visitor</Link> : null}
      />
      {(can(a, "appointment.manage") || can(a, "appointment.own")) && (
        <Card title={`Requests awaiting decision (${requests.length})`}>
          {!requests.length ? <Empty>No pending requests.</Empty> : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Ref</th><th>When</th><th>Citizen</th><th>Official</th><th>Purpose</th><th /></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono text-xs">{r.referenceNo}</td>
                      <td className="whitespace-nowrap">{fmtDateTime(r.startAt)}</td>
                      <td>{r.citizen.fullName}</td>
                      <td>{r.official.fullName}</td>
                      <td className="max-w-xs text-slate-600">{label(r.category)} — {r.purpose}</td>
                      <td><Link href={`/staff/appointments/${r.id}`} className="btn-outline btn-sm">Review</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      <Card>
        <form className="no-print mb-4 flex flex-wrap gap-2">
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="date" value={sp.date ?? ""} />
          {(can(a, "appointment.view") || can(a, "appointment.manage")) && (
            <Select name="officialId" defaultValue={sp.officialId} placeholder="All officials" options={offs.map((o) => ({ value: o.id, label: `${o.label} — ${o.fullName}` }))} className="w-auto" />
          )}
          <Select name="status" defaultValue={sp.status} placeholder="Active statuses" options={opts(APPOINTMENT_STATUSES)} className="w-auto" />
          <button className="btn-navy">Apply</button>
        </form>
        <Calendar
          view={view}
          anchor={anchor}
          basePath="/staff/appointments"
          query={{ officialId: sp.officialId, status: sp.status }}
          events={shown.map((e) => ({ id: e.id, title: e.citizen.fullName, sub: `${e.official.fullName} · ${label(e.status)}`, start: e.startAt, end: e.endAt, status: e.status, href: `/staff/appointments/${e.id}` }))}
        />
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><Badge value="APPROVED" /> confirmed</span>
          <span className="flex items-center gap-1"><Badge value="REQUESTED" /> awaiting decision</span>
        </div>
      </Card>
    </div>
  );
}
