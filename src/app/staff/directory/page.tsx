import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/access";
import { prisma } from "@/server/db";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, Field, PageHeader } from "@/components/ui";
import { SubCityMayorFields } from "@/components/SubCityMayorFields";
import { saveDepartmentAction } from "@/server/actions/admin";

export const metadata = { title: "Departments / offices" };

export default async function DirectoryPage() {
  const a = await requireActor("department.view");
  const manage = can(a, "department.manage");
  const [depts, subs] = await Promise.all([
    prisma.department.findMany({ include: { subCity: true, _count: { select: { users: true, cases: true } } }, orderBy: [{ code: "asc" }] }),
    prisma.subCity.findMany({ orderBy: { name: "asc" } }),
  ]);
  const allSubs = subs.map((s) => ({ id: s.id, name: s.isActive ? s.name : `${s.name} (inactive)`, mayorName: s.mayorName }));
  const activeSubs = allSubs.filter((_, i) => subs[i].isActive);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments / offices"
        subtitle="Offices that receive and respond to cases. Office codes are generated automatically."
        actions={<Link href="/staff/locations" className="btn-outline btn-sm">Sub-cities, woredas & kebeles</Link>}
      />
      {manage && (
        <Card title="Add office">
          <ActionForm action={saveDepartmentAction.bind(null, null)} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
            <Field label="Code"><input disabled value="Generated automatically (OFF-###)" className="input bg-slate-50 text-slate-500" /></Field>
            <Field label="Office"><input name="name" required minLength={2} placeholder="e.g. Land Administration Office" className="input" /></Field>
            <Field label="Name of head of office representative" className="sm:col-span-2"><input name="headName" className="input" /></Field>
            <SubCityMayorFields subCities={activeSubs} />
            <Field label="Phone"><input name="phone" className="input" /></Field>
            <Field label="Email"><input name="email" type="email" className="input" /></Field>
            <div className="sm:col-span-2"><SubmitButton>Add office</SubmitButton></div>
          </ActionForm>
        </Card>
      )}
      <Card title={`Offices (${depts.length})`}>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Code</th><th>Office</th><th>Head of office representative</th><th>Sub-city</th><th>Sub-city mayor</th><th>Contact</th><th>Staff</th><th>Cases</th><th>Status</th>{manage && <th />}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {depts.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono text-xs">{d.code}</td>
                  <td className="font-medium">{d.name}</td>
                  <td className="text-xs">{d.headName ?? "—"}</td>
                  <td className="text-xs">{d.subCity?.name ?? "City level"}</td>
                  <td className="text-xs">{d.subCity?.mayorName ?? "—"}</td>
                  <td className="text-xs">{[d.phone, d.email].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{d._count.users}</td>
                  <td>{d._count.cases}</td>
                  <td>{d.isActive ? "Active" : <span className="text-slate-400">Inactive</span>}</td>
                  {manage && (
                    <td>
                      <details>
                        <summary className="link cursor-pointer text-xs">Edit</summary>
                        <ActionForm action={saveDepartmentAction.bind(null, d.id)} className="mt-2 w-72 space-y-2">
                          <p className="font-mono text-xs text-slate-500">Code {d.code}</p>
                          <input name="name" defaultValue={d.name} placeholder="Office" className="input" />
                          <input name="headName" defaultValue={d.headName ?? ""} placeholder="Head of office representative" className="input" />
                          <SubCityMayorFields subCities={allSubs} defaultSubCityId={d.subCityId} compact />
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
    </div>
  );
}
