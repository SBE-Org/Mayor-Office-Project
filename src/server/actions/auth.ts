"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { run, str, type ActionResult } from "@/server/action";
import { clientInfo, createSession, destroySession, getActor, requireActor } from "@/server/auth/session";
import { authenticate, beginMfa, changePassword, confirmMfa, disableMfa, registerCitizen, revokeSession } from "@/server/services/accounts";
import { homePath } from "@/server/access";
import { loadActor } from "@/server/auth/actor";
import { audit } from "@/server/audit";
import { userMessage } from "@/server/errors";

// Simple in-memory throttle per IP (use a shared store such as Redis when running several instances).
const attempts = new Map<string, { n: number; t: number }>();
function throttled(ip: string) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || now - a.t > 10 * 60_000) {
    attempts.set(ip, { n: 1, t: now });
    return false;
  }
  a.n++;
  return a.n > 30;
}

export async function loginAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { ip } = await clientInfo();
  if (throttled(ip ?? "unknown")) return { ok: false, error: "Too many sign-in attempts. Please wait a few minutes." };
  const email = str(fd, "email");
  const r = await authenticate(email, str(fd, "password"), str(fd, "code") || undefined, ip);
  if (!r.ok) return { ok: false, error: r.error, needCode: r.needCode, data: { email } };
  await createSession(r.userId);
  const actor = await loadActor(r.userId);
  const u = await prisma.user.findUnique({ where: { id: r.userId } });
  if (u?.preferredLanguage) (await cookies()).set("lang", u.preferredLanguage, { path: "/", maxAge: 31536000, sameSite: "lax" });
  const next = str(fd, "next");
  redirect(u?.mustChangePassword ? "/staff/profile?mustChange=1" : next.startsWith("/") && !next.startsWith("//") ? next : homePath(actor!));
}

export async function logoutAction() {
  const a = await getActor();
  if (a) await audit(prisma, a.id, "LOGOUT", "User", a.id);
  await destroySession();
  redirect("/login");
}

export async function registerAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const user = await registerCitizen({
      fullName: str(fd, "fullName"),
      email: str(fd, "email"),
      phone: str(fd, "phone"),
      subCityId: str(fd, "subCityId"),
      woreda: str(fd, "woreda") || undefined,
      kebele: str(fd, "kebele") || undefined,
      gender: str(fd, "gender"),
      preferredLanguage: str(fd, "preferredLanguage") || "en",
      password: str(fd, "password"),
      confirm: str(fd, "confirm"),
    });
    await createSession(user.id);
  } catch (e) {
    return { ok: false, error: userMessage(e) };
  }
  redirect("/portal");
}

export async function setLangAction(fd: FormData) {
  const lang = str(fd, "lang");
  if (!["en", "om", "am"].includes(lang)) return;
  (await cookies()).set("lang", lang, { path: "/", maxAge: 31536000, sameSite: "lax" });
  const a = await getActor();
  if (a) await prisma.user.update({ where: { id: a.id }, data: { preferredLanguage: lang } });
}

export async function changePasswordAction(_: ActionResult | null, fd: FormData) {
  const a = await requireActor();
  return run(async () => {
    await changePassword(a, str(fd, "current"), str(fd, "next"), str(fd, "confirm"));
    return "Password changed. Other sessions have been signed out.";
  });
}

export async function beginMfaAction(_: ActionResult | null): Promise<ActionResult> {
  const a = await requireActor();
  return run(async () => {
    const secret = await beginMfa(a);
    return { ok: true, message: "Scan or enter this key in your authenticator app, then confirm with a code.", data: { secret, email: a.email } };
  });
}
export async function confirmMfaAction(_: ActionResult | null, fd: FormData) {
  const a = await requireActor();
  return run(async () => {
    await confirmMfa(a, str(fd, "code"));
    return "Two-step verification is now enabled.";
  }, ["/staff/profile", "/portal/profile"]);
}
export async function disableMfaAction(_: ActionResult | null, fd: FormData) {
  const a = await requireActor();
  return run(async () => {
    await disableMfa(a, str(fd, "password"));
    return "Two-step verification disabled.";
  }, ["/staff/profile", "/portal/profile"]);
}
export async function revokeSessionAction(fd: FormData) {
  const a = await requireActor();
  await revokeSession(a, str(fd, "id"));
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/staff/profile");
  revalidatePath("/portal/profile");
}

export async function markNotificationsReadAction() {
  const a = await requireActor();
  await prisma.notification.updateMany({ where: { userId: a.id, readAt: null }, data: { readAt: new Date() } });
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/", "layout");
}
