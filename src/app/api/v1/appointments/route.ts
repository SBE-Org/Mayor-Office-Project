import type { NextRequest } from "next/server";
import { api } from "@/server/api";
import { listAppointments, requestAppointment } from "@/server/services/appointments";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const d = (k: string) => (p.get(k) ? new Date(p.get(k)!) : undefined);
  return api((a) =>
    listAppointments(a, { from: d("from"), to: d("to"), officialId: p.get("officialId") ?? undefined, status: p.get("status") ?? undefined }).then((rows) =>
      rows.map((x) => ({ id: x.id, referenceNo: x.referenceNo, status: x.status, startAt: x.startAt, endAt: x.endAt, official: x.official.fullName, citizen: x.citizen.fullName, category: x.category, purpose: x.purpose })),
    ),
  );
}

// JSON body: { officialId, category, purpose, date: "YYYY-MM-DD", time: "HH:mm", duration: 30|60, citizen?: {...} }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return api((a) => requestAppointment(a, body, body?.citizen).then((x) => ({ id: x.id, referenceNo: x.referenceNo, status: x.status })), 201);
}
