import { NextResponse, type NextRequest } from "next/server";
import { getActor } from "@/server/auth/session";
import { availability } from "@/server/services/appointments";

// Returns free/booked slots only (no visitor details).
export async function GET(req: NextRequest) {
  if (!(await getActor())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const officialId = req.nextUrl.searchParams.get("officialId") ?? "";
  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!officialId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json([]);
  return NextResponse.json(await availability(officialId, date));
}
