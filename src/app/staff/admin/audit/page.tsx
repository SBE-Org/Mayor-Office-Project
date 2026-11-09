import Link from "next/link";
import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { fmtDateTime } from "@/shared/format";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; entity?: string; user?: string; page?: string }> }) {
  await requireActor("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = {
    ...(sp.action ? { action: { contains: sp.action } } : {}),
    ...(sp.entity ? { entity: sp.entity } : {}),
    ...(sp.user ? { user: { email: { contains: sp.user } } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, include: { user: { include: { role: true } } }, orderBy: { createdAt: "desc" }, take: 100, skip: (page - 1) * 100 }),
    prisma.auditLog.count({ where }),
  ]);
  const qs = (p: number) => `?${new URLSearchParams({ ...(sp.action ? { action: sp.action } : {}), ...(sp.entity ? { entity: sp.entity } : {}), ...(sp.user ? { user: sp.user } : {}), page: String(p) })}`;
  return (
    <div>
      <PageHeader title="Audit log" subtitle={`${total} entries · append-only record of important actions`} />
      <Card>
        <form className="mb-3 flex flex-wrap gap-2">
          <input name="action" defaultValue={sp.action} placeholder="Action (e.g. CASE_FORWARD)" className="input w-56" />
          <input name="entity" defaultValue={sp.entity} placeholder="Entity (Case, User…)" className="input w-44" />
          <input name="user" defaultValue={sp.user} placeholder="User email" className="input w-44" />
          <button className="btn-navy">Filter</button>
        </form>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th><th>IP</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-xs">{fmtDateTime(r.createdAt)}</td>
                  <td className="text-xs">{r.user ? <>{r.user.fullName}<br /><span className="text-slate-500">{r.user.role.name}</span></> : "—"}</td>
                  <td className="font-mono text-xs">{r.action}</td>
                  <td className="text-xs">{r.entity === "Case" && r.entityId ? <Link href={`/staff/cases/${r.entityId}`} className="link">Case</Link> : r.entity}</td>
                  <td className="max-w-md break-words font-mono text-[11px] text-slate-600">{r.details}</td>
                  <td className="text-xs">{r.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-2">
          {page > 1 && <Link href={qs(page - 1)} className="btn-outline btn-sm">Newer</Link>}
          {page * 100 < total && <Link href={qs(page + 1)} className="btn-outline btn-sm">Older</Link>}
        </div>
      </Card>
    </div>
  );
}
