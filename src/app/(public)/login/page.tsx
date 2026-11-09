import Link from "next/link";
import { redirect } from "next/navigation";
import { getDict } from "@/server/i18n";
import { getActor } from "@/server/auth/session";
import { homePath } from "@/server/access";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

const DEMO = [
  ["Mayor", "mayor@demo.local"],
  ["Deputy Mayor (Economic)", "deputy.economic@demo.local"],
  ["Deputy Mayor (Social)", "deputy.social@demo.local"],
  ["Head of Mayor's Office", "chief@demo.local"],
  ["Mayor's Secretary", "secretary@demo.local"],
  ["Office Assistant", "assistant@demo.local"],
  ["Case Registration Officer", "registrar@demo.local"],
  ["Case Review Officer", "reviewer@demo.local"],
  ["Document Officer", "documents@demo.local"],
  ["Department Head (Land)", "land.head@demo.local"],
  ["Department Officer (Land)", "land.officer@demo.local"],
  ["Super Administrator", "admin@demo.local"],
  ["Citizen", "citizen@demo.local"],
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const actor = await getActor();
  if (actor) redirect(homePath(actor));
  const { t } = await getDict();
  const { next } = await searchParams;
  const demo = process.env.DEMO_MODE === "true";
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 md:grid-cols-2">
      <div className="card card-pad">
        <h1 className="text-xl font-semibold">{t.login}</h1>
        <div className="mt-5">
          <LoginForm next={next} labels={{ email: t.email, password: t.password, authCode: t.authCode, login: t.login }} />
        </div>
        <p className="mt-4 text-xs text-slate-500">{t.forgot}</p>
        <p className="mt-4 text-sm text-slate-600">
          {t.noAccount} <Link href="/register" className="link">{t.register}</Link>
        </p>
      </div>
      {demo && (
        <div className="card card-pad border-amber-300 bg-amber-50">
          <h2 className="text-sm font-semibold text-amber-900">Demo accounts (demo environment only)</h2>
          <p className="mt-1 text-xs text-amber-900">
            Password for every demo account: <code className="rounded bg-white px-1">Demo@2026pass</code>
          </p>
          <table className="mt-3 w-full text-xs">
            <tbody>
              {DEMO.map(([r, e]) => (
                <tr key={e} className="border-t border-amber-200">
                  <td className="py-1 pr-2 text-amber-900">{r}</td>
                  <td className="py-1 font-mono text-amber-950">{e}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
