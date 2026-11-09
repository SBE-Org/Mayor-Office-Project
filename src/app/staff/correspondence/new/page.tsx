import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { ymd } from "@/shared/format";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, Field, PageHeader, Select, opts } from "@/components/ui";
import { createCorrespondenceAction } from "@/server/actions/operations";

export const metadata = { title: "Register correspondence" };

export default async function NewCorrespondence() {
  await requireActor("correspondence.manage");
  const staff = await prisma.user.findMany({ where: { isActive: true, role: { code: { notIn: ["CITIZEN", "SUPER_ADMIN"] } } }, orderBy: { fullName: "asc" } });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Register correspondence" subtitle="A document number (IN/… or OUT/…) is assigned automatically." />
      <Card>
        <ActionForm action={createCorrespondenceAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Direction"><Select name="direction" options={opts(["INCOMING", "OUTGOING"])} /></Field>
          <Field label="Confidentiality"><Select name="confidentiality" options={opts(["NORMAL", "CONFIDENTIAL"])} /></Field>
          <Field label="Subject" className="sm:col-span-2"><input name="subject" required className="input" /></Field>
          <Field label="Sender organisation"><input name="senderOrg" required className="input" /></Field>
          <Field label="Recipient organisation"><input name="recipientOrg" required className="input" /></Field>
          <Field label="Letter date"><input name="letterDate" type="date" required defaultValue={ymd(new Date())} className="input" /></Field>
          <Field label="Received date (incoming)"><input name="receivedDate" type="date" className="input" /></Field>
          <Field label="Related case reference (optional)"><input name="caseReference" placeholder="SMO-2026-000001" className="input uppercase" /></Field>
          <Field label="Handler (optional)"><Select name="handlerId" placeholder="—" options={staff.map((u) => ({ value: u.id, label: u.fullName }))} /></Field>
          <Field label="Summary" className="sm:col-span-2"><textarea name="summary" rows={3} className="input" /></Field>
          <Field label="Scanned letter / attachments" className="sm:col-span-2" hint="PDF, JPG, PNG, DOC, DOCX — up to 5 files, 10 MB each"><input name="files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="input" /></Field>
          <div className="sm:col-span-2"><SubmitButton>Register</SubmitButton></div>
        </ActionForm>
      </Card>
    </div>
  );
}
