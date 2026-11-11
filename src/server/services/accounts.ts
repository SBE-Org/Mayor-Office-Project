import { z } from "zod";
import { prisma } from "@/server/db";
import { requirePerm, type Actor } from "@/server/access";
import { AppError, ForbiddenError, NotFoundError } from "@/server/errors";
import { audit } from "@/server/audit";
import { assertStrongPassword, dummyVerify, hashPassword, verifyPassword } from "@/server/auth/password";
import { generateSecret, verifyTotp } from "@/server/auth/totp";
import { ROLES, type RoleCode } from "@/shared/permissions";
import { citizenInfoSchema, phoneVariants } from "@/server/services/cases";
import type { Tx } from "@/server/db";
import { assertLocation } from "@/server/services/directory";

const MAX_FAILS = 5;
const LOCK_MIN = 15;

export type AuthResult = { ok: true; userId: string } | { ok: false; error: string; needCode?: boolean };

export async function authenticate(email: string, password: string, code: string | undefined, ip: string | null): Promise<AuthResult> {
  const u = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  const generic = { ok: false as const, error: "Incorrect email or password." };
  if (!u || !u.isActive) {
    await dummyVerify(password);
    await audit(prisma, null, "LOGIN_FAILED", "User", null, { email }, ip);
    return generic;
  }
  if (u.lockedUntil && u.lockedUntil > new Date()) {
    return { ok: false, error: `Account temporarily locked after repeated failed attempts. Try again after ${u.lockedUntil.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.` };
  }
  if (!(await verifyPassword(password, u.passwordHash))) {
    const fails = u.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: u.id },
      data: { failedLoginCount: fails >= MAX_FAILS ? 0 : fails, lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60_000) : null },
    });
    await audit(prisma, u.id, "LOGIN_FAILED", "User", u.id, { attempts: fails }, ip);
    return generic;
  }
  if (u.mfaEnabled && u.mfaSecret) {
    if (!code) return { ok: false, error: "Enter the 6-digit code from your authenticator app.", needCode: true };
    if (!verifyTotp(u.mfaSecret, code)) {
      await audit(prisma, u.id, "LOGIN_MFA_FAILED", "User", u.id, undefined, ip);
      return { ok: false, error: "Invalid authentication code.", needCode: true };
    }
  }
  await prisma.user.update({ where: { id: u.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await audit(prisma, u.id, "LOGIN", "User", u.id, undefined, ip);
  return { ok: true, userId: u.id };
}

export const registerSchema = citizenInfoSchema.extend({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string(),
  confirm: z.string(),
  gender: z.enum(["", "FEMALE", "MALE"]).optional(),
  preferredLanguage: z.enum(["en", "om", "am"]).default("en"),
});

export async function registerCitizen(raw: unknown) {
  const input = registerSchema.parse(raw);
  if (input.password !== input.confirm) throw new AppError("Passwords do not match.");
  assertStrongPassword(input.password);
  await assertLocation(input);
  if (await prisma.user.findUnique({ where: { email: input.email } })) throw new AppError("An account with this email already exists.");
  const role = await prisma.role.findUniqueOrThrow({ where: { code: "CITIZEN" } });
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: input.email, phone: input.phone, fullName: input.fullName, passwordHash, roleId: role.id, preferredLanguage: input.preferredLanguage },
    });
    const { linkedCases } = await attachCitizenRecord(tx, user.id, {
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      gender: input.gender || null,
      subCityId: input.subCityId,
      woreda: input.woreda,
      kebele: input.kebele,
    });
    await audit(tx, user.id, "CITIZEN_REGISTER", "User", user.id, linkedCases ? { linkedCases } : undefined);
    return user;
  });
}

type CitizenData = { fullName: string; phone: string; email?: string; gender?: string | null; subCityId?: string; woreda?: string; kebele?: string };

/**
 * Gives a new citizen (case owner) account its citizen record. If the person was already
 * registered at the office as a walk-in (same name and phone, no account yet), that record
 * is linked so their earlier cases and appointments appear in the portal.
 */
async function attachCitizenRecord(tx: Tx, userId: string, d: CitizenData) {
  const walkIn = await tx.citizen.findFirst({
    where: { userId: null, phone: { in: phoneVariants(d.phone) }, fullName: d.fullName },
    include: { _count: { select: { cases: true } } },
  });
  if (walkIn) {
    await tx.citizen.update({
      where: { id: walkIn.id },
      data: {
        userId,
        email: d.email ?? walkIn.email,
        gender: d.gender ?? walkIn.gender,
        subCityId: d.subCityId ?? walkIn.subCityId,
        woreda: d.woreda ?? walkIn.woreda,
        kebele: d.kebele ?? walkIn.kebele,
      },
    });
    return { citizenId: walkIn.id, linkedCases: walkIn._count.cases };
  }
  const c = await tx.citizen.create({ data: { ...d, userId } });
  return { citizenId: c.id, linkedCases: 0 };
}

export async function changePassword(actor: Actor, current: string, next: string, confirm: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!(await verifyPassword(current, u.passwordHash))) throw new AppError("Current password is incorrect.");
  if (next !== confirm) throw new AppError("New passwords do not match.");
  assertStrongPassword(next);
  await prisma.user.update({ where: { id: actor.id }, data: { passwordHash: await hashPassword(next), mustChangePassword: false } });
  // Sign out other sessions.
  await prisma.session.deleteMany({ where: { userId: actor.id, id: { not: actor.sessionId ?? "" } } });
  await audit(prisma, actor.id, "PASSWORD_CHANGE", "User", actor.id);
}

export async function beginMfa(actor: Actor) {
  const secret = generateSecret();
  await prisma.user.update({ where: { id: actor.id }, data: { mfaSecret: secret, mfaEnabled: false } });
  return secret;
}
export async function confirmMfa(actor: Actor, code: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!u.mfaSecret || !verifyTotp(u.mfaSecret, code)) throw new AppError("The code did not match. Check your device time and try again.");
  await prisma.user.update({ where: { id: actor.id }, data: { mfaEnabled: true } });
  await audit(prisma, actor.id, "MFA_ENABLED", "User", actor.id);
}
export async function disableMfa(actor: Actor, password: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!(await verifyPassword(password, u.passwordHash))) throw new AppError("Password is incorrect.");
  await prisma.user.update({ where: { id: actor.id }, data: { mfaEnabled: false, mfaSecret: null } });
  await audit(prisma, actor.id, "MFA_DISABLED", "User", actor.id);
}

export async function revokeSession(actor: Actor, sessionId: string) {
  await prisma.session.deleteMany({ where: { id: sessionId, userId: actor.id } });
}

// ---------------------------------------------------------------- user administration

export const staffUserSchema = z.object({
  fullName: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(20).optional(),
  title: z.string().trim().max(150).optional(),
  roleCode: z.string().refine((r) => r in ROLES && r !== "CITIZEN", "Choose a staff role"),
  departmentId: z.string().optional().transform((v) => v || undefined),
  acceptsAppointments: z.boolean().default(false),
});

function tempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  for (const b of bytes) s += chars[b % chars.length];
  return s + "7";
}

async function assertDept(roleCode: string, departmentId?: string) {
  if (roleCode === "DEPARTMENT_HEAD" && !departmentId) throw new AppError("A Department Head must belong to a department / office.");
}

export async function createStaffUser(actor: Actor, raw: unknown) {
  requirePerm(actor, "user.manage");
  const input = staffUserSchema.parse(raw);
  await assertDept(input.roleCode, input.departmentId);
  if (await prisma.user.findUnique({ where: { email: input.email } })) throw new AppError("Email already in use.");
  const role = await prisma.role.findUniqueOrThrow({ where: { code: input.roleCode } });
  const pw = tempPassword();
  const { roleCode: _r, ...rest } = input;
  const u = await prisma.user.create({ data: { ...rest, roleId: role.id, passwordHash: await hashPassword(pw), mustChangePassword: true } });
  await audit(prisma, actor.id, "USER_CREATE", "User", u.id, { email: u.email, role: role.code });
  return { user: u, tempPassword: pw };
}

export async function updateStaffUser(actor: Actor, id: string, raw: unknown) {
  requirePerm(actor, "user.manage");
  const input = staffUserSchema.extend({ isActive: z.boolean() }).parse(raw);
  await assertDept(input.roleCode, input.departmentId);
  const existing = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!existing) throw new NotFoundError();
  if (existing.role.code === "CITIZEN") throw new ForbiddenError("Citizen accounts are managed by citizens.");
  if (id === actor.id && (!input.isActive || input.roleCode !== existing.role.code)) throw new AppError("You cannot deactivate or change the role of your own account.");
  const role = await prisma.role.findUniqueOrThrow({ where: { code: input.roleCode } });
  const { roleCode: _r, ...rest } = input;
  await prisma.user.update({ where: { id }, data: { ...rest, departmentId: rest.departmentId ?? null, roleId: role.id } });
  if (!input.isActive) await prisma.session.deleteMany({ where: { userId: id } });
  await audit(prisma, actor.id, "USER_UPDATE", "User", id, { role: role.code, isActive: input.isActive, previousRole: existing.role.code });
}

export async function resetUserPassword(actor: Actor, id: string) {
  requirePerm(actor, "user.manage");
  const pw = tempPassword();
  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(pw), mustChangePassword: true, failedLoginCount: 0, lockedUntil: null } });
  await prisma.session.deleteMany({ where: { userId: id } });
  await audit(prisma, actor.id, "USER_PASSWORD_RESET", "User", id);
  return pw;
}

// ---------------------------------------------------------------- case-owner (citizen) accounts created by the administrator

export const citizenAccountSchema = citizenInfoSchema.extend({
  email: z.string().trim().toLowerCase().email("Enter a valid email address (used to sign in)"),
  gender: z.enum(["", "FEMALE", "MALE"]).optional(),
  preferredLanguage: z.enum(["en", "om", "am"]).default("en"),
});

/** Creates a portal account for a case owner from inside the system (temporary password). */
export async function createCitizenAccount(actor: Actor, raw: unknown) {
  requirePerm(actor, "user.manage");
  const input = citizenAccountSchema.parse(raw);
  await assertLocation(input);
  if (await prisma.user.findUnique({ where: { email: input.email } })) throw new AppError("Email already in use.");
  const role = await prisma.role.findUniqueOrThrow({ where: { code: "CITIZEN" } });
  const pw = tempPassword();
  const passwordHash = await hashPassword(pw);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: input.email, phone: input.phone, fullName: input.fullName, passwordHash, roleId: role.id, preferredLanguage: input.preferredLanguage, mustChangePassword: true },
    });
    const { linkedCases } = await attachCitizenRecord(tx, user.id, {
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      gender: input.gender || null,
      subCityId: input.subCityId,
      woreda: input.woreda,
      kebele: input.kebele,
    });
    await tx.citizen.updateMany({ where: { userId: user.id, registeredById: null }, data: { registeredById: actor.id } });
    await audit(tx, actor.id, "CITIZEN_ACCOUNT_CREATE", "User", user.id, { email: user.email, linkedCases });
    return { user, tempPassword: pw, linkedCases };
  });
}

/** Activate / deactivate a case-owner account. */
export async function setCitizenAccountActive(actor: Actor, id: string, isActive: boolean) {
  requirePerm(actor, "user.manage");
  const u = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!u || u.role.code !== "CITIZEN") throw new NotFoundError();
  await prisma.user.update({ where: { id }, data: { isActive } });
  if (!isActive) await prisma.session.deleteMany({ where: { userId: id } });
  await audit(prisma, actor.id, isActive ? "CITIZEN_ACCOUNT_ACTIVATE" : "CITIZEN_ACCOUNT_DEACTIVATE", "User", id);
}

export async function setRolePermission(actor: Actor, roleCode: string, permissionCode: string, granted: boolean) {
  requirePerm(actor, "role.manage");
  if (roleCode === "SUPER_ADMIN" && permissionCode === "role.manage" && !granted) throw new AppError("The Super Administrator must keep role management to avoid lock-out.");
  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  const perm = await prisma.permission.findUnique({ where: { code: permissionCode } });
  if (!role || !perm) throw new NotFoundError();
  if (granted) await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } }, create: { roleId: role.id, permissionId: perm.id }, update: {} });
  else await prisma.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: perm.id } });
  await audit(prisma, actor.id, granted ? "PERMISSION_GRANT" : "PERMISSION_REVOKE", "Role", role.id, { role: roleCode, permission: permissionCode });
}

/** Replaces the full permission set of one role (used by the Roles & permissions editor). */
export async function setRolePermissions(actor: Actor, roleCode: string, permissionCodes: string[]) {
  requirePerm(actor, "role.manage");
  const role = await prisma.role.findUnique({ where: { code: roleCode }, include: { permissions: { include: { permission: true } } } });
  if (!role) throw new NotFoundError();
  const all = await prisma.permission.findMany();
  const wanted = new Set(permissionCodes.filter((c) => all.some((p) => p.code === c)));
  if (roleCode === "SUPER_ADMIN" && !wanted.has("role.manage")) throw new AppError("The Super Administrator must keep “Manage roles and permissions” to avoid lock-out.");
  if (actor.role === roleCode && !wanted.has("role.manage")) throw new AppError("You cannot remove role management from your own role.");
  const current = new Set(role.permissions.map((rp) => rp.permission.code));
  const add = [...wanted].filter((c) => !current.has(c));
  const remove = [...current].filter((c) => !wanted.has(c));
  if (!add.length && !remove.length) return { added: 0, removed: 0 };
  const id = (c: string) => all.find((p) => p.code === c)!.id;
  await prisma.$transaction(async (tx) => {
    if (remove.length) await tx.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: { in: remove.map(id) } } });
    for (const c of add) await tx.rolePermission.create({ data: { roleId: role.id, permissionId: id(c) } });
    await audit(tx, actor.id, "ROLE_PERMISSIONS_UPDATE", "Role", role.id, { role: roleCode, granted: add, revoked: remove });
  });
  return { added: add.length, removed: remove.length };
}

export function roleLabel(code: string) {
  return ROLES[code as RoleCode]?.name ?? code;
}
