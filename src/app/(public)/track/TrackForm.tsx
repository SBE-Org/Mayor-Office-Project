"use client";
import { useActionState } from "react";
import { trackAction } from "@/server/actions/cases";
import { SubmitButton } from "@/components/ActionForm";

const nice = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const date = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export function TrackForm({ labels }: { labels: Record<string, string> }) {
  const [state, action] = useActionState(trackAction, null);
  const err = state && !state.ok ? (state.error === "notfound" ? labels.notFound : state.error === "required" ? labels.required : state.error) : null;
  return (
    <div className="space-y-6">
      <form action={action} className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
        <label><span className="label">{labels.referenceNo}</span><input name="referenceNo" placeholder="SMO-2026-000001" className="input uppercase" /></label>
        <span className="pb-2 text-center text-xs font-semibold uppercase text-slate-400">{labels.or}</span>
        <label><span className="label">{labels.phone}</span><input name="phone" type="tel" placeholder="09XXXXXXXX" className="input" /></label>
        <SubmitButton>{labels.search}</SubmitButton>
      </form>

      {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>}

      {state?.ok && state.matches && (
        <div className="card card-pad">
          <p className="text-sm text-slate-700">{labels.choose}</p>
          <ul className="mt-4 divide-y divide-slate-100">
            {state.matches.map((m) => (
              <li key={m.referenceNo} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-navy-800">{m.referenceNo}</p>
                  <p className="truncate text-sm text-slate-800">{m.title}</p>
                  <p className="text-xs text-slate-500">{nice(m.type)} · {m.category} · {date(m.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="badge bg-navy-700 text-white">{nice(m.status)}</span>
                  <form action={action}>
                    <input type="hidden" name="referenceNo" value={m.referenceNo} />
                    <input type="hidden" name="phone" value={state.phone ?? ""} />
                    <SubmitButton className="btn-outline btn-sm">{labels.view}</SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state?.ok && state.result && (
        <div className="card card-pad">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-mono text-sm text-slate-500">{state.result.referenceNo}</p>
              <h2 className="text-lg font-semibold">{state.result.title}</h2>
              <p className="text-sm text-slate-500">{state.result.category} · {date(state.result.createdAt)}</p>
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
