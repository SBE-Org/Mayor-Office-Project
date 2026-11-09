import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { PERMISSIONS, type PermissionCode } from "@/shared/permissions";
import { Card, DL, PageHeader } from "@/components/ui";
import { SecuritySettings } from "@/components/SecuritySettings";

export const metadata = { title: "My profile" };

export default async function StaffProfile({ searchParams }: { searchParams: Promise<{ mustChange?: string }> }) {
  const a = await requireActor();
  const sp = await searchParams;
  const u = await prisma.user.findUniqueOrThrow({ where: { id: a.id }, include: { department: true } });
  return (
    <div className="space-y-6">
      <PageHeader title="My profile" />
      <Card title="Account">
        <DL items={[["Name", u.fullName], ["Email", u.email], ["Role", a.roleName], ["Position", u.title ?? "—"], ["Department", u.department?.name ?? "—"], ["Receives appointments", u.acceptsAppointments ? "Yes" : "No"]]} />
        <details className="mt-4">
          <summary className="link cursor-pointer text-sm">What my role is permitted to do ({a.permissions.size})</summary>
          <ul className="mt-2 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
            {[...a.permissions].sort().map((p) => <li key={p}>• {PERMISSIONS[p as PermissionCode]?.name ?? p}</li>)}
          </ul>
        </details>
      </Card>
      <SecuritySettings actor={a} mustChange={sp.mustChange === "1"} />
    </div>
  );
}
