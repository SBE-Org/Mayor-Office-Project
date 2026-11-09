import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sendReminders } from "@/server/services/appointments";
import { dispatchOutbound } from "@/server/services/notifications";

export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string) {
  return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Accepts "Authorization: Bearer <token>" where the token is JOB_TOKEN (your own scheduler)
// or CRON_SECRET (Vercel Cron sends this automatically when the variable is set).
function authorized(req: NextRequest) {
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const secrets = [process.env.JOB_TOKEN, process.env.CRON_SECRET].filter((s): s is string => !!s);
  return given.length > 0 && secrets.some((s) => safeEqual(given, s));
}

async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reminded = await sendReminders();
  await dispatchOutbound();
  return NextResponse.json({ reminded });
}

// Daily job. POST for curl/cron/Task Scheduler; GET because Vercel Cron issues GET requests.
export const POST = run;
export const GET = run;
