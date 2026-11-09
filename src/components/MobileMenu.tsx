"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

/** Drop-down navigation for small screens; closes itself after navigating. */
export function MobileMenu({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [path]);
  return (
    <details ref={ref} className="relative lg:hidden">
      <summary className="btn-outline btn-sm cursor-pointer list-none"><Menu className="h-4 w-4" /> Menu</summary>
      <div className="absolute left-0 top-10 z-30 max-h-[80vh] w-64 overflow-y-auto rounded-xl bg-navy-800 pb-3 shadow-xl">{children}</div>
    </details>
  );
}
