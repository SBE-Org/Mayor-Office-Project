"use client";
import { useActionState } from "react";
import { trackAction } from "@/server/actions/cases";
import { SubmitButton } from "@/components/ActionForm";

const nice = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function TrackForm({ labels }: { labels: Record<string, string> }) {
  const [state, action] = useActionState(trackAction, null);
  return (
    <div className="space-y-6">
      <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label><span className="label">{labels.referenceNo}</span><input name="referenceNo" required placeholder="SMO-2026-000001" className="input uppercase" /></label>
        <label><span className="label">{labels.phone}</span><input name="phone" required className="input" /></label>
        <SubmitButton>{labels.search}</SubmitButton>
      </form>
      {state && !state.ok && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{state.error === "notfound" ? labels.notFound : state.error}</p>}
      {state?.ok && state.result && (
        <div className="card card-pad">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-sm text-slate-500">{state.result.referenceNo}</p>
              <h2 className="text-lg font-semibold">{state.result.title}</h2>
              <p className="text-sm text-slate-500">{state.result.category}</p>
            </div>
            <span className="badge bg-navy-700 px-3 py-1 text-sm text-white">{nice(state.result.status)}</span>
          </div>
          <ol className="mt-5 space-y-3 border-l border-slate-200 pl-4">
            {state.result.actions.map((a, i) => (
              <li key={i}>
                <p className="text-sm font-medium">{a.action}</p>
                <p className="text-xs text-slate-500">{new Date(a.createdAt).toLocaleString("en-GB")}</p>
                {a.note && <p className="mt-1 text-sm text-slate-600">{a.note}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
