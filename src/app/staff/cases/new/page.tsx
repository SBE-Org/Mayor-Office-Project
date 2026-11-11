import { requireActor } from "@/server/auth/session";
import { activeCategories, locationTree } from "@/server/services/directory";
import { LocationPicker } from "@/components/LocationPicker";
import { CASE_CHANNELS, CASE_TYPES, CONFIDENTIALITY, PRIORITIES } from "@/shared/constants";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Card, Field, PageHeader, Select, opts } from "@/components/ui";
import { submitCaseAction } from "@/server/actions/cases";

export const metadata = { title: "Register case" };

export default async function NewStaffCase() {
  await requireActor("case.register");
  const [cats, tree] = await Promise.all([activeCategories(), locationTree()]);
  return (
    <div className="max-w-4xl">
      <PageHeader title="Register a walk-in or offline case" subtitle="A unique reference number is generated automatically. Give it to the citizen for tracking." />
      <ActionForm action={submitCaseAction} className="space-y-6">
        <Card title="Citizen">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><input name="fullName" required minLength={3} className="input" /></Field>
            <Field label="Phone number" hint="Used by the citizen to track the case"><input name="phone" required className="input" /></Field>
            <Field label="Email (optional)"><input name="email" type="email" className="input" /></Field>
            <LocationPicker tree={tree} />
          </div>
        </Card>
        <Card title="Case">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type"><Select name="type" required options={opts(CASE_TYPES)} /></Field>
            <Field label="Category" hint={cats.length ? undefined : "No active categories. Add or activate them under Case categories."}><Select name="categoryId" required placeholder="Choose…" options={cats.map((c) => ({ value: c.id, label: c.name }))} /></Field>
            <Field label="Channel"><Select name="channel" defaultValue="WALK_IN" options={opts(CASE_CHANNELS.filter((c) => c !== "ONLINE"))} /></Field>
            <Field label="Priority"><Select name="priority" defaultValue="NORMAL" options={opts(PRIORITIES)} /></Field>
            <Field label="Confidentiality" hint="Confidential cases are hidden from staff without the confidential-case permission."><Select name="confidentiality" defaultValue="NORMAL" options={opts(CONFIDENTIALITY)} /></Field>
            <Field label="Title" className="sm:col-span-2"><input name="title" required minLength={5} maxLength={200} className="input" /></Field>
            <Field label="Description" className="sm:col-span-2"><textarea name="description" required minLength={20} rows={6} className="input" /></Field>
            <Field label="Supporting documents" hint="PDF, JPG, PNG, DOC, DOCX — up to 5 files, 10 MB each" className="sm:col-span-2">
              <input name="files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="input" />
            </Field>
          </div>
        </Card>
        <SubmitButton>Register case</SubmitButton>
      </ActionForm>
    </div>
  );
}
