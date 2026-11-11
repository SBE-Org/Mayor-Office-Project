import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { officialLabel } from "@/server/services/appointments";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, Empty, PageHeader } from "@/components/ui";
import { setAppointmentOfficialAction } from "@/server/actions/operations";

export const metadata = { title: "Appointment officials" };

export default async function AppointmentOfficialsPage() {
  await requireActor("user.manage");
  const staff = await prisma.user.findMany({
    where: { isActive: true, role: { code: { not: "CITIZEN" } } },
    include: { role: true, department: true },
    orderBy: [{ acceptsAppointments: "desc" }, { appointmentOrder: "asc" }, { fullName: "asc" }],
  });
  const listed = staff.filter((u) => u.acceptsAppointments);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointment officials"
        subtitle="Choose who citizens can request an appointment with, and how each one appears in the “Official” drop-down (for example Mayor, Deputy Mayor – Economic Affairs, Head of Mayor's Office)."
      />

      <Card title={`What citizens see (${listed.length})`}>
        {!listed.length ? (
          <Empty>No officials are listed yet, so the citizen drop-down is empty. Tick “Show to citizens” for at least one person below.</Empty>
        ) : (
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {listed.map((u) => (
              <li key={u.id}>
                <span className="font-medium">{officialLabel(u)}</span> <span className="text-xs text-slate-500">— {u.fullName}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card title="Staff">
        <div className="hidden grid-cols-[1fr_8rem_18rem_5rem_5rem] gap-3 border-b border-slate-100 pb-2 text-xs font-semibold uppercase text-slate-500 lg:grid">
          <span>Staff member</span><span>Show to citizens</span><span>Label in the drop-down</span><span>Order</span><span />
        </div>
        <ul className="divide-y divide-slate-100">
          {staff.map((u) => (
            <li key={u.id} className="py-3">
              <ActionForm action={setAppointmentOfficialAction.bind(null, u.id)} className="grid items-center gap-3 lg:grid-cols-[1fr_8rem_18rem_5rem_5rem]">
                <div>
                  <p className="font-medium">{u.fullName}</p>
                  <p className="text-xs text-slate-500">{u.role.name}{u.department ? ` · ${u.department.name}` : ""}{u.title ? ` · ${u.title}` : ""}</p>
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="acceptsAppointments" defaultChecked={u.acceptsAppointments} className="h-4 w-4 accent-brand-600" /><span className="lg:hidden">Show to citizens</span></label>
                <input name="appointmentLabel" defaultValue={u.appointmentLabel ?? ""} placeholder={u.title || u.role.name} aria-label="Label in the drop-down" className="input" />
                <input name="appointmentOrder" type="number" min={0} max={999} defaultValue={u.appointmentOrder} aria-label="Order" className="input" />
                <SubmitButton className="btn-primary btn-sm">Save</SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">If the label is left empty, the person&apos;s position title is used, otherwise their role. Lower order numbers appear first.</p>
      </Card>
    </div>
  );
}
