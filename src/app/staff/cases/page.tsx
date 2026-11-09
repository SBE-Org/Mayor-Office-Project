import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/access";
import { listCases } from "@/server/services/cases";
import { activeCategories, activeDepartments } from "@/server/services/directory";
import { CASE_STATUSES, PRIORITIES } from "@/shared/constants";
import { Card, PageHeader, Select, opts } from "@/components/ui";
import { CaseTable } from "@/components/CaseTable";

export const metadata = { title: "Cases" };

type SP = { q?: string; status?: string; categoryId?: string; departmentId?: string; priority?: string; overdue?: string };

export default async function CasesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const a = await requireActor();
  const sp = await searchParams;
  const [rows, cats, depts] = await Promise.all([
    listCases(a, { ...sp, overdue: sp.overdue === "1" }),
    activeCategories(),
    activeDepartments(),
  ]);
  return (
    <div>
      <PageHeader
        title="Cases"
        subtitle="Only cases your role is authorised to see are listed."
        actions={can(a, "case.register") ? <Link href="/staff/cases/new" className="btn-primary">Register case</Link> : null}
      />
      <Card>
        <form className="no-print mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <input name="q" defaultValue={sp.q} placeholder="Reference, subject or citizen" className="input lg:col-span-2" />
          <Select name="status" defaultValue={sp.status} placeholder="All statuses" options={opts(CASE_STATUSES)} />
          <Select name="categoryId" defaultValue={sp.categoryId} placeholder="All categories" options={cats.map((c) => ({ value: c.id, label: c.name }))} />
          <Select name="departmentId" defaultValue={sp.departmentId} placeholder="All departments" options={depts.map((d) => ({ value: d.id, label: d.name }))} />
          <Select name="priority" defaultValue={sp.priority} placeholder="Any priority" options={opts(PRIORITIES)} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="overdue" value="1" defaultChecked={sp.overdue === "1"} /> Overdue only</label>
          <div className="flex gap-2 lg:col-span-5">
            <button className="btn-navy">Filter</button>
            <Link href="/staff/cases" className="btn-outline">Clear</Link>
          </div>
        </form>
        <p className="mb-2 text-xs text-slate-500">{rows.length} case(s)</p>
        <CaseTable rows={rows} />
      </Card>
    </div>
  );
}
