import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sendReminders } from "@/server/services/appointments";
import { dispatchOutbound } from "@/server/services/notifications";

// Daily job (e.g. cron 17:00): POST with header "Authorization: Bearer $JOB_TOKEN".
export async function POST(req: NextRequest) {
  const expected = process.env.JOB_TOKEN;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!expected || given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const reminded = await sendReminders();
  await dispatchOutbound();
  return NextResponse.json({ reminded });
}
