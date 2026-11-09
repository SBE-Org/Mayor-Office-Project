import { revalidatePath } from "next/cache";
import { userMessage } from "@/server/errors";
import { dispatchOutbound } from "@/server/services/notifications";

export type ActionResult = { ok: boolean; message?: string; error?: string; needCode?: boolean; data?: Record<string, string> };

/** Runs a mutation, converts errors into a user-facing message and revalidates the given paths. */
export async function run(fn: () => Promise<string | void | ActionResult>, paths: string[] = []): Promise<ActionResult> {
  try {
    const r = await fn();
    for (const p of paths) revalidatePath(p);
    void dispatchOutbound().catch(() => {});
    if (r && typeof r === "object") return r;
    return { ok: true, message: r || "Saved." };
  } catch (e) {
    // Let Next.js redirects propagate
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
    return { ok: false, error: userMessage(e) };
  }
}

export function str(fd: FormData, k: string) {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
}
export function formObject(fd: FormData, keys: string[]) {
  const o: Record<string, string> = {};
  for (const k of keys) o[k] = str(fd, k);
  return o;
}
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
