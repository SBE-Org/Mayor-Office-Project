import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, Field, PageHeader, Select } from "@/components/ui";
import { saveCategoryAction } from "@/server/actions/admin";

export const metadata = { title: "Case categories" };

export default async function CategoriesPage() {
  await requireActor("category.manage");
  const [cats, depts] = await Promise.all([
    prisma.caseCategory.findMany({ include: { defaultDepartment: true, _count: { select: { cases: true } } }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  const deptOpts = depts.map((d) => ({ value: d.id, label: d.name }));
  const fields = (c?: (typeof cats)[number]) => (
    <>
      <Field label="Code"><input name="code" required defaultValue={c?.code} className="input" /></Field>
      <Field label="Name (English)"><input name="name" required defaultValue={c?.name} className="input" /></Field>
      <Field label="Name (Afaan Oromoo)"><input name="nameOm" defaultValue={c?.nameOm ?? ""} className="input" /></Field>
      <Field label="Name (Amharic)"><input name="nameAm" defaultValue={c?.nameAm ?? ""} className="input" /></Field>
      <Field label="Default department"><Select name="defaultDepartmentId" defaultValue={c?.defaultDepartmentId} placeholder="—" options={deptOpts} /></Field>
      <Field label="Default response deadline (days)"><input name="defaultDeadlineDays" type="number" min={1} max={365} required defaultValue={c?.defaultDeadlineDays ?? 15} className="input" /></Field>
      <Field label="Description" className="sm:col-span-2"><input name="description" defaultValue={c?.description ?? ""} className="input" /></Field>
    </>
  );
  return (
    <div className="space-y-6">
      <PageHeader title="Case categories" subtitle="Configurable categories, default responsible office and response deadline. Final list requires Mayor's Office approval." />
      <Card title="Categories">
        <ul className="divide-y divide-slate-100">
          {cats.map((c) => (
            <li key={c.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span><span className="font-mono text-xs text-slate-500">{c.code}</span> <b>{c.name}</b> {!c.isActive && <span className="text-slate-400">(inactive)</span>}</span>
                <span className="text-xs text-slate-500">{c.defaultDepartment?.name ?? "No default office"} · {c.defaultDeadlineDays} days · {c._count.cases} cases</span>
              </div>
              <details className="mt-1">
                <summary className="link cursor-pointer text-xs">Edit</summary>
                <ActionForm action={saveCategoryAction.bind(null, c.id)} className="mt-2 grid gap-3 sm:grid-cols-2">
                  {fields(c)}
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={c.isActive} /> Active</label>
                  <div className="sm:col-span-2"><SubmitButton className="btn-primary btn-sm">Save</SubmitButton></div>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Add category">
        <ActionForm action={saveCategoryAction.bind(null, null)} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
          {fields()}
          <div className="sm:col-span-2"><SubmitButton>Add category</SubmitButton></div>
        </ActionForm>
      </Card>
    </div>
  );
}
