import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { FACILITY_TYPES, label } from "@/shared/constants";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, Field, PageHeader, Select, opts } from "@/components/ui";
import { saveFacilityAction } from "@/server/actions/admin";

export const metadata = { title: "Facilities" };

export default async function FacilitiesPage() {
  await requireActor("facility.manage");
  const [facilities, managers] = await Promise.all([
    prisma.facility.findMany({ include: { manager: true, _count: { select: { reservations: true } } }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { isActive: true, role: { permissions: { some: { permission: { code: "reservation.manage" } } } } }, orderBy: { fullName: "asc" } }),
  ]);
  const mOpts = managers.map((m) => ({ value: m.id, label: m.fullName }));
  const fields = (f?: (typeof facilities)[number]) => (
    <>
      <Field label="Name"><input name="name" required defaultValue={f?.name} className="input" /></Field>
      <Field label="Type"><Select name="type" defaultValue={f?.type} options={opts(FACILITY_TYPES)} /></Field>
      <Field label="Capacity"><input name="capacity" type="number" min={1} required defaultValue={f?.capacity ?? 10} className="input" /></Field>
      <Field label="Location"><input name="location" defaultValue={f?.location ?? ""} className="input" /></Field>
      <Field label="Calendar manager" hint="Receives reservation requests; otherwise all reservation managers do"><Select name="managerId" defaultValue={f?.managerId} placeholder="—" options={mOpts} /></Field>
      <Field label="Description"><input name="description" defaultValue={f?.description ?? ""} className="input" /></Field>
    </>
  );
  return (
    <div className="space-y-6">
      <PageHeader title="Reservable facilities" subtitle="Rooms and spaces that can be reserved, and who controls each calendar." />
      <Card title="Facilities">
        <ul className="divide-y divide-slate-100">
          {facilities.map((f) => (
            <li key={f.id} className="py-3">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span><b>{f.name}</b> · {label(f.type)} · {f.capacity} people {!f.isActive && <span className="text-slate-400">(inactive)</span>}</span>
                <span className="text-xs text-slate-500">{f.location ?? ""} · manager: {f.manager?.fullName ?? "any reservation manager"} · {f._count.reservations} bookings</span>
              </div>
              <details className="mt-1">
                <summary className="link cursor-pointer text-xs">Edit</summary>
                <ActionForm action={saveFacilityAction.bind(null, f.id)} className="mt-2 grid gap-3 sm:grid-cols-3">
                  {fields(f)}
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={f.isActive} /> Active</label>
                  <div className="sm:col-span-3"><SubmitButton className="btn-primary btn-sm">Save</SubmitButton></div>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Add facility">
        <ActionForm action={saveFacilityAction.bind(null, null)} resetOnSuccess className="grid gap-3 sm:grid-cols-3">
          {fields()}
          <div className="sm:col-span-3"><SubmitButton>Add facility</SubmitButton></div>
        </ActionForm>
      </Card>
    </div>
  );
}
