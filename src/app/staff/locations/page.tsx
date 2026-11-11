import { requireActor } from "@/server/auth/session";
import { can } from "@/server/access";
import { prisma } from "@/server/db";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, Empty, Field, PageHeader } from "@/components/ui";
import { addKebelesAction, addWoredasAction, saveSubCityAction, updateKebeleAction, updateWoredaAction } from "@/server/actions/admin";

export const metadata = { title: "Sub-cities, woredas & kebeles" };

export default async function LocationsPage() {
  const a = await requireActor("department.view");
  const manage = can(a, "department.manage");
  const subs = await prisma.subCity.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { departments: true, cases: true, citizens: true } },
      woredas: { orderBy: { name: "asc" }, include: { kebeles: { orderBy: { name: "asc" } } } },
    },
  });
  const woredaCount = subs.reduce((n, s) => n + s.woredas.length, 0);
  const kebeleCount = subs.reduce((n, s) => n + s.woredas.reduce((m, w) => m + w.kebeles.length, 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sub-cities, woredas & kebeles"
        subtitle={`${subs.length} sub-cities · ${woredaCount} woredas · ${kebeleCount} kebeles. These lists are the drop-downs used when creating citizen accounts and registering walk-in cases and visitors.`}
      />

      {manage && (
        <Card title="Add sub-city">
          <ActionForm action={saveSubCityAction.bind(null, null)} resetOnSuccess className="grid gap-3 sm:grid-cols-[8rem_1fr_1fr_auto] sm:items-end">
            <Field label="Code"><input name="code" required placeholder="SC-E" className="input" /></Field>
            <Field label="Name"><input name="name" required className="input" /></Field>
            <Field label="Sub-city mayor"><input name="mayorName" className="input" /></Field>
            <SubmitButton>Add</SubmitButton>
          </ActionForm>
        </Card>
      )}

      {!subs.length && <Empty>No sub-cities yet.</Empty>}

      {subs.map((s) => (
        <Card
          key={s.id}
          title={
            <span>
              <span className="font-mono text-xs text-slate-500">{s.code}</span> {s.name}
              {!s.isActive && <span className="ml-2 font-normal text-slate-400">(inactive)</span>}
            </span>
          }
          actions={<span className="text-xs text-slate-500">Mayor: {s.mayorName || "—"} · {s._count.departments} offices · {s._count.citizens} citizens · {s._count.cases} cases</span>}
        >
          <div className="space-y-4">
            {manage && (
              <details>
                <summary className="link cursor-pointer text-xs">Edit sub-city</summary>
                <ActionForm action={saveSubCityAction.bind(null, s.id)} className="mt-2 flex flex-wrap items-end gap-2">
                  <Field label="Code"><input name="code" defaultValue={s.code} className="input w-28" /></Field>
                  <Field label="Name"><input name="name" defaultValue={s.name} className="input w-56" /></Field>
                  <Field label="Sub-city mayor"><input name="mayorName" defaultValue={s.mayorName ?? ""} className="input w-56" /></Field>
                  <label className="mb-2 flex items-center gap-1 text-xs"><input type="checkbox" name="isActive" defaultChecked={s.isActive} /> Active</label>
                  <SubmitButton className="btn-primary btn-sm">Save</SubmitButton>
                </ActionForm>
              </details>
            )}

            {!s.woredas.length ? (
              <Empty>No woredas registered for this sub-city.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th className="w-48">Woreda</th><th>Kebeles</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {s.woredas.map((w) => (
                      <tr key={w.id} className="align-top">
                        <td>
                          <p className="font-medium">{w.name} {!w.isActive && <span className="text-xs font-normal text-slate-400">(inactive)</span>}</p>
                          {manage && (
                            <details>
                              <summary className="link cursor-pointer text-xs">Edit</summary>
                              <ActionForm action={updateWoredaAction.bind(null, w.id)} className="mt-2 space-y-2">
                                <input name="name" defaultValue={w.name} className="input" />
                                <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="isActive" defaultChecked={w.isActive} /> Active</label>
                                <SubmitButton className="btn-primary btn-sm">Save</SubmitButton>
                              </ActionForm>
                            </details>
                          )}
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1.5">
                            {!w.kebeles.length && <span className="text-xs text-slate-400">No kebeles yet</span>}
                            {w.kebeles.map((k) =>
                              manage ? (
                                <details key={k.id} className="relative">
                                  <summary className={`badge cursor-pointer list-none ${k.isActive ? "bg-brand-50 text-brand-800" : "bg-slate-100 text-slate-400 line-through"}`}>{k.name}</summary>
                                  <ActionForm action={updateKebeleAction.bind(null, k.id)} className="absolute z-10 mt-1 w-56 space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                                    <input name="name" defaultValue={k.name} className="input" />
                                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="isActive" defaultChecked={k.isActive} /> Active</label>
                                    <SubmitButton className="btn-primary btn-sm">Save</SubmitButton>
                                  </ActionForm>
                                </details>
                              ) : (
                                <span key={k.id} className={`badge ${k.isActive ? "bg-brand-50 text-brand-800" : "bg-slate-100 text-slate-400 line-through"}`}>{k.name}</span>
                              ),
                            )}
                          </div>
                          {manage && (
                            <ActionForm action={addKebelesAction.bind(null, w.id)} resetOnSuccess className="mt-2 flex flex-wrap items-center gap-2">
                              <input name="names" required placeholder="Add kebeles, e.g. 01, 02, 03" className="input w-64" />
                              <SubmitButton className="btn-outline btn-sm">Add kebeles</SubmitButton>
                            </ActionForm>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {manage && (
              <ActionForm action={addWoredasAction.bind(null, s.id)} resetOnSuccess className="flex flex-wrap items-center gap-2">
                <input name="names" required placeholder="Add woredas, e.g. 01, 02, 03" className="input w-64" />
                <SubmitButton className="btn-outline btn-sm">Add woredas</SubmitButton>
              </ActionForm>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
