import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/access";
import { getAppointment } from "@/server/services/appointments";
import { NotFoundError } from "@/server/errors";
import { label } from "@/shared/constants";
import { fmtDateTime, fmtTime, ymd } from "@/shared/format";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Badge, Card, DL, Field, PageHeader } from "@/components/ui";
import * as act from "@/server/actions/operations";

export const metadata = { title: "Appointment" };

export default async function AppointmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const a = await requireActor();
  const { id } = await params;
  let p;
  try {
    p = await getAppointment(a, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const manage = can(a, "appointment.manage") || (can(a, "appointment.own") && p.officialId === a.id);
  const active = ["REQUESTED", "APPROVED"].includes(p.status);
  const isToday = ymd(p.startAt) === ymd(new Date());
  return (
    <div className="max-w-5xl">
      <PageHeader title={`Appointment ${p.referenceNo}`} subtitle={`${p.citizen.fullName} with ${p.official.fullName}`} actions={<Link href="/staff/appointments" className="btn-outline">Back</Link>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Details">
            <div className="mb-4"><Badge value={p.status} /></div>
            <DL
              items={[
                ["When", `${fmtDateTime(p.startAt)} – ${fmtTime(p.endAt)}`],
                ["Official", `${p.official.fullName}${p.official.title ? ` (${p.official.title})` : ""}`],
                ["Visitor", `${p.citizen.fullName} · ${p.citizen.phone}`],
                ["Category", label(p.category)],
                ["Channel", label(p.channel)],
                ["Checked in", fmtDateTime(p.checkedInAt)],
                ["Decision note", p.decisionNote ?? "—"],
                ["Decided", fmtDateTime(p.decidedAt)],
              ]}
            />
            <h3 className="mt-4 text-xs font-semibold uppercase text-slate-500">Purpose</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm">{p.purpose}</p>
            {p.outcome && (<><h3 className="mt-4 text-xs font-semibold uppercase text-slate-500">Meeting outcome</h3><p className="mt-1 whitespace-pre-wrap text-sm">{p.outcome}</p></>)}
            {p.followUp && (<><h3 className="mt-4 text-xs font-semibold uppercase text-slate-500">Follow-up actions</h3><p className="mt-1 whitespace-pre-wrap text-sm">{p.followUp}</p></>)}
          </Card>
        </div>
        <aside className="space-y-4">
          {manage && p.status === "REQUESTED" && (
            <Card title="Decision">
              <ActionForm action={act.decideAppointmentAction.bind(null, p.id)}>
                <Field label="Note to citizen" hint="Required when rejecting"><textarea name="note" rows={2} className="input" /></Field>
                <div className="flex gap-2">
                  <SubmitButton name="decision" value="approve">Approve</SubmitButton>
                  <SubmitButton name="decision" value="reject" className="btn-danger">Reject</SubmitButton>
                </div>
              </ActionForm>
            </Card>
          )}
          {(can(a, "appointment.walkin") || can(a, "appointment.manage")) && p.status === "APPROVED" && !p.checkedInAt && isToday && (
            <Card title="Reception">
              <ActionForm action={act.checkInAction.bind(null, p.id)}>
                <SubmitButton className="btn-navy">Check in visitor</SubmitButton>
              </ActionForm>
            </Card>
          )}
          {manage && active && (
            <Card title="Reschedule">
              <ActionForm action={act.rescheduleAppointmentAction.bind(null, p.id)}>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Date"><input type="date" name="date" required min={ymd(new Date())} defaultValue={ymd(p.startAt)} className="input" /></Field>
                  <Field label="Time"><input type="time" name="time" required step={1800} defaultValue={fmtTime(p.startAt)} className="input" /></Field>
                </div>
                <Field label="Duration"><select name="duration" defaultValue={String((+p.endAt - +p.startAt) / 60000)} className="input"><option value="30">30 minutes</option><option value="60">60 minutes</option></select></Field>
                <Field label="Reason (sent to citizen)"><input name="note" required className="input" /></Field>
                <SubmitButton className="btn-outline">Reschedule</SubmitButton>
              </ActionForm>
            </Card>
          )}
          {manage && p.status === "APPROVED" && (
            <Card title="Record outcome">
              <ActionForm action={act.completeAppointmentAction.bind(null, p.id)}>
                <Field label="Meeting outcome"><textarea name="outcome" rows={3} className="input" /></Field>
                <Field label="Follow-up actions"><textarea name="followUp" rows={2} className="input" /></Field>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="noShow" /> Visitor did not attend</label>
                <SubmitButton>Save outcome</SubmitButton>
              </ActionForm>
            </Card>
          )}
          {can(a, "appointment.manage") && active && (
            <Card title="Cancel">
              <ActionForm action={act.cancelAppointmentAction.bind(null, p.id)} confirm="Cancel this appointment? The citizen will be notified.">
                <Field label="Reason"><input name="note" required className="input" /></Field>
                <SubmitButton className="btn-danger">Cancel appointment</SubmitButton>
              </ActionForm>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
