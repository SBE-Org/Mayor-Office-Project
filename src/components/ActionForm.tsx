"use client";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { ActionResult } from "@/server/action";

type Props = {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  children: ReactNode | ((state: ActionResult | null) => ReactNode);
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
};

export function ActionForm({ action, children, className, resetOnSuccess, confirm }: Props) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className ?? "space-y-4"}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {typeof children === "function" ? children(state) : children}
      <FormMessage state={state} />
    </form>
  );
}

export function FormMessage({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  if (state.ok)
    return (
      <p role="status" className="flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> <span className="whitespace-pre-wrap">{state.message}</span>
      </p>
    );
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{state.error}</span>
    </p>
  );
}

export function SubmitButton({ children, className, name, value }: { children: ReactNode; className?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={className ?? "btn-primary"}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
