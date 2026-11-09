import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { ROLES } from "@/shared/permissions";
import { fmtDateTime } from "@/shared/format";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, Field, PageHeader, Select } from "@/components/ui";
import { createUserAction, resetPasswordAction, updateUserAction } from "@/server/actions/admin";

export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  await requireActor("user.manage");
  const sp = await searchParams;
  const [users, depts] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: sp.role ? { code: sp.role } : { code: { not: "CITIZEN" } },
        ...(sp.q ? { OR: [{ fullName: { contains: sp.q } }, { email: { contains: sp.q } }] } : {}),
      },
      include: { role: true, department: true },
      orderBy: [{ role: { name: "asc" } }, { fullName: "asc" }],
    }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);
  const roleOpts = Object.entries(ROLES).filter(([c]) => c !== "CITIZEN").map(([value, r]) => ({ value, label: r.name }));
  const deptOpts = depts.map((d) => ({ value: d.id, label: d.name }));
  return (
    <div className="space-y-6">
      <PageHeader title="Staff accounts" subtitle="Each account gets exactly one role. Permissions per role are set under Roles & permissions." />
      <Card title="Create staff account">
        <ActionForm action={createUserAction} resetOnSuccess className="grid gap-3 md:grid-cols-3">
          <Field label="Full name"><input name="fullName" required className="input" /></Field>
          <Field label="Email (sign-in)"><input name="email" type="email" required className="input" /></Field>
          <Field label="Phone"><input name="phone" className="input" /></Field>
          <Field label="Role"><Select name="roleCode" required placeholder="Choose…" options={roleOpts} /></Field>
          <Field label="Department" hint="Required for department roles"><Select name="departmentId" placeholder="—" options={deptOpts} /></Field>
          <Field label="Position / title"><input name="title" placeholder="e.g. Deputy Mayor, Economic Affairs" className="input" /></Field>
          <label className="flex items-center gap-2 text-sm md:col-span-3"><input type="checkbox" name="acceptsAppointments" /> Receives appointment requests from citizens (Mayor, Deputy Mayors, authorised officials)</label>
          <div className="md:col-span-3"><SubmitButton>Create account</SubmitButton></div>
        </ActionForm>
      </Card>
      <Card title={`Accounts (${users.length})`}>
        <form className="mb-3 flex flex-wrap gap-2">
          <input name="q" defaultValue={sp.q} placeholder="Name or email" className="input w-56" />
          <Select name="role" defaultValue={sp.role} placeholder="All staff roles" options={[...roleOpts, { value: "CITIZEN", label: "Citizen" }]} className="w-auto" />
          <button className="btn-navy">Filter</button>
        </form>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td><p className="font-medium">{u.fullName}</p><p className="text-xs text-slate-500">{u.email}{u.title ? ` · ${u.title}` : ""}</p></td>
                  <td className="text-xs">{u.role.name}{u.mfaEnabled && <span className="ml-1 badge bg-brand-50 text-brand-700">2FA</span>}</td>
                  <td className="text-xs">{u.department?.name ?? "—"}</td>
                  <td className="whitespace-nowrap text-xs">{fmtDateTime(u.lastLoginAt)}</td>
                  <td className="text-xs">{u.isActive ? (u.lockedUntil && u.lockedUntil > new Date() ? "Locked" : "Active") : <span className="text-red-700">Deactivated</span>}</td>
                  <td>
                    {u.role.code !== "CITIZEN" && (
                      <details>
                        <summary className="link cursor-pointer text-xs">Manage</summary>
                        <div className="mt-2 w-80 space-y-3">
                          <ActionForm action={updateUserAction.bind(null, u.id)} className="space-y-2">
                            <input name="fullName" defaultValue={u.fullName} className="input" />
                            <input name="email" defaultValue={u.email} className="input" />
                            <input name="phone" defaultValue={u.phone ?? ""} placeholder="Phone" className="input" />
                            <input name="title" defaultValue={u.title ?? ""} placeholder="Position" className="input" />
                            <Select name="roleCode" defaultValue={u.role.code} options={roleOpts} />
                            <Select name="departmentId" defaultValue={u.departmentId} placeholder="No department" options={deptOpts} />
                            <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="acceptsAppointments" defaultChecked={u.acceptsAppointments} /> Receives appointments</label>
                            <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="isActive" defaultChecked={u.isActive} /> Active</label>
                            <SubmitButton className="btn-primary btn-sm">Save</SubmitButton>
                          </ActionForm>
                          <ActionForm action={resetPasswordAction.bind(null, u.id)} confirm={`Reset the password of ${u.fullName}?`}>
                            <SubmitButton className="btn-outline btn-sm">Reset password</SubmitButton>
                          </ActionForm>
                        </div>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
