import { requireActor } from "@/server/auth/session";
import { can } from "@/server/access";
import { officials } from "@/server/services/appointments";
import { locationTree } from "@/server/services/directory";
import { LocationPicker } from "@/components/LocationPicker";
import { APPOINTMENT_CATEGORIES } from "@/shared/constants";
import { ymd } from "@/shared/format";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { SlotPicker } from "@/components/SlotPicker";
import { Card, Field, PageHeader, Select, opts } from "@/components/ui";
import { requestAppointmentAction } from "@/server/actions/operations";

export const metadata = { title: "Book appointment" };

export default async function NewStaffAppointment() {
  const a = await requireActor("appointment.walkin");
  const [offs, tree] = await Promise.all([officials(), locationTree()]);
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Book an appointment for a visitor"
        subtitle={can(a, "appointment.manage") ? "Bookings you make are confirmed immediately." : "Bookings are sent to the Secretary / Head of Office for approval."}
      />
      <ActionForm action={requestAppointmentAction} className="space-y-6">
        <Card title="Visitor">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><input name="fullName" required minLength={3} className="input" /></Field>
            <Field label="Phone number"><input name="phone" required className="input" /></Field>
            <Field label="Email (optional)"><input name="email" type="email" className="input" /></Field>
            <LocationPicker tree={tree} />
          </div>
        </Card>
        <Card title="Appointment">
          <div className="space-y-4">
            <SlotPicker
              minDate={ymd(new Date())}
              officials={offs.map((o) => ({ id: o.id, name: o.label, title: o.fullName }))}
              labels={{ official: "Official", date: "Date", duration: "Duration", minutes: "minutes", availableSlots: "Available times", noSlots: "No free times on this day (Mon–Fri, 8:00–17:00)." }}
            />
            <Field label="Category"><Select name="category" options={opts(APPOINTMENT_CATEGORIES)} /></Field>
            <Field label="Purpose"><textarea name="purpose" rows={3} required minLength={10} className="input" /></Field>
          </div>
        </Card>
        <SubmitButton>Book appointment</SubmitButton>
      </ActionForm>
    </div>
  );
}
