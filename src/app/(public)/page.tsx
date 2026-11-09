import Link from "next/link";
import { CalendarClock, FileText, Search } from "lucide-react";
import { getDict } from "@/server/i18n";

export default async function Home() {
  const { t } = await getDict();
  const services = [
    { icon: CalendarClock, title: t.svcAppointments, text: t.svcAppointmentsText, href: "/portal/appointments/new" },
    { icon: FileText, title: t.svcCases, text: t.svcCasesText, href: "/portal/cases/new" },
    { icon: Search, title: t.svcTrack, text: t.svcTrackText, href: "/track" },
  ];
  return (
    <>
      <section className="bg-gradient-to-br from-navy-800 via-navy-700 to-brand-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="text-sm font-medium uppercase tracking-widest text-brand-100">{t.city} · {t.office}</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-5xl">{t.heroTitle}</h1>
          <p className="mt-5 max-w-2xl text-base text-white/80 sm:text-lg">{t.heroText}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn bg-white px-6 py-3 text-navy-800 hover:bg-brand-50">{t.register}</Link>
            <Link href="/login" className="btn border border-white/40 px-6 py-3 text-white hover:bg-white/10">{t.login}</Link>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-12 md:grid-cols-3">
        {services.map((s) => (
          <Link key={s.title} href={s.href} className="card card-pad group transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
            <s.icon className="h-8 w-8 text-brand-700" />
            <h2 className="mt-4 text-lg font-semibold">{s.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{s.text}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
