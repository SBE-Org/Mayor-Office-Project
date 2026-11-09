import Link from "next/link";
import { CalendarPlus, FilePlus2 } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { listCases } from "@/server/services/cases";
import { listAppointments } from "@/server/services/appointments";
import { getDict } from "@/server/i18n";
import { catName } from "@/shared/localize";
import { fmtDate, fmtDateTime } from "@/shared/format";
import { Badge, Card, Empty } from "@/components/ui";

export default async function PortalHome() {
  const a = await requireActor("portal.citizen");
  const { t, lang } = await getDict();
  const [cases, appts] = await Promise.all([listCases(a, { take: 50 }), listAppointments(a, { from: new Date(Date.now() - 86400_000) })]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{t.welcome},</p>
          <h1 className="text-2xl font-semibold">{a.fullName}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/portal/cases/new" className="btn-primary"><FilePlus2 className="h-4 w-4" /> {t.newCase}</Link>
          <Link href="/portal/appointments/new" className="btn-navy"><CalendarPlus className="h-4 w-4" /> {t.newAppointment}</Link>
        </div>
      </div>
      <Card title={t.myCases}>
        {!cases.length ? <Empty>{t.none}</Empty> : (
          <ul className="divide-y divide-slate-100">
            {cases.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <Link href={`/portal/cases/${c.id}`} className="font-medium text-slate-900 hover:underline">{c.title}</Link>
                  <p className="text-xs text-slate-500"><span className="font-mono">{c.referenceNo}</span> · {catName(c.category, lang)} · {t.submitted} {fmtDate(c.createdAt)}</p>
                </div>
                <Badge value={c.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={t.myAppointments} actions={<Link href="/portal/appointments" className="link text-xs">{t.view}</Link>}>
        {!appts.length ? <Empty>{t.none}</Empty> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {appts.slice(0, 5).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{fmtDateTime(p.startAt)} · {p.official.fullName}</span>
                <Badge value={p.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
