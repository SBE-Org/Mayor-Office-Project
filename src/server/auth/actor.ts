import { prisma } from "@/server/db";
import type { Actor } from "@/server/access";
import type { RoleCode } from "@/shared/permissions";

export async function loadActor(userId: string, sessionId?: string): Promise<Actor | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { include: { permissions: { include: { permission: true } } } }, citizen: true },
  });
  if (!u || !u.isActive) return null;
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    role: u.role.code as RoleCode,
    roleName: u.role.name,
    title: u.title,
    departmentId: u.departmentId,
    citizenId: u.citizen?.id ?? null,
    permissions: new Set(u.role.permissions.map((rp) => rp.permission.code)),
    sessionId,
  };
}
