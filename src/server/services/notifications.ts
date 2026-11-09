import { prisma, type Tx, type Db } from "@/server/db";

type Msg = { title: string; body: string; link?: string };

export async function notifyUsers(db: Tx | Db, userIds: (string | null | undefined)[], msg: Msg) {
  const ids = [...new Set(userIds.filter(Boolean) as string[])];
  if (!ids.length) return;
  await db.notification.createMany({ data: ids.map((userId) => ({ userId, ...msg })) });
}

export async function notifyRole(db: Tx | Db, permission: string, msg: Msg, extra: { departmentId?: string | null } = {}) {
  const users = await db.user.findMany({
    where: {
      isActive: true,
      role: { permissions: { some: { permission: { code: permission } } } },
      ...(extra.departmentId ? { departmentId: extra.departmentId } : {}),
    },
    select: { id: true },
  });
  await notifyUsers(db, users.map((u) => u.id), msg);
}

/** Notify a citizen in-app (if they have an account) and queue SMS / email. */
export async function notifyCitizen(db: Tx | Db, citizenId: string, msg: Msg) {
  const c = await db.citizen.findUnique({ where: { id: citizenId } });
  if (!c) return;
  if (c.userId) await notifyUsers(db, [c.userId], { ...msg, link: msg.link?.replace("/staff/", "/portal/") });
  if (c.phone) await db.outboundMessage.create({ data: { channel: "SMS", recipient: c.phone, body: `${msg.title}: ${msg.body}`.slice(0, 300) } });
  if (c.email) await db.outboundMessage.create({ data: { channel: "EMAIL", recipient: c.email, subject: msg.title, body: msg.body } });
}

/**
 * Delivers queued SMS/email through configured HTTP providers.
 * Without configuration messages are marked SKIPPED (visible in the admin dashboard).
 * See docs/DEPLOYMENT.md for the expected provider contract.
 */
export async function dispatchOutbound() {
  const queued = await prisma.outboundMessage.findMany({ where: { status: "QUEUED" }, take: 50 });
  for (const m of queued) {
    const url = m.channel === "SMS" ? process.env.SMS_PROVIDER_URL : process.env.EMAIL_WEBHOOK_URL;
    const token = m.channel === "SMS" ? process.env.SMS_PROVIDER_TOKEN : process.env.EMAIL_WEBHOOK_TOKEN;
    if (!url) {
      await prisma.outboundMessage.update({ where: { id: m.id }, data: { status: "SKIPPED", error: `${m.channel} provider not configured` } });
      continue;
    }
    try {
      const payload =
        m.channel === "SMS"
          ? { to: m.recipient, from: process.env.SMS_SENDER_ID, message: m.body }
          : { to: m.recipient, from: process.env.EMAIL_FROM, subject: m.subject, text: m.body };
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      await prisma.outboundMessage.update({
        where: { id: m.id },
        data: res.ok ? { status: "SENT" } : { status: "FAILED", error: `HTTP ${res.status}` },
      });
    } catch (e) {
      await prisma.outboundMessage.update({ where: { id: m.id }, data: { status: "FAILED", error: String(e).slice(0, 200) } });
    }
  }
}
