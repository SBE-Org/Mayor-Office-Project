import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/access";
import { getCorrespondence, nextStatuses } from "@/server/services/correspondence";
import { NotFoundError } from "@/server/errors";
import { label } from "@/shared/constants";
import { fmtDate, fmtDateTime } from "@/shared/format";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Badge, Card, DL, Field, PageHeader, Timeline } from "@/components/ui";
import { DocumentList } from "@/components/DocumentList";
import { PrintButton } from "@/components/PrintButton";
import * as act from "@/server/actions/operations";

export const metadata = { title: "Correspondence" };

export default async function CorrespondenceDetail({ params }: { params: Promise<{ id: string }> }) {
  const a = await requireActor(["correspondence.view", "correspondence.manage"]);
  const { id } = await params;
  let c;
  try {
    c = await getCorrespondence(a, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const next = nextStatuses(c.direction, c.status).filter((s) => (s === "APPROVED" ? can(a, "correspondence.approve") : can(a, "correspondence.manage")));
  return (
    <div className="max-w-5xl">
      <PageHeader title={c.subject} subtitle={`${c.documentNo} · ${label(c.direction)}`} actions={<><Link href="/staff/correspondence" className="btn-outline">Back</Link><PrintButton /></>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Record">
            <div className="mb-4 flex gap-2"><Badge value={c.status} />{c.confidentiality !== "NORMAL" && <Badge value={c.confidentiality} kind="conf" />}</div>
            <DL
              items={[
                ["From", c.senderOrg],
                ["To", c.recipientOrg],
                ["Letter date", fmtDate(c.letterDate)],
                ["Received", fmtDate(c.receivedDate)],
                ["Approved", fmtDateTime(c.approvedAt)],
                ["Archived", fmtDateTime(c.archivedAt)],
                ["Related case", c.case ? <Link key="c" href={`/staff/cases/${c.case.id}`} className="link">{c.case.referenceNo}</Link> : "—"],
              ]}
            />
            {c.summary && <p className="mt-4 whitespace-pre-wrap text-sm">{c.summary}</p>}
          </Card>
          <Card title="Attachments"><DocumentList docs={c.documents} /></Card>
          <Card title="History"><Timeline items={c.history.map((h) => ({ id: h.id, title: h.action, who: h.actorName, note: h.note, at: h.createdAt }))} /></Card>
        </div>
        <aside className="no-print space-y-4">
          {next.length > 0 && (
            <Card title="Workflow">
              <ActionForm action={act.correspondenceStatusAction.bind(null, c.id)}>
                <Field label="Note (optional)"><input name="note" className="input" /></Field>
                <div className="flex flex-wrap gap-2">
                  {next.map((s) => <SubmitButton key={s} name="to" value={s} className={s === "APPROVED" ? "btn-primary" : "btn-outline"}>{label(s)}</SubmitButton>)}
                </div>
              </ActionForm>
            </Card>
          )}
          {can(a, "correspondence.manage") && c.status !== "ARCHIVED" && (
            <Card title="Add attachment or note">
              <ActionForm action={act.correspondenceFilesAction.bind(null, c.id)} resetOnSuccess>
                <Field label="Files"><input name="files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="input" /></Field>
                <Field label="Note"><input name="note" className="input" /></Field>
                <SubmitButton className="btn-outline">Save</SubmitButton>
              </ActionForm>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
