import { requireActor } from "@/server/auth/session";
import { can } from "@/server/access";
import { listReservations } from "@/server/services/reservations";
import { activeFacilities } from "@/server/services/directory";
import { localInput, fmtDateTime, fmtTime } from "@/shared/format";
import { label } from "@/shared/constants";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Calendar, rangeFor, type CalView } from "@/components/Calendar";
import { Badge, Card, Empty, Field, PageHeader, Select } from "@/components/ui";
import * as act from "@/server/actions/operations";

export const metadata = { title: "Reservations" };

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; facilityId?: string }> }) {
  const a = await requireActor(["reservation.request", "reservation.manage"]);
  const sp = await searchParams;
  const view = (["day", "week", "month"].includes(sp.view ?? "") ? sp.view : "week") as CalView;
  const anchor = sp.date ? new Date(`${sp.date}T00:00:00`) : new Date();
  const { from, to } = rangeFor(view, anchor);
  const [facilities, booked, pending, mine] = await Promise.all([
    activeFacilities(),
    listReservations(a, { from, to, facilityId: sp.facilityId, all: true }),
    can(a, "reservation.manage") ? listReservations(a, { status: "PENDING" }) : Promise.resolve([]),
    listReservations(a, { from: new Date(Date.now() - 30 * 86400_000) }),
  ]);
  const nextHour = new Date();
  nextHour.setHours(nextHour.getHours() + 24, 0, 0, 0);
  const myOwn = mine.filter((r) => r.requestedById === a.id);
  return (
    <div className="space-y-6">
      <PageHeader title="Facility reservations" subtitle="Conference rooms, meeting rooms, halls and event spaces" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Availability">
            <form className="no-print mb-3 flex gap-2">
              <input type="hidden" name="view" value={view} />
              <Select name="facilityId" defaultValue={sp.facilityId} placeholder="All facilities" options={facilities.map((f) => ({ value: f.id, label: f.name }))} className="w-auto" />
              <button className="btn-navy">Show</button>
            </form>
            <Calendar
              view={view}
              anchor={anchor}
              basePath="/staff/reservations"
              query={{ facilityId: sp.facilityId }}
              events={booked.filter((r) => ["APPROVED", "PENDING"].includes(r.status)).map((r) => ({ id: r.id, title: r.title, sub: r.facility.name, start: r.startAt, end: r.endAt, status: r.status }))}
            />
          </Card>
          {can(a, "reservation.manage") && (
            <Card title={`Pending requests (${pending.length})`}>
              {!pending.length ? <Empty>No pending requests.</Empty> : (
                <ul className="divide-y divide-slate-100">
                  {pending.map((r) => (
                    <li key={r.id} className="grid gap-3 py-3 md:grid-cols-[1fr_auto]">
                      <div className="text-sm">
                        <p className="font-medium">{r.referenceNo} · {r.title}</p>
                        <p className="text-slate-600">{r.facility.name} · {fmtDateTime(r.startAt)}–{fmtTime(r.endAt)} · {r.attendees} people</p>
                        <p className="text-xs text-slate-500">Requested by {r.requestedBy.fullName}{r.purpose ? ` — ${r.purpose}` : ""}</p>
                      </div>
                      <ActionForm action={act.decideReservationAction.bind(null, r.id)} className="flex flex-wrap items-start gap-2">
                        <input name="note" placeholder="Note (required to reject)" className="input w-48" />
                        <SubmitButton name="decision" value="approve" className="btn-primary btn-sm">Approve</SubmitButton>
                        <SubmitButton name="decision" value="reject" className="btn-danger btn-sm">Reject</SubmitButton>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
        <div className="space-y-6">
          {can(a, "reservation.request") && (
            <Card title="Request a reservation">
              <ActionForm action={act.requestReservationAction} resetOnSuccess>
                <Field label="Facility"><Select name="facilityId" required placeholder="Choose…" options={facilities.map((f) => ({ value: f.id, label: `${f.name} (${f.capacity})` }))} /></Field>
                <Field label="Title"><input name="title" required className="input" /></Field>
                <Field label="Purpose"><textarea name="purpose" rows={2} className="input" /></Field>
                <Field label="Attendees"><input name="attendees" type="number" min={1} defaultValue={10} required className="input" /></Field>
                <Field label="Start"><input name="startAt" type="datetime-local" required min={localInput(new Date())} defaultValue={localInput(nextHour)} className="input" /></Field>
                <Field label="End"><input name="endAt" type="datetime-local" required className="input" /></Field>
                <SubmitButton>Request</SubmitButton>
              </ActionForm>
            </Card>
          )}
          <Card title="My reservations">
            {!myOwn.length ? <Empty>None.</Empty> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {myOwn.map((r) => (
                  <li key={r.id} className="py-2">
                    <div className="flex items-center justify-between gap-2"><span className="font-medium">{r.title}</span><Badge value={r.status} /></div>
                    <p className="text-xs text-slate-500">{r.facility.name} · {fmtDateTime(r.startAt)}</p>
                    {r.decisionNote && <p className="text-xs text-slate-600">{label("NOTE")}: {r.decisionNote}</p>}
                    {["PENDING", "APPROVED"].includes(r.status) && r.startAt > new Date() && (
                      <ActionForm action={act.cancelReservationAction.bind(null, r.id)} className="mt-1" confirm="Cancel this reservation?">
                        <SubmitButton className="btn-outline btn-sm">Cancel</SubmitButton>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
