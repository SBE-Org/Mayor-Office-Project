import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { ROLES } from "@/shared/permissions";
import { fmtDateTime } from "@/shared/format";
import Link from "next/link";
import clsx from "clsx";
import { locationTree } from "@/server/services/directory";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { LocationPicker } from "@/components/LocationPicker";
import { Card, Field, PageHeader, Select } from "@/components/ui";
import { createCitizenAccountAction, createUserAction, resetPasswordAction, setCitizenActiveAction, updateUserAction } from "@/server/actions/admin";

export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; tab?: string }> }) {
  await requireActor("user.manage");
  const sp = await searchParams;
  if (sp.tab === "citizens" || sp.role === "CITIZEN") return <CitizenAccounts q={sp.q} />;
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
      <Tabs active="staff" />
      <Card title="Create staff account">
        <ActionForm action={createUserAction} resetOnSuccess className="grid gap-3 md:grid-cols-3">
          <Field label="Full name"><input name="fullName" required className="input" /></Field>
          <Field label="Email (sign-in)"><input name="email" type="email" required className="input" /></Field>
          <Field label="Phone"><input name="phone" className="input" /></Field>
          <Field label="Role"><Select name="roleCode" required placeholder="Choose…" options={roleOpts} /></Field>
          <Field label="Department / office" hint="Required for department roles"><Select name="departmentId" placeholder="—" options={deptOpts} /></Field>
          <Field label="Position / title"><input name="title" placeholder="e.g. Deputy Mayor, Economic Affairs" className="input" /></Field>
          <label className="flex items-center gap-2 text-sm md:col-span-3"><input type="checkbox" name="acceptsAppointments" /> Show in the citizen appointment list (label and order are set under Appointment officials)</label>
          <div className="md:col-span-3"><SubmitButton>Create account</SubmitButton></div>
        </ActionForm>
      </Card>
      <Card title={`Accounts (${users.length})`}>
        <form className="mb-3 flex flex-wrap gap-2">
          <input name="q" defaultValue={sp.q} placeholder="Name or email" className="input w-56" />
          <Select name="role" defaultValue={sp.role} placeholder="All staff roles" options={roleOpts} className="w-auto" />
          <button className="btn-navy">Filter</button>
        </form>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Name</th><th>Role</th><th>Department / office</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
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

function Tabs({ active }: { active: "staff" | "citizens" }) {
  const tab = (key: "staff" | "citizens", href: string, text: string) => (
    <Link href={href} className={clsx("rounded-lg px-3 py-1.5 text-sm font-medium", active === key ? "bg-brand-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50")}>{text}</Link>
  );
  return (
    <div className="flex gap-2">
      {tab("staff", "/staff/admin/users", "Staff")}
      {tab("citizens", "/staff/admin/users?tab=citizens", "Case owners (citizens)")}
    </div>
  );
}

async function CitizenAccounts({ q }: { q?: string }) {
  const [users, tree] = await Promise.all([
    prisma.user.findMany({
      where: { role: { code: "CITIZEN" }, ...(q ? { OR: [{ fullName: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] } : {}) },
      include: { citizen: { include: { subCity: true, _count: { select: { cases: true, appointments: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    locationTree(),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="Staff accounts" subtitle="Portal accounts for case owners. Case owners can also create their own account on the public site." />
      <Tabs active="citizens" />
      <Card title="Create case-owner account">
        <ActionForm action={createCitizenAccountAction} resetOnSuccess className="grid gap-3 md:grid-cols-3">
          <Field label="Full name"><input name="fullName" required minLength={3} className="input" /></Field>
          <Field label="Email (sign-in)"><input name="email" type="email" required className="input" /></Field>
          <Field label="Phone" hint="If this person already has walk-in cases under the same name and phone, they are linked automatically."><input name="phone" required placeholder="09XXXXXXXX" className="input" /></Field>
          <LocationPicker tree={tree} />
          <Field label="Gender"><Select name="gender" placeholder="—" options={[{ value: "FEMALE", label: "Female" }, { value: "MALE", label: "Male" }]} /></Field>
          <Field label="Language"><Select name="preferredLanguage" defaultValue="om" options={[{ value: "om", label: "Afaan Oromoo" }, { value: "am", label: "አማርኛ" }, { value: "en", label: "English" }]} /></Field>
          <div className="md:col-span-3"><SubmitButton>Create account</SubmitButton></div>
        </ActionForm>
      </Card>
      <Card title={`Case-owner accounts (${users.length})`}>
        <form className="mb-3 flex flex-wrap gap-2">
          <input type="hidden" name="tab" value="citizens" />
          <input name="q" defaultValue={q} placeholder="Name, email or phone" className="input w-64" />
          <button className="btn-navy">Search</button>
        </form>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Name</th><th>Phone</th><th>Location</th><th>Cases</th><th>Last sign-in</th><th>Status</th><th /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td><p className="font-medium">{u.fullName}</p><p className="text-xs text-slate-500">{u.email}</p></td>
                  <td className="whitespace-nowrap text-xs">{u.citizen?.phone ?? u.phone ?? "—"}</td>
                  <td className="text-xs">{[u.citizen?.subCity?.name, u.citizen?.woreda && `Woreda ${u.citizen.woreda}`, u.citizen?.kebele && `Kebele ${u.citizen.kebele}`].filter(Boolean).join(", ") || "—"}</td>
                  <td className="text-xs">{u.citizen?._count.cases ?? 0}</td>
                  <td className="whitespace-nowrap text-xs">{fmtDateTime(u.lastLoginAt)}</td>
                  <td className="text-xs">{u.isActive ? (u.mustChangePassword ? "Active · temporary password" : "Active") : <span className="text-red-700">Deactivated</span>}</td>
                  <td>
                    <details>
                      <summary className="link cursor-pointer text-xs">Manage</summary>
                      <div className="mt-2 flex w-56 flex-col gap-2">
                        <ActionForm action={setCitizenActiveAction.bind(null, u.id, !u.isActive)} confirm={`${u.isActive ? "Deactivate" : "Activate"} the account of ${u.fullName}?`}>
                          <SubmitButton className="btn-outline btn-sm">{u.isActive ? "Deactivate" : "Activate"}</SubmitButton>
                        </ActionForm>
                        <ActionForm action={resetPasswordAction.bind(null, u.id)} confirm={`Reset the password of ${u.fullName}?`}>
                          <SubmitButton className="btn-outline btn-sm">Reset password</SubmitButton>
                        </ActionForm>
                      </div>
                    </details>
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
