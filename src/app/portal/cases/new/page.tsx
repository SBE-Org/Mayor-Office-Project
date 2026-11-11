import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { activeCategories, activeSubCities } from "@/server/services/directory";
import { getDict } from "@/server/i18n";
import { catName } from "@/shared/localize";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, Field } from "@/components/ui";
import { submitCaseAction } from "@/server/actions/cases";

const TYPES: Record<string, Record<string, string>> = {
  CASE: { en: "Personal case", om: "Dhimma dhuunfaa", am: "የግል ጉዳይ" },
  COMPLAINT: { en: "Complaint", om: "Komii", am: "ቅሬታ" },
  PETITION: { en: "Petition", om: "Iyyannoo", am: "አቤቱታ" },
  SUGGESTION: { en: "Suggestion", om: "Yaada", am: "አስተያየት" },
  FEEDBACK: { en: "Feedback", om: "Duub-deebii", am: "ግብረ መልስ" },
};

export default async function NewCitizenCase() {
  const a = await requireActor("portal.citizen");
  const { t, lang } = await getDict();
  const [cats, subs, me] = await Promise.all([
    activeCategories(),
    activeSubCities(),
    a.citizenId ? prisma.citizen.findUnique({ where: { id: a.citizenId }, select: { subCityId: true } }) : null,
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold">{t.newCase}</h1>
      <Card>
        <ActionForm action={submitCaseAction} className="grid gap-4 sm:grid-cols-2">
          <Field label={t.type}>
            <select name="type" required className="input">{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}</select>
          </Field>
          <Field label={t.category} hint={cats.length ? undefined : t.noCategories}>
            <select name="categoryId" required className="input">
              <option value="">{cats.length ? "—" : "…"}</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{catName(c, lang)}</option>)}
            </select>
          </Field>
          <Field label={t.subCity} hint={subs.length ? undefined : t.noSubCities}>
            <select name="subCityId" defaultValue={me?.subCityId ?? ""} className="input">
              <option value="">—</option>
              {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <div />
          <Field label={t.title} className="sm:col-span-2"><input name="title" required minLength={5} maxLength={200} className="input" /></Field>
          <Field label={t.description} className="sm:col-span-2"><textarea name="description" required minLength={20} rows={7} className="input" /></Field>
          <Field label={t.documents} hint={t.documentsHint} className="sm:col-span-2"><input type="file" name="files" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="input" /></Field>
          <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" name="sensitive" className="mt-1" /> {t.confidential}</label>
          <div className="sm:col-span-2"><SubmitButton>{t.submit}</SubmitButton></div>
        </ActionForm>
      </Card>
    </div>
  );
}
