import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";

export const metadata = { title: "System administration" };

export default async function AdminDashboard() {
  await requireActor("dashboard.admin");
  const [staff, citizens, inactive, locked, sessions, outbound, recentFails] = await Promise.all([
    prisma.user.count({ where: { role: { code: { not: "CITIZEN" } }, isActive: true } }),
    prisma.user.count({ where: { role: { code: "CITIZEN" } } }),
    prisma.user.count({ where: { isActive: false } }),
    prisma.user.count({ where: { lockedUntil: { gt: new Date() } } }),
    prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
    prisma.outboundMessage.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.auditLog.count({ where: { action: { startsWith: "LOGIN_FAILED" }, createdAt: { gt: new Date(Date.now() - 86400_000) } } }),
  ]);
  const smsOn = !!process.env.SMS_PROVIDER_URL;
  const emailOn = !!process.env.EMAIL_WEBHOOK_URL;
  return (
    <div className="space-y-6">
      <PageHeader title="System administration" subtitle="Accounts, security and integrations. Case content is not visible to this role by default." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Stat label="Active staff" value={staff} href="/staff/admin/users" />
        <Stat label="Citizen accounts" value={citizens} href="/staff/admin/users?role=CITIZEN" />
        <Stat label="Deactivated" value={inactive} />
        <Stat label="Locked now" value={locked} tone={locked ? "warn" : "default"} />
        <Stat label="Active sessions" value={sessions} />
        <Stat label="Failed sign-ins (24h)" value={recentFails} tone={recentFails > 10 ? "danger" : "default"} href="/staff/admin/audit?action=LOGIN_FAILED" />
      </div>
      <div className="grid gap-6">
        <Card title="Notification integrations">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>In-app notifications</span><Badge value="APPROVED" text="Active" /></li>
            <li className="flex justify-between"><span>SMS gateway</span>{smsOn ? <Badge value="APPROVED" text="Configured" /> : <Badge value="SKIPPED" text="Not configured" />}</li>
            <li className="flex justify-between"><span>Email gateway</span>{emailOn ? <Badge value="APPROVED" text="Configured" /> : <Badge value="SKIPPED" text="Not configured" />}</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">Configure SMS_PROVIDER_URL / EMAIL_WEBHOOK_URL in the server environment (see docs/DEPLOYMENT.md). Until then messages are recorded as “skipped”.</p>
          <h3 className="mb-2 mt-4 text-xs font-semibold uppercase text-slate-500">Latest outbound messages</h3>
          {!outbound.length ? <Empty>None yet.</Empty> : (
            <ul className="divide-y divide-slate-100 text-xs">
              {outbound.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="truncate">{m.channel} → {m.recipient.replace(/.(?=.{3})/g, "•")}: {m.subject ?? m.body.slice(0, 40)}</span>
                  <Badge value={m.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
