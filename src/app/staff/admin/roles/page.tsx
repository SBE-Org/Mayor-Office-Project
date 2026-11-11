import Link from "next/link";
import clsx from "clsx";
import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { DEFAULT_ROLE_PERMISSIONS, type RoleCode } from "@/shared/permissions";
import { resetRolePermissionsAction, saveRolePermissionsAction } from "@/server/actions/admin";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Roles & permissions" };

const ORDER: RoleCode[] = ["SUPER_ADMIN", "MAYOR", "DEPUTY_MAYOR", "CHIEF_OF_STAFF", "SECRETARY", "DEPARTMENT_HEAD", "CITIZEN"];

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  await requireActor("role.manage");
  const sp = await searchParams;
  const [roles, perms] = await Promise.all([
    prisma.role.findMany({ include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } } }),
    prisma.permission.findMany({ orderBy: [{ module: "asc" }, { code: "asc" }] }),
  ]);
  const sorted = [
    ...(ORDER.map((c) => roles.find((r) => r.code === c)).filter(Boolean) as typeof roles),
  ];
  const role = sorted.find((r) => r.code === sp.role) ?? sorted[0];
  if (!role) return <PageHeader title="Roles & permissions" subtitle="No roles found. Run the database seed." />;

  const granted = new Set(role.permissions.map((p) => p.permission.code));
  const defaults = new Set<string>(DEFAULT_ROLE_PERMISSIONS[role.code as RoleCode] ?? []);
  const modules = [...new Set(perms.map((p) => p.module))];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & permissions"
        subtitle="Choose a role, tick the permissions it should have and press Save. Changes take effect at the user's next page load and are recorded in the audit log."
      />
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <Card title="Roles">
          <ul className="-mx-2 space-y-0.5">
            {sorted.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/staff/admin/roles?role=${r.code}`}
                  className={clsx("flex items-center justify-between rounded-lg px-2 py-1.5 text-sm", r.id === role.id ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-50")}
                >
                  <span>{r.name}</span>
                  <span className={clsx("text-xs", r.id === role.id ? "text-white/80" : "text-slate-400")}>{r._count.users}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title={`${role.name} — ${granted.size} of ${perms.length} permissions`}
          actions={
            <ActionForm key={`reset-${role.code}`} action={resetRolePermissionsAction.bind(null, role.code)} confirm={`Restore the default permissions for ${role.name}?`} className="flex items-center gap-2">
              <SubmitButton className="btn-outline btn-sm">Restore defaults</SubmitButton>
            </ActionForm>
          }
        >
          {role.description && <p className="mb-4 text-sm text-slate-500">{role.description}</p>}
          <ActionForm key={role.code} action={saveRolePermissionsAction.bind(null, role.code)} className="space-y-5">
            {modules.map((m) => (
              <fieldset key={m}>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-700">{m}</legend>
                <div className="grid gap-1 sm:grid-cols-2">
                  {perms
                    .filter((p) => p.module === m)
                    .map((p) => {
                      const on = granted.has(p.code);
                      const changed = on !== defaults.has(p.code);
                      return (
                        <label key={p.id} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                          <input type="checkbox" name="perm" value={p.code} defaultChecked={on} className="mt-0.5 h-4 w-4 accent-brand-600" />
                          <span className="text-sm">
                            <span className="text-slate-800">{p.name}</span>
                            {changed && <span className="ml-1 text-[10px] font-semibold uppercase text-amber-600" title="Differs from the default">changed</span>}
                            <span className="block font-mono text-[10px] text-slate-400">{p.code}</span>
                          </span>
                        </label>
                      );
                    })}
                </div>
              </fieldset>
            ))}
            <div className="sticky bottom-0 -mx-5 border-t border-slate-100 bg-white px-5 py-3">
              <SubmitButton>Save permissions</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
