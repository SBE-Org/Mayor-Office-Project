import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { PrintButton } from "@/components/PrintButton";
import { requireActor } from "@/server/auth/session";
import { can } from "@/server/access";
import { prisma } from "@/server/db";
import { getCase, executives } from "@/server/services/cases";
import { activeCategories, activeDepartments, activeSubCities } from "@/server/services/directory";
import { NotFoundError } from "@/server/errors";
import { CONFIDENTIALITY, DECISION_TYPES, PRIORITIES, RESPONSE_TYPES, label } from "@/shared/constants";
import { fmtDate, fmtDateTime, ymd, addDays } from "@/shared/format";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Badge, Card, DL, Field, PageHeader, Select, Timeline, opts } from "@/components/ui";
import { DocumentList } from "@/components/DocumentList";
import * as act from "@/server/actions/cases";

export const metadata = { title: "Case" };

function Panel({ title, children, open, id }: { title: string; children: React.ReactNode; open?: boolean; id?: string }) {
  return (
    <details id={id} open={open} className="card group">
      <summary className="cursor-pointer list-none px-5 py-3 text-sm font-semibold text-navy-800 marker:hidden">
        <span className="mr-2 inline-block transition group-open:rotate-90">›</span>{title}
      </summary>
      <div className="border-t border-slate-100 px-5 py-4">{children}</div>
    </details>
  );
}

export default async function CaseDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const a = await requireActor();
  const { id } = await params;
  const sp = await searchParams;
  let c;
  try {
    c = await getCase(a, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const [cats, depts, subs, execs] = await Promise.all([activeCategories(), activeDepartments(), activeSubCities(), executives()]);
  const deptOfficers = c.departmentId && can(a, "case.dept.assign") ? await prisma.user.findMany({ where: { departmentId: c.departmentId, isActive: true }, orderBy: { fullName: "asc" } }) : [];

  const s = c.status;
  const now = new Date();
  const overdue = !!c.deadline && c.deadline < now && ["ASSIGNED", "IN_PROGRESS"].includes(s);
  const isMayor = can(a, "case.view.all") && can(a, "case.view.confidential") && can(a, "case.decide");
  const canDecide = can(a, "case.decide") && s === "AWAITING_EXECUTIVE" && (c.executiveId === a.id || isMayor);
  const inDept = (c.deptOfficerId === a.id) || (can(a, "case.view.department") && a.departmentId === c.departmentId);
  const deptOpts = depts.map((d) => ({ value: d.id, label: d.name }));
  const lastForward = c.forwardings[c.forwardings.length - 1];

  return (
    <div>
      <PageHeader
        title={c.title}
        subtitle={`${c.referenceNo} · ${label(c.type)} · received ${fmtDateTime(c.createdAt)} via ${label(c.channel)}`}
        actions={<><Link href="/staff/cases" className="btn-outline">Back</Link><PrintButton /></>}
      />
      {sp.new && (
        <p className="mb-4 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-900">
          Case registered. Reference number for the citizen: <b className="font-mono">{c.referenceNo}</b>
        </p>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge value={s} />
        <Badge value={c.priority} kind="priority" />
        {c.confidentiality !== "NORMAL" && <span className="inline-flex items-center gap-1"><Lock className="h-3.5 w-3.5 text-red-700" /><Badge value={c.confidentiality} kind="conf" /></span>}
        {overdue && <span className="badge bg-red-600 text-white">Overdue since {fmtDate(c.deadline)}</span>}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Case details">
            <DL
              items={[
                ["Citizen", <span key="c">{c.citizen.fullName}<br /><span className="text-xs text-slate-500">{c.citizen.phone}{c.citizen.email ? ` · ${c.citizen.email}` : ""}</span></span>],
                ["Location", [c.subCity?.name ?? c.citizen.subCity?.name, c.citizen.woreda && `Woreda ${c.citizen.woreda}`, c.citizen.kebele && `Kebele ${c.citizen.kebele}`].filter(Boolean).join(", ") || "—"],
                ["Category", c.category.name],
                ["Responsible department", c.department?.name ?? "Mayor's Office"],
                ["Case officer", c.assignedOfficer?.fullName ?? "—"],
                ["Department officer", c.deptOfficer?.fullName ?? "—"],
                ["With executive", c.executive ? `${c.executive.fullName}` : "—"],
                ["Response deadline", fmtDate(c.deadline)],
                ["Handling", label(c.handling)],
                ["Closed", fmtDateTime(c.closedAt)],
              ]}
            />
            <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">Description</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{c.description}</p>
            {c.assessment && (<><h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Review assessment</h3><p className="mt-1 whitespace-pre-wrap text-sm">{c.assessment}</p></>)}
            {c.recommendation && (<><h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Recommendation</h3><p className="mt-1 whitespace-pre-wrap text-sm">{c.recommendation}</p></>)}
            {c.resolution && (<><h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand-700">Final resolution</h3><p className="mt-1 whitespace-pre-wrap text-sm">{c.resolution}</p></>)}
          </Card>

          <Card title={`Documents (${c.documents.length})`}><DocumentList docs={c.documents} /></Card>

          {c.decisions.length > 0 && (
            <Card title="Executive decisions (permanent record)">
              <ul className="space-y-3">
                {c.decisions.map((d) => (
                  <li key={d.id} className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm">
                    <p className="font-semibold text-purple-900">{label(d.decisionType)}{d.delegatedTo ? ` → ${d.delegatedTo.fullName}` : ""}</p>
                    <p className="mt-1 whitespace-pre-wrap">{d.instruction}</p>
                    <p className="mt-1 text-xs text-purple-800">{d.executive.fullName} · {fmtDateTime(d.createdAt)}{d.deadline ? ` · deadline ${fmtDate(d.deadline)}` : ""}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(c.forwardings.length > 0 || c.assignments.length > 0) && (
            <Card title="Forwarding & assignment trail">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Date</th><th>From</th><th>To</th><th>Reason</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ...c.forwardings.map((f) => ({ id: f.id, at: f.createdAt, from: f.fromUser.fullName, to: f.toUser.fullName, reason: f.reason })),
                      ...c.assignments.map((x) => ({ id: x.id, at: x.createdAt, from: "Mayor's Office", to: `${x.department.name} (${label(x.status)})`, reason: x.reason })),
                    ]
                      .sort((p, q) => +p.at - +q.at)
                      .map((r) => (
                        <tr key={r.id}><td className="whitespace-nowrap text-xs">{fmtDateTime(r.at)}</td><td>{r.from}</td><td>{r.to}</td><td className="text-slate-600">{r.reason}</td></tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {c.responses.length > 0 && (
            <Card title="Department responses">
              <ul className="space-y-3">
                {c.responses.map((r) => (
                  <li key={r.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <p className="font-medium">{r.department.name} · <Badge value={r.responseType === "COMPLETED" ? "COMPLETED" : r.responseType === "INFO_REQUEST" ? "INFO_REQUESTED" : "IN_PROGRESS"} text={label(r.responseType)} /></p>
                    <p className="mt-1 whitespace-pre-wrap">{r.content}</p>
                    <p className="mt-1 text-xs text-slate-500">{r.responderName} · {fmtDateTime(r.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Action history (append-only)">
            <Timeline items={c.actions.map((x) => ({ id: x.id, title: x.action, who: x.actorName, note: x.note, at: x.createdAt, tag: x.isPublic ? <span className="badge bg-sky-50 text-sky-700">visible to citizen</span> : undefined }))} />
          </Card>
          {c.feedback.length > 0 && (
            <Card title="Citizen feedback">
              {c.feedback.map((f) => <p key={f.id} className="text-sm">{"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)} {f.comment}</p>)}
            </Card>
          )}
        </div>

        <aside className="no-print space-y-3">
          {can(a, "case.register") && s === "SUBMITTED" && (
            <Panel title="Verify online submission" open>
              <ActionForm action={act.verifyCaseAction.bind(null, c.id)}>
                <p className="text-sm text-slate-600">Confirm the submission is genuine and complete enough to register.</p>
                <SubmitButton>Verify &amp; register</SubmitButton>
              </ActionForm>
            </Panel>
          )}

          {canDecide && (
            <Panel title="Executive decision" open id="decide">
              {lastForward && (
                <div className="mb-3 rounded-lg bg-brand-50 p-3 text-sm">
                  <p className="text-xs font-semibold uppercase text-brand-800">Recommended action</p>
                  <p>{lastForward.recommendedAction ?? c.recommendation}</p>
                </div>
              )}
              <ActionForm action={act.decisionAction.bind(null, c.id)}>
                <Field label="Decision"><Select name="decisionType" options={opts(DECISION_TYPES)} /></Field>
                <Field label="Instruction / decision text"><textarea name="instruction" rows={4} required className="input" /></Field>
                <Field label="Assign to department (optional)" hint="For instructions/approvals: sends the case directly to this department."><Select name="departmentId" placeholder="— none —" options={deptOpts} /></Field>
                <Field label="Delegate to (for Delegate)"><Select name="delegateToId" placeholder="—" options={execs.filter((e) => e.id !== a.id).map((e) => ({ value: e.id, label: `${e.fullName} (${e.role.name})` }))} /></Field>
                <Field label="Deadline (optional)"><input type="date" name="deadline" min={ymd(now)} className="input" /></Field>
                <p className="text-xs text-slate-500">Decisions are permanent and cannot be edited or deleted.</p>
                <SubmitButton>Record decision</SubmitButton>
              </ActionForm>
            </Panel>
          )}

          {can(a, "case.review") && ["SUBMITTED", "REGISTERED", "UNDER_REVIEW", "DECIDED"].includes(s) && (
            <Panel title="Review & assess" open={["REGISTERED", "SUBMITTED"].includes(s)}>
              <ActionForm action={act.reviewCaseAction.bind(null, c.id)}>
                <Field label="Category"><Select name="categoryId" defaultValue={c.categoryId} options={cats.map((x) => ({ value: x.id, label: x.name }))} /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Priority"><Select name="priority" defaultValue={c.priority} options={opts(PRIORITIES)} /></Field>
                  <Field label="Confidentiality"><Select name="confidentiality" defaultValue={c.confidentiality} options={opts(CONFIDENTIALITY)} /></Field>
                </div>
                <Field label="Sub-city"><Select name="subCityId" defaultValue={c.subCityId} placeholder="—" options={subs.map((x) => ({ value: x.id, label: x.name }))} /></Field>
                <Field label="Handling"><Select name="handling" defaultValue={c.handling ?? "DEPARTMENT"} options={opts(["ADMINISTRATIVE", "DEPARTMENT", "EXECUTIVE"])} /></Field>
                <Field label="Assessment"><textarea name="assessment" rows={3} required defaultValue={c.assessment ?? ""} className="input" /></Field>
                <Field label="Recommendation"><textarea name="recommendation" rows={2} defaultValue={c.recommendation ?? ""} className="input" /></Field>
                <SubmitButton>Save review</SubmitButton>
              </ActionForm>
            </Panel>
          )}

          {can(a, "case.forward") && ["REGISTERED", "UNDER_REVIEW", "DECIDED", "RESPONDED"].includes(s) && (
            <Panel title="Forward to Mayor / Deputy Mayor">
              <ActionForm action={act.forwardAction.bind(null, c.id)}>
                <Field label="Forward to"><Select name="executiveId" required placeholder="Choose…" options={execs.map((e) => ({ value: e.id, label: `${e.fullName}${e.title ? ` — ${e.title}` : ""}` }))} /></Field>
                <Field label="Executive summary"><textarea name="summary" rows={3} required className="input" defaultValue={c.description.slice(0, 300)} /></Field>
                <Field label="Recommended action"><textarea name="recommendedAction" rows={2} required className="input" defaultValue={c.recommendation ?? ""} /></Field>
                <Field label="Reason for escalation"><input name="reason" required className="input" /></Field>
                <SubmitButton className="btn-navy">Forward</SubmitButton>
              </ActionForm>
            </Panel>
          )}

          {can(a, "case.assign") && ["REGISTERED", "UNDER_REVIEW", "DECIDED", "ASSIGNED", "IN_PROGRESS", "RESPONDED"].includes(s) && (
            <Panel title={c.departmentId ? "Reassign department" : "Assign to department / sub-city"} open={s === "DECIDED"}>
              <ActionForm action={act.assignAction.bind(null, c.id)}>
                <Field label="Department"><Select name="departmentId" required defaultValue={c.departmentId ?? c.category.defaultDepartmentId} placeholder="Choose…" options={deptOpts} /></Field>
                <Field label="Response deadline" hint={`Default: ${c.category.defaultDeadlineDays} days for this category`}><input type="date" name="deadline" min={ymd(now)} defaultValue={ymd(addDays(now, c.category.defaultDeadlineDays))} className="input" /></Field>
                <Field label="Instructions / reason"><textarea name="reason" rows={2} required className="input" /></Field>
                <SubmitButton>Assign</SubmitButton>
              </ActionForm>
            </Panel>
          )}

          {can(a, "case.assign") && overdue && (
            <Panel title="Escalate overdue case" open>
              <ActionForm action={act.escalateAction.bind(null, c.id)}>
                <p className="text-sm text-slate-600">Raises priority and notifies the department head.</p>
                <SubmitButton className="btn-danger">Escalate</SubmitButton>
              </ActionForm>
            </Panel>
          )}

          {can(a, "case.dept.assign") && inDept && ["ASSIGNED", "IN_PROGRESS"].includes(s) && (
            <Panel title="Allocate to department officer" open={s === "ASSIGNED"}>
              <ActionForm action={act.allocateAction.bind(null, c.id)}>
                <Field label="Officer"><Select name="officerId" required defaultValue={c.deptOfficerId} placeholder="Choose…" options={deptOfficers.map((u) => ({ value: u.id, label: u.fullName }))} /></Field>
                <SubmitButton>Allocate</SubmitButton>
              </ActionForm>
            </Panel>
          )}

          {can(a, "case.respond") && inDept && ["ASSIGNED", "IN_PROGRESS"].includes(s) && (
            <Panel title="Department response" open>
              <ActionForm action={act.respondAction.bind(null, c.id)} resetOnSuccess>
                <Field label="Type"><Select name="responseType" options={opts(RESPONSE_TYPES)} /></Field>
                <Field label="Response"><textarea name="content" rows={4} required className="input" /></Field>
                <Field label="Attachments"><input type="file" name="files" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="input" /></Field>
                <SubmitButton>Submit response</SubmitButton>
              </ActionForm>
            </Panel>
          )}

          {can(a, "case.review") && ["SUBMITTED", "REGISTERED", "UNDER_REVIEW", "DECIDED", "ASSIGNED", "IN_PROGRESS"].includes(s) && (
            <Panel title="Request more information from citizen">
              <ActionForm action={act.requestInfoAction.bind(null, c.id)}>
                <Field label="Information needed"><textarea name="message" rows={3} required className="input" /></Field>
                <SubmitButton className="btn-outline">Send request</SubmitButton>
              </ActionForm>
            </Panel>
          )}

          {can(a, "case.close") && ["REGISTERED", "UNDER_REVIEW", "DECIDED", "RESPONDED", "IN_PROGRESS", "ASSIGNED"].includes(s) && (
            <Panel title="Verify outcome & close" open={s === "RESPONDED"}>
              <ActionForm action={act.closeAction.bind(null, c.id)} confirm="Close this case? The citizen will be notified.">
                <Field label="Final resolution (shown to citizen)"><textarea name="resolution" rows={3} required className="input" /></Field>
                <SubmitButton>Close case</SubmitButton>
              </ActionForm>
            </Panel>
          )}

          {can(a, "case.reopen") && s === "CLOSED" && (
            <Panel title="Reopen case">
              <ActionForm action={act.reopenAction.bind(null, c.id)}>
                <Field label="Justification"><textarea name="reason" rows={2} required className="input" /></Field>
                <SubmitButton className="btn-outline">Reopen</SubmitButton>
              </ActionForm>
            </Panel>
          )}

          <Panel title="Add note or document">
            <ActionForm action={act.noteAction.bind(null, c.id)} resetOnSuccess>
              <Field label="Note"><textarea name="note" rows={2} className="input" /></Field>
              <Field label="Documents"><input type="file" name="files" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="input" /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPublic" /> Visible to citizen (sends notification)</label>
              <SubmitButton className="btn-outline">Save</SubmitButton>
            </ActionForm>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
