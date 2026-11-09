import { requireActor } from "@/server/auth/session";
import { officials } from "@/server/services/appointments";
import { getDict } from "@/server/i18n";
import { ymd } from "@/shared/format";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { SlotPicker } from "@/components/SlotPicker";
import { Card, Field } from "@/components/ui";
import { requestAppointmentAction } from "@/server/actions/operations";

const CATS: Record<string, Record<string, string>> = {
  PERSONAL_CASE: { en: "Personal case", om: "Dhimma dhuunfaa", am: "የግል ጉዳይ" },
  COMMUNITY_MATTER: { en: "Community matter", om: "Dhimma hawaasaa", am: "የማህበረሰብ ጉዳይ" },
  INVESTMENT_BUSINESS: { en: "Investment / business", om: "Invastimantii / daldala", am: "ኢንቨስትመንት / ንግድ" },
  INSTITUTIONAL: { en: "Institutional", om: "Dhaabbataa", am: "ተቋማዊ" },
  COURTESY_VISIT: { en: "Courtesy visit", om: "Daawwannaa kabajaa", am: "የአክብሮት ጉብኝት" },
  OTHER: { en: "Other", om: "Kan biroo", am: "ሌላ" },
};

export default async function NewCitizenAppointment() {
  await requireActor("portal.citizen");
  const { t, lang } = await getDict();
  const offs = await officials();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold">{t.newAppointment}</h1>
      <Card>
        <ActionForm action={requestAppointmentAction}>
          <SlotPicker
            minDate={ymd(new Date())}
            officials={offs.map((o) => ({ id: o.id, name: o.fullName, title: o.title }))}
            labels={{ official: t.official, date: t.date, duration: t.duration, minutes: t.minutes, availableSlots: t.availableSlots, noSlots: t.noSlots }}
          />
          <Field label={t.category}>
            <select name="category" className="input">{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v[lang]}</option>)}</select>
          </Field>
          <Field label={t.purpose}><textarea name="purpose" rows={4} required minLength={10} className="input" /></Field>
          <SubmitButton>{t.submit}</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
