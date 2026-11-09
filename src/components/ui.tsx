import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";
import { label } from "@/shared/constants";

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "bg-slate-100 text-slate-700",
  REGISTERED: "bg-sky-100 text-sky-800",
  UNDER_REVIEW: "bg-indigo-100 text-indigo-800",
  INFO_REQUESTED: "bg-amber-100 text-amber-800",
  AWAITING_EXECUTIVE: "bg-purple-100 text-purple-800",
  DECIDED: "bg-fuchsia-100 text-fuchsia-800",
  ASSIGNED: "bg-cyan-100 text-cyan-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  RESPONDED: "bg-teal-100 text-teal-800",
  CLOSED: "bg-brand-100 text-brand-800",
  REQUESTED: "bg-amber-100 text-amber-800",
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-brand-100 text-brand-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-slate-200 text-slate-600",
  COMPLETED: "bg-teal-100 text-teal-800",
  NO_SHOW: "bg-orange-100 text-orange-800",
  DISPATCHED: "bg-cyan-100 text-cyan-800",
  ARCHIVED: "bg-slate-200 text-slate-600",
  SENT: "bg-brand-100 text-brand-800",
  SKIPPED: "bg-slate-200 text-slate-600",
  FAILED: "bg-red-100 text-red-800",
  QUEUED: "bg-amber-100 text-amber-800",
};
const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600",
  NORMAL: "bg-sky-50 text-sky-700",
  HIGH: "bg-orange-100 text-orange-800",
  URGENT: "bg-red-600 text-white",
};

export function Badge({ value, kind = "status", text }: { value: string; kind?: "status" | "priority" | "conf"; text?: string }) {
  const color =
    kind === "priority"
      ? PRIORITY_COLORS[value]
      : kind === "conf"
        ? value === "NORMAL"
          ? "bg-slate-100 text-slate-600"
          : value === "STRICT"
            ? "bg-red-800 text-white"
            : "bg-red-100 text-red-800"
        : STATUS_COLORS[value];
  return <span className={clsx("badge", color ?? "bg-slate-100 text-slate-700")}>{text ?? label(value)}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, actions, className }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={clsx("card", className)}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-navy-800">{title}</h2>
          {actions}
        </header>
      )}
      <div className="card-pad">{children}</div>
    </section>
  );
}

export function Stat({ label: l, value, href, tone = "default", icon }: { label: string; value: ReactNode; href?: string; tone?: "default" | "warn" | "danger" | "good"; icon?: ReactNode }) {
  const toneCls = { default: "text-navy-800", warn: "text-amber-700", danger: "text-red-700", good: "text-brand-700" }[tone];
  const inner = (
    <div className="card card-pad flex h-full items-start justify-between transition hover:border-brand-200">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{l}</p>
        <p className={clsx("mt-1 text-3xl font-semibold", toneCls)}>{value}</p>
      </div>
      {icon && <div className="rounded-lg bg-slate-50 p-2 text-slate-400">{icon}</div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">{children}</p>;
}

export function Field({ label: l, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{l}</span>
      {children}
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

export function DL({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{k}</dt>
          <dd className="mt-0.5 text-sm text-slate-800">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Timeline({ items }: { items: { id: string; title: string; who?: string | null; note?: string | null; at: Date; tag?: ReactNode }[] }) {
  if (!items.length) return <Empty>No history yet.</Empty>;
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {items.map((i) => (
        <li key={i.id} className="relative">
          <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand-600" />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-slate-800">{i.title}</span>
            {i.tag}
          </div>
          <p className="text-xs text-slate-500">
            {i.at.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
            {i.who ? ` · ${i.who}` : ""}
          </p>
          {i.note && <p className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">{i.note}</p>}
        </li>
      ))}
    </ol>
  );
}

const nice = (s: string) => (/^[A-Z_]+$/.test(s) ? label(s) : s);

export function BarList({ rows }: { rows: { name: string; count: number }[] }) {
  const m = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return <Empty>No data for this period.</Empty>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.name} className="text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-slate-700">{nice(r.name)}</span>
            <span className="font-medium text-slate-900">{r.count}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-brand-600" style={{ width: `${(r.count / m) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Select({ name, options, defaultValue, placeholder, required, className }: { name: string; options: { value: string; label: string }[]; defaultValue?: string | null; placeholder?: string; required?: boolean; className?: string }) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} required={required} className={clsx("input", className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export const opts = (values: readonly string[]) => values.map((v) => ({ value: v, label: label(v) }));
