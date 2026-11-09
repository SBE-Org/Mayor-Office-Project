import { requireActor } from "@/server/auth/session";
import { can } from "@/server/access";
import { prisma } from "@/server/db";
import { label } from "@/shared/constants";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, Field, PageHeader, Select, opts } from "@/components/ui";
import { saveDepartmentAction, saveSubCityAction } from "@/server/actions/admin";

export const metadata = { title: "Departments" };

export default async function DirectoryPage() {
  const a = await requireActor("department.view");
  const manage = can(a, "department.manage");
  const [depts, subs] = await Promise.all([
    prisma.department.findMany({ include: { subCity: true, _count: { select: { users: true, cases: true } } }, orderBy: [{ type: "asc" }, { name: "asc" }] }),
    prisma.subCity.findMany({ include: { _count: { select: { departments: true, cases: true } } }, orderBy: { name: "asc" } }),
  ]);
  const subOpts = subs.map((s) => ({ value: s.id, label: s.name }));
  return (
    <div className="space-y-6">
      <PageHeader title="Departments & sub-cities" subtitle="Directory of offices that receive and respond to cases. Entries must be confirmed by the Mayor's Office." />
      <Card title={`Departments and offices (${depts.length})`}>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Sub-city</th><th>Head</th><th>Contact</th><th>Staff</th><th>Cases</th><th>Status</th>{manage && <th />}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {depts.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono text-xs">{d.code}</td>
                  <td className="font-medium">{d.name}</td>
                  <td className="text-xs">{label(d.type)}</td>
                  <td className="text-xs">{d.subCity?.name ?? "—"}</td>
                  <td className="text-xs">{d.headName ?? "—"}</td>
                  <td className="text-xs">{[d.phone, d.email].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{d._count.users}</td>
                  <td>{d._count.cases}</td>
                  <td>{d.isActive ? "Active" : <span className="text-slate-400">Inactive</span>}</td>
                  {manage && (
                    <td>
                      <details>
                        <summary className="link cursor-pointer text-xs">Edit</summary>
                        <ActionForm action={saveDepartmentAction.bind(null, d.id)} className="mt-2 w-72 space-y-2">
                          <input name="code" defaultValue={d.code} className="input" />
                          <input name="name" defaultValue={d.name} className="input" />
                          <Select name="type" defaultValue={d.type} options={opts(["DEPARTMENT", "SUBCITY_ADMIN", "OFFICE"])} />
                          <Select name="subCityId" defaultValue={d.subCityId} placeholder="No sub-city" options={subOpts} />
                          <input name="headName" defaultValue={d.headName ?? ""} placeholder="Head" className="input" />
                          <input name="phone" defaultValue={d.phone ?? ""} placeholder="Phone" className="input" />
                          <input name="email" defaultValue={d.email ?? ""} placeholder="Email" className="input" />
                          <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="isActive" defaultChecked={d.isActive} /> Active</label>
                          <SubmitButton className="btn-primary btn-sm">Save</SubmitButton>
                        </ActionForm>
                      </details>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Sub-cities (${subs.length})`}>
          <ul className="divide-y divide-slate-100 text-sm">
            {subs.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><span className="font-mono text-xs text-slate-500">{s.code}</span> {s.name} {!s.isActive && <span className="text-slate-400">(inactive)</span>}</span>
                <span className="text-xs text-slate-500">{s._count.departments} offices · {s._count.cases} cases</span>
                {manage && (
                  <details className="w-full">
                    <summary className="link cursor-pointer text-xs">Edit</summary>
                    <ActionForm action={saveSubCityAction.bind(null, s.id)} className="mt-2 flex flex-wrap items-center gap-2">
                      <input name="code" defaultValue={s.code} className="input w-28" />
                      <input name="name" defaultValue={s.name} className="input w-48" />
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="isActive" defaultChecked={s.isActive} /> Active</label>
                      <SubmitButton className="btn-primary btn-sm">Save</SubmitButton>
                    </ActionForm>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </Card>
        {manage && (
          <div className="space-y-6">
            <Card title="Add department / office">
              <ActionForm action={saveDepartmentAction.bind(null, null)} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
                <Field label="Code"><input name="code" required className="input" /></Field>
                <Field label="Type"><Select name="type" options={opts(["DEPARTMENT", "SUBCITY_ADMIN", "OFFICE"])} /></Field>
                <Field label="Name" className="sm:col-span-2"><input name="name" required className="input" /></Field>
                <Field label="Sub-city"><Select name="subCityId" placeholder="—" options={subOpts} /></Field>
                <Field label="Head"><input name="headName" className="input" /></Field>
                <Field label="Phone"><input name="phone" className="input" /></Field>
                <Field label="Email"><input name="email" type="email" className="input" /></Field>
                <div className="sm:col-span-2"><SubmitButton>Add</SubmitButton></div>
              </ActionForm>
            </Card>
            <Card title="Add sub-city">
              <ActionForm action={saveSubCityAction.bind(null, null)} resetOnSuccess className="flex flex-wrap items-end gap-2">
                <Field label="Code"><input name="code" required className="input w-28" /></Field>
                <Field label="Name"><input name="name" required className="input w-56" /></Field>
                <SubmitButton>Add</SubmitButton>
              </ActionForm>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
