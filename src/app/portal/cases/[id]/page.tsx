import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { getCase } from "@/server/services/cases";
import { NotFoundError } from "@/server/errors";
import { getDict } from "@/server/i18n";
import { catName, statusName } from "@/shared/localize";
import { fmtDateTime } from "@/shared/format";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Badge, Card, Field, Timeline } from "@/components/ui";
import { DocumentList } from "@/components/DocumentList";
import { feedbackAction, provideInfoAction } from "@/server/actions/cases";

export default async function CitizenCase({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const a = await requireActor("portal.citizen");
  const { t, lang } = await getDict();
  const { id } = await params;
  const sp = await searchParams;
  let c;
  try {
    c = await getCase(a, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const lastRequest = [...c.actions].reverse().find((x) => x.toStatus === "INFO_REQUESTED");
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {sp.new && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-brand-900">
          <p className="text-sm">{t.referenceNo}:</p>
          <p className="font-mono text-2xl font-semibold">{c.referenceNo}</p>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm text-slate-500">{c.referenceNo}</p>
          <h1 className="text-2xl font-semibold">{c.title}</h1>
          <p className="text-sm text-slate-500">{catName(c.category, lang)} · {t.submitted} {fmtDateTime(c.createdAt)}</p>
        </div>
        <Badge value={c.status} text={statusName(c.status, lang)} />
      </div>

      {c.status === "INFO_REQUESTED" && (
        <Card title={t.provideInfo} className="border-amber-300">
          {lastRequest?.note && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{lastRequest.note}</p>}
          <ActionForm action={provideInfoAction.bind(null, c.id)}>
            <Field label={t.description}><textarea name="text" rows={4} required className="input" /></Field>
            <Field label={t.documents} hint={t.documentsHint}><input type="file" name="files" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="input" /></Field>
            <SubmitButton>{t.submit}</SubmitButton>
          </ActionForm>
        </Card>
      )}

      {c.status === "CLOSED" && c.resolution && (
        <Card title={statusName("CLOSED", lang)}><p className="whitespace-pre-wrap text-sm">{c.resolution}</p></Card>
      )}

      {c.status === "CLOSED" && c.feedback.length === 0 && (
        <Card title={t.feedback}>
          <ActionForm action={feedbackAction.bind(null, c.id)}>
            <div className="flex gap-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="flex cursor-pointer flex-col items-center text-sm">
                  <input type="radio" name="rating" value={n} required className="peer sr-only" />
                  <span className="rounded-lg border border-slate-300 px-3 py-2 text-lg peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white">{"★".repeat(n)}</span>
                </label>
              ))}
            </div>
            <textarea name="comment" rows={2} className="input" />
            <SubmitButton>{t.submit}</SubmitButton>
          </ActionForm>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card title={t.description}><p className="whitespace-pre-wrap text-sm">{c.description}</p></Card>
        <Card title={t.documents}><DocumentList docs={c.documents} /></Card>
      </div>
      <Card title={t.history}>
        <Timeline items={c.actions.map((x) => ({ id: x.id, title: x.action, note: x.note, at: x.createdAt }))} />
      </Card>
    </div>
  );
}
