import { api } from "@/server/api";
import { prisma } from "@/server/db";

export async function GET() {
  return api((a) => prisma.notification.findMany({ where: { userId: a.id }, orderBy: { createdAt: "desc" }, take: 100 }));
}
