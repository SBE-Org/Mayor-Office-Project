"use client";
import { useActionState } from "react";
import { beginMfaAction } from "@/server/actions/auth";
import type { ActionResult } from "@/server/action";
import { ActionForm, FormMessage, SubmitButton } from "./ActionForm";

export function MfaSetup({ confirmAction }: { confirmAction: (p: ActionResult | null, fd: FormData) => Promise<ActionResult> }) {
  const [state, begin] = useActionState(beginMfaAction, null);
  const secret = state?.data?.secret;
  if (!secret)
    return (
      <form action={begin} className="space-y-3">
        <p className="text-sm text-slate-600">Protect your account with a time-based code from an authenticator app (e.g. Google Authenticator, Microsoft Authenticator).</p>
        <FormMessage state={state && !state.ok ? state : null} />
        <SubmitButton className="btn-outline">Set up</SubmitButton>
      </form>
    );
  const issuer = "Shaggar Mayor's Office";
  const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(state?.data?.email ?? "")}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">In your authenticator app choose “enter a setup key” and type this key (time-based):</p>
      <p className="select-all break-all rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm tracking-wider">{secret.match(/.{1,4}/g)?.join(" ")}</p>
      <details className="text-xs text-slate-500"><summary className="cursor-pointer">Setup link</summary><p className="select-all break-all">{uri}</p></details>
      <ActionForm action={confirmAction}>
        <label className="block"><span className="label">6-digit code from the app</span><input name="code" inputMode="numeric" required className="input tracking-widest" /></label>
        <SubmitButton>Confirm &amp; enable</SubmitButton>
      </ActionForm>
    </div>
  );
}
