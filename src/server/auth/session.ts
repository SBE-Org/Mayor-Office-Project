import "server-only";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/server/db";
import { loadActor } from "@/server/auth/actor";
import { can, type Actor } from "@/server/access";
import type { PermissionCode } from "@/shared/permissions";

export const SESSION_COOKIE = "smo_session";
const HOURS = Number(process.env.SESSION_HOURS || 8);
const IDLE_MIN = Number(process.env.SESSION_IDLE_MINUTES || 60);

const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

export async function clientInfo() {
  const h = await headers();
  return {
    ip: (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent")?.slice(0, 250) || null,
  };
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const { ip, userAgent } = await clientInfo();
  const expiresAt = new Date(Date.now() + HOURS * 3600_000);
  await prisma.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt, ip, userAgent } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "true",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export const getActor = cache(async (): Promise<Actor | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!s) return null;
  const now = Date.now();
  if (s.expiresAt.getTime() < now || now - s.lastSeenAt.getTime() > IDLE_MIN * 60_000) {
    await prisma.session.delete({ where: { id: s.id } }).catch(() => {});
    return null;
  }
  if (now - s.lastSeenAt.getTime() > 60_000) {
    await prisma.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return loadActor(s.userId, s.id);
});

/** For pages: redirect to login when signed out, or to home when not permitted. */
export async function requireActor(perm?: PermissionCode | PermissionCode[]): Promise<Actor> {
  const a = await getActor();
  if (!a) redirect("/login");
  if (perm) {
    const list = Array.isArray(perm) ? perm : [perm];
    if (!list.some((p) => can(a, p))) redirect("/forbidden");
  }
  return a;
}
