import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, fmtTime, startOfDay, ymd } from "@/shared/format";

export type CalEvent = { id: string; title: string; start: Date; end: Date; href?: string; status: string; sub?: string };
export type CalView = "day" | "week" | "month";

const STATUS_BG: Record<string, string> = {
  APPROVED: "border-brand-600 bg-brand-50",
  REQUESTED: "border-amber-500 bg-amber-50",
  PENDING: "border-amber-500 bg-amber-50",
  COMPLETED: "border-teal-600 bg-teal-50",
};

export function rangeFor(view: CalView, anchor: Date) {
  const d = startOfDay(anchor);
  if (view === "day") return { from: d, to: addDays(d, 1) };
  if (view === "week") {
    const monday = addDays(d, -((d.getDay() + 6) % 7));
    return { from: monday, to: addDays(monday, 7) };
  }
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const gridStart = addDays(first, -((first.getDay() + 6) % 7));
  return { from: gridStart, to: addDays(gridStart, 42) };
}

export function Calendar({ view, anchor, events, basePath, query = {} }: { view: CalView; anchor: Date; events: CalEvent[]; basePath: string; query?: Record<string, string | undefined> }) {
  const { from, to } = rangeFor(view, anchor);
  const step = view === "day" ? 1 : view === "week" ? 7 : 0;
  const prev = step ? addDays(anchor, -step) : new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
  const next = step ? addDays(anchor, step) : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
  const href = (v: CalView, d: Date) => {
    const p = new URLSearchParams(Object.entries({ ...query, view: v, date: ymd(d) }).filter(([, x]) => x) as [string, string][]);
    return `${basePath}?${p}`;
  };
  const title =
    view === "month"
      ? anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
      : view === "week"
        ? `${from.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${addDays(to, -1).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
        : anchor.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const days: Date[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) days.push(d);
  const todayKey = ymd(new Date());
  const byDay = (d: Date) => events.filter((e) => ymd(e.start) === ymd(d)).sort((a, b) => +a.start - +b.start);

  const Ev = ({ e }: { e: CalEvent }) => {
    const body = (
      <div className={clsx("rounded border-l-4 px-2 py-1 text-xs", STATUS_BG[e.status] ?? "border-slate-400 bg-slate-50")}>
        <p className="font-semibold">{fmtTime(e.start)}–{fmtTime(e.end)}</p>
        <p className="truncate">{e.title}</p>
        {e.sub && view !== "month" && <p className="truncate text-slate-500">{e.sub}</p>}
      </div>
    );
    return e.href ? <Link href={e.href} className="block hover:opacity-80">{body}</Link> : body;
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link href={href(view, prev)} className="btn-outline btn-sm" aria-label="Previous"><ChevronLeft className="h-4 w-4" /></Link>
          <Link href={href(view, new Date())} className="btn-outline btn-sm">Today</Link>
          <Link href={href(view, next)} className="btn-outline btn-sm" aria-label="Next"><ChevronRight className="h-4 w-4" /></Link>
          <h2 className="ml-2 text-base font-semibold">{title}</h2>
        </div>
        <div className="flex rounded-lg border border-slate-300 p-0.5">
          {(["day", "week", "month"] as CalView[]).map((v) => (
            <Link key={v} href={href(v, anchor)} className={clsx("rounded-md px-3 py-1 text-xs font-medium capitalize", v === view ? "bg-navy-700 text-white" : "text-slate-600 hover:bg-slate-100")}>{v}</Link>
          ))}
        </div>
      </div>
      {view === "month" ? (
        <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-slate-200 text-xs">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="bg-slate-50 px-2 py-1 font-semibold text-slate-500">{d}</div>)}
          {days.map((d) => {
            const list = byDay(d);
            return (
              <div key={+d} className={clsx("min-h-24 border-t border-slate-100 p-1", d.getMonth() !== anchor.getMonth() && "bg-slate-50/60 text-slate-400")}>
                <Link href={href("day", d)} className={clsx("mb-1 inline-block rounded px-1 font-medium", ymd(d) === todayKey && "bg-brand-700 text-white")}>{d.getDate()}</Link>
                <div className="space-y-1">
                  {list.slice(0, 3).map((e) => <Ev key={e.id} e={e} />)}
                  {list.length > 3 && <Link href={href("day", d)} className="text-[11px] text-brand-700">+{list.length - 3} more</Link>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={clsx("grid gap-2", view === "week" ? "grid-cols-1 md:grid-cols-7" : "grid-cols-1")}>
          {days.map((d) => (
            <div key={+d} className="rounded-lg border border-slate-200 bg-white">
              <div className={clsx("border-b border-slate-100 px-2 py-1 text-xs font-semibold", ymd(d) === todayKey ? "bg-brand-700 text-white" : "bg-slate-50 text-slate-600")}>
                {d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
              </div>
              <div className="min-h-20 space-y-1 p-1">
                {byDay(d).length ? byDay(d).map((e) => <Ev key={e.id} e={e} />) : <p className="p-2 text-center text-[11px] text-slate-400">—</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
