import Link from "next/link";
import { getDict } from "@/server/i18n";
import { activeSubCities } from "@/server/services/directory";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { registerAction } from "@/server/actions/auth";

export const metadata = { title: "Create account" };

export default async function RegisterPage() {
  const { t, lang } = await getDict();
  const subCities = await activeSubCities();
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="card card-pad">
        <h1 className="text-xl font-semibold">{t.register}</h1>
        <ActionForm action={registerAction} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="label">{t.fullName}</span><input name="fullName" required minLength={3} className="input" /></label>
          <label><span className="label">{t.email}</span><input name="email" type="email" required className="input" /></label>
          <label><span className="label">{t.phone}</span><input name="phone" required placeholder="09XXXXXXXX" className="input" /></label>
          <label>
            <span className="label">{t.subCity}</span>
            <select name="subCityId" className="input"><option value="">—</option>{subCities.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label><span className="label">Woreda</span><input name="woreda" className="input" /></label>
            <label><span className="label">Kebele</span><input name="kebele" className="input" /></label>
          </div>
          <label>
            <span className="label">Gender</span>
            <select name="gender" className="input"><option value="">—</option><option value="FEMALE">Female</option><option value="MALE">Male</option></select>
          </label>
          <label>
            <span className="label">{t.language}</span>
            <select name="preferredLanguage" defaultValue={lang} className="input"><option value="om">Afaan Oromoo</option><option value="am">አማርኛ</option><option value="en">English</option></select>
          </label>
          <label><span className="label">{t.password}</span><input name="password" type="password" required minLength={10} autoComplete="new-password" className="input" /><span className="hint block">10+ characters, letters and numbers</span></label>
          <label><span className="label">{t.confirmPassword}</span><input name="confirm" type="password" required autoComplete="new-password" className="input" /></label>
          <div className="sm:col-span-2"><SubmitButton className="btn-primary w-full">{t.register}</SubmitButton></div>
        </ActionForm>
        <p className="mt-4 text-sm text-slate-600">{t.haveAccount} <Link href="/login" className="link">{t.login}</Link></p>
      </div>
    </div>
  );
}
