"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";

type Official = { id: string; name: string; title: string | null };

export function SlotPicker({ officials, labels, minDate }: { officials: Official[]; labels: Record<string, string>; minDate: string }) {
  const [officialId, setOfficialId] = useState(officials[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<{ time: string; free: boolean }[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTime("");
    if (!officialId || !date) return setSlots(null);
    let cancelled = false;
    setLoading(true);
    fetch(`/api/availability?officialId=${encodeURIComponent(officialId)}&date=${encodeURIComponent(date)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((s) => !cancelled && setSlots(s))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [officialId, date]);

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="label">{labels.official}</span>
        <select name="officialId" required value={officialId} onChange={(e) => setOfficialId(e.target.value)} className="input">
          {officials.map((o) => (
            <option key={o.id} value={o.id}>{o.name}{o.title ? ` — ${o.title}` : ""}</option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">{labels.date}</span>
          <input type="date" name="date" required min={minDate} value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="label">{labels.duration}</span>
          <select name="duration" className="input" defaultValue="30">
            <option value="30">30 {labels.minutes}</option>
            <option value="60">60 {labels.minutes}</option>
          </select>
        </label>
      </div>
      <input type="hidden" name="time" value={time} />
      {date && (
        <div>
          <span className="label">{labels.availableSlots}</span>
          {loading ? (
            <p className="text-sm text-slate-500">…</p>
          ) : slots && slots.some((s) => s.free) ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {slots.map((s) => (
                <button
                  key={s.time}
                  type="button"
                  disabled={!s.free}
                  onClick={() => setTime(s.time)}
                  aria-pressed={time === s.time}
                  className={clsx(
                    "rounded-md border px-2 py-1.5 text-sm",
                    !s.free && "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through",
                    s.free && time !== s.time && "border-brand-200 bg-white text-brand-800 hover:bg-brand-50",
                    time === s.time && "border-brand-700 bg-brand-700 text-white",
                  )}
                >
                  {s.time}
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{labels.noSlots}</p>
          )}
        </div>
      )}
    </div>
  );
}
