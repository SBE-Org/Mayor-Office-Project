import { FileSpreadsheet } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { buildReport, parseRange } from "@/server/services/reports";
import { ymd } from "@/shared/format";
import { BarList, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const a = await requireActor("report.view");
  const sp = await searchParams;
  const range = parseRange(sp);
  const r = await buildReport(a, range);
  const qs = `from=${ymd(range.from)}&to=${ymd(range.to)}`;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & analytics"
        subtitle={`Period: ${range.from.toLocaleDateString("en-GB")} – ${range.to.toLocaleDateString("en-GB")}`}
        actions={
          <>
            <a href={`/api/reports/export?${qs}`} className="btn-primary"><FileSpreadsheet className="h-4 w-4" /> Export Excel</a>
            <PrintButton label="Print / PDF" />
          </>
        }
      />
      <form className="no-print card card-pad flex flex-wrap items-end gap-3">
        <label><span className="label">From</span><input type="date" name="from" defaultValue={ymd(range.from)} className="input" /></label>
        <label><span className="label">To</span><input type="date" name="to" defaultValue={ymd(range.to)} className="input" /></label>
        <button className="btn-navy">Apply</button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Cases received" value={r.totals.cases} />
        <Stat label="Open" value={r.totals.open} />
        <Stat label="Closed" value={r.totals.closed} tone="good" />
        <Stat label="Overdue" value={r.totals.overdue} tone={r.totals.overdue ? "danger" : "default"} />
        <Stat label="Avg. resolution (days)" value={r.totals.avgResolutionDays ?? "—"} />
      </div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card title="By status"><BarList rows={r.byStatus} /></Card>
        <Card title="By category"><BarList rows={r.byCategory} /></Card>
        <Card title="By priority"><BarList rows={r.byPriority} /></Card>
        <Card title="By department"><BarList rows={r.byDepartment} /></Card>
        <Card title="By sub-city"><BarList rows={r.bySubCity} /></Card>
        <Card title="Citizen satisfaction">
          {r.satisfaction.responses ? (
            <div><p className="text-4xl font-semibold text-brand-700">{r.satisfaction.average} / 5</p><p className="text-sm text-slate-500">{r.satisfaction.responses} rating(s)</p></div>
          ) : <Empty>No ratings in this period.</Empty>}
        </Card>
      </div>
      <Card title="Department performance">
        {!r.departments.length ? <Empty>No department assignments in this period.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Department</th><th>Assigned</th><th>Completed</th><th>Completion rate</th><th>Overdue</th><th>Avg. days to close</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {r.departments.map((d) => (
                  <tr key={d.name}><td className="font-medium">{d.name}</td><td>{d.assigned}</td><td>{d.completed}</td><td>{d.rate}%</td><td className={d.overdue ? "font-semibold text-red-700" : ""}>{d.overdue}</td><td>{d.avgDays ?? "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card title={`Appointments (${r.appointments.total})`}>
          <BarList rows={r.appointments.byStatus} />
          {r.appointments.byOfficial.length > 0 && <><h3 className="mb-2 mt-5 text-xs font-semibold uppercase text-slate-500">By official</h3><BarList rows={r.appointments.byOfficial} /></>}
        </Card>
        <Card title={`Facility utilisation (${r.reservations.total} approved bookings)`}>
          {!r.reservations.utilization.length ? <Empty>No approved reservations.</Empty> : (
            <ul className="space-y-2 text-sm">
              {r.reservations.utilization.map((u) => (
                <li key={u.name}>
                  <div className="flex justify-between"><span>{u.name}</span><span>{u.hours} h · {u.percent}%</span></div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-navy-600" style={{ width: `${u.percent}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">Utilisation assumes 9 working hours per weekday.</p>
        </Card>
      </div>
    </div>
  );
}
