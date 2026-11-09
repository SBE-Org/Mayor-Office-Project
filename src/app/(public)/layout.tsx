import Link from "next/link";
import { Brand } from "@/components/Brand";
import { LangSwitcher } from "@/components/LangSwitcher";
import { getDict } from "@/server/i18n";
import { getActor } from "@/server/auth/session";
import { homePath } from "@/server/access";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const { t, lang } = await getDict();
  const actor = await getActor();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-navy-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Brand city={t.city} office={t.office} light />
          <div className="flex flex-wrap items-center gap-3">
            <LangSwitcher current={lang} light />
            <Link href="/track" className="text-sm text-white/90 hover:text-white">{t.track}</Link>
            {actor ? (
              <Link href={homePath(actor)} className="btn bg-brand-600 text-white hover:bg-brand-500">{t.dashboard}</Link>
            ) : (
              <Link href="/login" className="btn bg-brand-600 text-white hover:bg-brand-500">{t.login}</Link>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-slate-500">
          © {new Date().getFullYear()} {t.city} — {t.office}. {t.systemName}.
        </div>
      </footer>
    </div>
  );
}
