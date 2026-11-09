import { Fragment } from "react";
import { Check, Minus } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { DEFAULT_ROLE_PERMISSIONS, type RoleCode } from "@/shared/permissions";
import { togglePermissionAction } from "@/server/actions/admin";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Roles & permissions" };

const ORDER: RoleCode[] = [
  "MAYOR", "DEPUTY_MAYOR", "CHIEF_OF_STAFF", "SECRETARY", "OFFICE_ASSISTANT", "CASE_REGISTRATION_OFFICER", "CASE_REVIEW_OFFICER",
  "DOCUMENT_OFFICER", "DEPARTMENT_HEAD", "DEPARTMENT_OFFICER", "SUPER_ADMIN", "CITIZEN",
];
const SHORT: Record<string, string> = {
  MAYOR: "Mayor", DEPUTY_MAYOR: "Deputy Mayor", CHIEF_OF_STAFF: "Head of Office", SECRETARY: "Secretary", OFFICE_ASSISTANT: "Office Assistant",
  CASE_REGISTRATION_OFFICER: "Registration Off.", CASE_REVIEW_OFFICER: "Review Off.", DOCUMENT_OFFICER: "Document Off.", DEPARTMENT_HEAD: "Dept. Head",
  DEPARTMENT_OFFICER: "Dept. Officer", SUPER_ADMIN: "Super Admin", CITIZEN: "Citizen",
};

export default async function RolesPage() {
  await requireActor("role.manage");
  const [roles, perms] = await Promise.all([
    prisma.role.findMany({ include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } } }),
    prisma.permission.findMany({ orderBy: [{ module: "asc" }, { code: "asc" }] }),
  ]);
  const sorted = ORDER.map((c) => roles.find((r) => r.code === c)).filter(Boolean) as typeof roles;
  const granted = new Set(roles.flatMap((r) => r.permissions.map((p) => `${r.code}|${p.permission.code}`)));
  const modules = [...new Set(perms.map((p) => p.module))];
  return (
    <div>
      <PageHeader title="Roles & permissions" subtitle="Click a cell to grant or revoke. Changes apply at the user's next page load and are recorded in the audit log. Cells marked • differ from the default." />
      <div className="card overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 bg-white">
            <tr>
              <th className="sticky left-0 z-10 min-w-64 bg-white px-3 py-2 text-left">Permission</th>
              {sorted.map((r) => (
                <th key={r.id} className="px-1 py-2 text-center align-bottom font-semibold text-navy-800" title={r.description ?? ""}>
                  <span className="block w-20 leading-tight">{SHORT[r.code] ?? r.name}</span>
                  <span className="font-normal text-slate-400">{r._count.users} users</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <Fragment key={m}>
                <tr><td colSpan={sorted.length + 1} className="bg-navy-50 px-3 py-1.5 font-semibold uppercase tracking-wide text-navy-700">{m}</td></tr>
                {perms.filter((p) => p.module === m).map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="sticky left-0 bg-white px-3 py-1.5"><p className="text-slate-800">{p.name}</p><p className="font-mono text-[10px] text-slate-400">{p.code}</p></td>
                    {sorted.map((r) => {
                      const on = granted.has(`${r.code}|${p.code}`);
                      const def = (DEFAULT_ROLE_PERMISSIONS[r.code as RoleCode] as string[]).includes(p.code);
                      return (
                        <td key={r.id} className="px-1 py-1 text-center">
                          <form action={togglePermissionAction}>
                            <input type="hidden" name="role" value={r.code} />
                            <input type="hidden" name="permission" value={p.code} />
                            <input type="hidden" name="grant" value={on ? "0" : "1"} />
                            <button
                              className={`relative inline-flex h-7 w-7 items-center justify-center rounded-md border ${on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-300 hover:border-brand-300"}`}
                              aria-label={`${on ? "Revoke" : "Grant"} ${p.code} for ${r.name}`}
                              title={`${on ? "Revoke" : "Grant"}: ${p.name} — ${r.name}`}
                            >
                              {on ? <Check className="h-4 w-4" /> : <Minus className="h-3 w-3" />}
                              {on !== def && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-500" />}
                            </button>
                          </form>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">To restore defaults run <code>npm run db:seed -- --reset-permissions</code> on the server.</p>
    </div>
  );
}
