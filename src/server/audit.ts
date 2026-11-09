import type { Tx, Db } from "@/server/db";

export async function audit(
  db: Tx | Db,
  userId: string | null | undefined,
  action: string,
  entity: string,
  entityId?: string | null,
  details?: Record<string, unknown> | string,
  ip?: string | null,
) {
  await db.auditLog.create({
    data: {
      userId: userId ?? null,
      action,
      entity,
      entityId: entityId ?? null,
      details: details == null ? null : typeof details === "string" ? details : JSON.stringify(details),
      ip: ip ?? null,
    },
  });
}
