import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import { requireActor } from "@/server/auth/session";
import { can, homePath } from "@/server/access";
import { prisma } from "@/server/db";
import { getDict } from "@/server/i18n";
import { Brand } from "@/components/Brand";
import { LangSwitcher } from "@/components/LangSwitcher";
import { logoutAction } from "@/server/actions/auth";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const a = await requireActor();
  if (!can(a, "portal.citizen")) redirect(homePath(a));
  const { t, lang } = await getDict();
  const unread = await prisma.notification.count({ where: { userId: a.id, readAt: null } });
  const links = [
    ["/portal", t.dashboard],
    ["/portal/cases/new", t.newCase],
    ["/portal/appointments", t.myAppointments],
    ["/portal/profile", t.profile],
  ];
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-navy-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Brand city={t.city} office={t.office} href="/portal" light />
          <div className="flex items-center gap-2">
            <LangSwitcher current={lang} light />
            <Link href="/portal/notifications" className="relative rounded-full p-2 text-white hover:bg-white/10" aria-label={t.notifications}>
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
            </Link>
            <form action={logoutAction}><button className="rounded-full p-2 text-white hover:bg-white/10" aria-label={t.logout} title={t.logout}><LogOut className="h-5 w-5" /></button></form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {links.map(([href, l]) => <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-white/85 hover:bg-white/10 hover:text-white">{l}</Link>)}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
