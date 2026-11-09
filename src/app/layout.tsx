import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getLang } from "@/server/i18n";

export const metadata: Metadata = {
  title: { default: "Shaggar City Mayor's Office", template: "%s · Shaggar Mayor's Office" },
  description: "Digital management system for the Shaggar City Mayor's Office",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const demo = process.env.DEMO_MODE === "true";
  return (
    <html lang={lang}>
      <body className="min-h-screen font-sans">
        {demo && (
          <div className="no-print bg-amber-400 px-4 py-1 text-center text-xs font-semibold text-amber-950">
            DEMONSTRATION ENVIRONMENT — all people, departments and records shown are sample data, not official records.
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
