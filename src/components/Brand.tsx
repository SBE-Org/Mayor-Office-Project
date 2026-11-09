import Link from "next/link";
import { Landmark } from "lucide-react";

// Neutral placeholder mark. Replace with the official Shaggar City emblem only when authorised assets are supplied.
export function Brand({ city, office, href = "/", light }: { city: string; office: string; href?: string; light?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-3">
      <span className={`flex h-10 w-10 items-center justify-center rounded-full ${light ? "bg-white/10 text-white" : "bg-brand-700 text-white"}`}>
        <Landmark className="h-5 w-5" />
      </span>
      <span className="leading-tight">
        <span className={`block text-xs font-medium uppercase tracking-wider ${light ? "text-brand-100" : "text-brand-700"}`}>{city}</span>
        <span className={`block text-sm font-semibold ${light ? "text-white" : "text-navy-800"}`}>{office}</span>
      </span>
    </Link>
  );
}
