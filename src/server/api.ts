import { NextResponse } from "next/server";
import { getActor } from "@/server/auth/session";
import { AppError, ForbiddenError, NotFoundError, userMessage } from "@/server/errors";
import type { Actor } from "@/server/access";

/** Wraps a REST handler: requires a signed-in session and maps errors to HTTP status codes. */
export async function api(fn: (a: Actor) => Promise<unknown>, status = 200) {
  const a = await getActor();
  if (!a) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ data: await fn(a) }, { status });
  } catch (e) {
    const code = e instanceof ForbiddenError ? 403 : e instanceof NotFoundError ? 404 : e instanceof AppError || (e && typeof e === "object" && "issues" in e) ? 400 : 500;
    return NextResponse.json({ error: userMessage(e) }, { status: code });
  }
}
