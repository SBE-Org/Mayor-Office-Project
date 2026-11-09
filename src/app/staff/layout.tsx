import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import { MobileMenu } from "@/components/MobileMenu";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/access";
import { prisma } from "@/server/db";
import { Brand } from "@/components/Brand";
import { logoutAction } from "@/server/actions/auth";
import { NavLinks, type NavItem } from "@/components/NavLinks";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const a = await requireActor();
  if (can(a, "portal.citizen")) redirect("/portal");
  const unread = await prisma.notification.count({ where: { userId: a.id, readAt: null } });

  const items: (NavItem & { show: boolean })[] = [
    { href: "/staff/executive", label: "Executive dashboard", icon: "crown", show: can(a, "dashboard.executive") },
    { href: "/staff/office", label: "Office dashboard", icon: "layout", show: can(a, "dashboard.office") },
    { href: "/staff/department", label: "Department dashboard", icon: "building", show: can(a, "dashboard.department") },
    { href: "/staff/admin", label: "System administration", icon: "settings", show: can(a, "dashboard.admin") },
    { href: "/staff/cases", label: "Cases", icon: "folder", show: ["case.view.all", "case.view.department", "case.view.assigned", "case.view.forwarded", "case.register", "case.view.confidential"].some((p) => a.permissions.has(p)) },
    { href: "/staff/cases/new", label: "Register case", icon: "plus", show: can(a, "case.register") },
    { href: "/staff/appointments", label: "Appointments", icon: "calendar", show: ["appointment.view", "appointment.manage", "appointment.own", "appointment.walkin"].some((p) => a.permissions.has(p)) },
    { href: "/staff/reservations", label: "Reservations", icon: "door", show: can(a, "reservation.request") || can(a, "reservation.manage") },
    { href: "/staff/correspondence", label: "Correspondence", icon: "mail", show: can(a, "correspondence.view") || can(a, "correspondence.manage") },
    { href: "/staff/directory", label: "Departments", icon: "network", show: can(a, "department.view") },
    { href: "/staff/reports", label: "Reports", icon: "chart", show: can(a, "report.view") },
    { href: "/staff/admin/users", label: "Users", icon: "users", show: can(a, "user.manage") },
    { href: "/staff/admin/roles", label: "Roles & permissions", icon: "shield", show: can(a, "role.manage") },
    { href: "/staff/admin/categories", label: "Case categories", icon: "tags", show: can(a, "category.manage") },
    { href: "/staff/admin/facilities", label: "Facilities", icon: "door", show: can(a, "facility.manage") },
    { href: "/staff/admin/audit", label: "Audit log", icon: "history", show: can(a, "audit.view") },
  ];
  const nav = items.filter((i) => i.show).map(({ show: _s, ...i }) => i);

  const sidebar = (
    <>
      <div className="px-4 py-5"><Brand city="Shaggar City" office="Mayor's Office" href="/staff" light /></div>
      <NavLinks items={nav} />
    </>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="no-print hidden w-64 shrink-0 bg-navy-800 lg:block">{sidebar}</aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur">
          <MobileMenu>{sidebar}</MobileMenu>
          <div className="hidden text-sm text-slate-500 lg:block">{a.title ?? a.roleName}</div>
          <div className="flex items-center gap-3">
            <Link href="/staff/notifications" className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100" aria-label={`Notifications (${unread} unread)`}>
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
            </Link>
            <Link href="/staff/profile" className="text-right leading-tight">
              <span className="block text-sm font-medium text-slate-800">{a.fullName}</span>
              <span className="block text-xs text-slate-500">{a.roleName}</span>
            </Link>
            <form action={logoutAction}>
              <button className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Sign out" title="Sign out"><LogOut className="h-5 w-5" /></button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
