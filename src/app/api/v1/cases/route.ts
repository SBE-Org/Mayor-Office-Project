import type { NextRequest } from "next/server";
import { api } from "@/server/api";
import { listCases, submitCase } from "@/server/services/cases";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  return api((a) =>
    listCases(a, { q: p.get("q") ?? undefined, status: p.get("status") ?? undefined, categoryId: p.get("categoryId") ?? undefined, departmentId: p.get("departmentId") ?? undefined, priority: p.get("priority") ?? undefined, overdue: p.get("overdue") === "1", take: Math.min(500, Number(p.get("take")) || 100) }).then((rows) =>
      rows.map((c) => ({ id: c.id, referenceNo: c.referenceNo, title: c.title, type: c.type, status: c.status, priority: c.priority, confidentiality: c.confidentiality, category: c.category.name, department: c.department?.name ?? null, citizen: c.citizen.fullName, deadline: c.deadline, createdAt: c.createdAt })),
    ),
  );
}

// JSON body: { type, categoryId, title, description, subCityId?, channel?, priority?, confidentiality?, citizen?: { fullName, phone, ... } }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return api((a) => submitCase(a, body, [], body?.citizen).then((c) => ({ id: c.id, referenceNo: c.referenceNo, status: c.status })), 201);
}
