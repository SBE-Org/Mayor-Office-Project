"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  BarChart3, Building2, CalendarDays, Crown, DoorOpen, FolderOpen, History, LayoutDashboard, Mail, Network, Plus, Settings, ShieldCheck, Tags, Users,
} from "lucide-react";

const ICONS = {
  crown: Crown, layout: LayoutDashboard, building: Building2, settings: Settings, folder: FolderOpen, plus: Plus, calendar: CalendarDays,
  door: DoorOpen, mail: Mail, network: Network, chart: BarChart3, users: Users, shield: ShieldCheck, tags: Tags, history: History,
};
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

export function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  // Highlight the most specific matching link only.
  const active = items
    .filter((i) => path === i.href || path.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="space-y-0.5 px-2">
      {items.map((i) => {
        const Icon = ICONS[i.icon];
        return (
          <Link
            key={i.href}
            href={i.href}
            className={clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
              active === i.href ? "bg-brand-700 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4" /> {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
