import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { listAppointments } from "@/server/services/appointments";
import { getDict } from "@/server/i18n";
import { statusName } from "@/shared/localize";
import { fmtDateTime, fmtTime } from "@/shared/format";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Badge, Card, Empty } from "@/components/ui";
import { cancelAppointmentAction } from "@/server/actions/operations";

export default async function CitizenAppointments({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const a = await requireActor("portal.citizen");
  const { t, lang } = await getDict();
  const sp = await searchParams;
  const list = await listAppointments(a);
  const now = new Date();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t.myAppointments}</h1>
        <Link href="/portal/appointments/new" className="btn-primary">{t.newAppointment}</Link>
      </div>
      {sp.new && <p className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-900">✓ {statusName("REQUESTED", lang)}</p>}
      <Card>
        {!list.length ? <Empty>{t.none}</Empty> : (
          <ul className="divide-y divide-slate-100">
            {[...list].reverse().map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="text-sm">
                  <p className="font-medium">{fmtDateTime(p.startAt)}–{fmtTime(p.endAt)} · {p.official.fullName}</p>
                  <p className="text-slate-600">{p.purpose}</p>
                  <p className="font-mono text-xs text-slate-400">{p.referenceNo}</p>
                  {p.decisionNote && <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-xs text-slate-700">{p.decisionNote}</p>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge value={p.status} text={statusName(p.status, lang)} />
                  {["REQUESTED", "APPROVED"].includes(p.status) && p.startAt > now && (
                    <ActionForm action={cancelAppointmentAction.bind(null, p.id)} confirm={`${t.cancel}?`}>
                      <SubmitButton className="btn-outline btn-sm">{t.cancel}</SubmitButton>
                    </ActionForm>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
