import { setLangAction } from "@/server/actions/auth";
import { LANGS, type Lang } from "@/server/i18n";

export function LangSwitcher({ current, light }: { current: Lang; light?: boolean }) {
  return (
    <form action={setLangAction} className="flex items-center gap-1" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.code}
          name="lang"
          value={l.code}
          className={`rounded px-2 py-1 text-xs font-medium ${
            current === l.code ? (light ? "bg-white text-navy-800" : "bg-navy-700 text-white") : light ? "text-white/80 hover:bg-white/10" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {l.name}
        </button>
      ))}
    </form>
  );
}
