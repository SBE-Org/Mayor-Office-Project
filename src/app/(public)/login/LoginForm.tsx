"use client";
import { useActionState } from "react";
import { loginAction } from "@/server/actions/auth";
import { FormMessage, SubmitButton } from "@/components/ActionForm";

export function LoginForm({ labels, next }: { labels: Record<string, string>; next?: string }) {
  const [state, action] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="block">
        <span className="label">{labels.email}</span>
        <input name="email" type="email" required autoComplete="username" defaultValue={state?.data?.email} className="input" />
      </label>
      <label className="block">
        <span className="label">{labels.password}</span>
        <input name="password" type="password" required autoComplete="current-password" className="input" />
      </label>
      {state?.needCode && (
        <label className="block">
          <span className="label">{labels.authCode}</span>
          <input name="code" inputMode="numeric" pattern="[0-9 ]{6,7}" autoComplete="one-time-code" autoFocus className="input tracking-widest" />
        </label>
      )}
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full">{labels.login}</SubmitButton>
    </form>
  );
}
