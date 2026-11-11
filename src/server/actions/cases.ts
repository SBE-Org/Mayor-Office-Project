"use server";
import { redirect } from "next/navigation";
import { bool, formObject, run, str, type ActionResult } from "@/server/action";
import { requireActor } from "@/server/auth/session";
import { filesFromForm } from "@/server/storage";
import { userMessage } from "@/server/errors";
import { dispatchOutbound } from "@/server/services/notifications";
import * as svc from "@/server/services/cases";

type A = ActionResult | null;
const paths = (id: string) => [`/staff/cases/${id}`, `/portal/cases/${id}`, "/staff/cases", "/staff/executive", "/staff/office", "/staff/department", "/portal"];

export async function submitCaseAction(_: A, fd: FormData): Promise<ActionResult> {
  const actor = await requireActor(["portal.citizen", "case.register"]);
  let id: string;
  let portal = false;
  try {
    const files = await filesFromForm(fd);
    const input = { ...formObject(fd, ["type", "categoryId", "title", "description", "subCityId", "channel", "priority", "confidentiality"]) };
    if (bool(fd, "sensitive")) input.confidentiality = "CONFIDENTIAL";
    for (const k of ["channel", "priority", "confidentiality"]) if (!input[k]) delete input[k];
    const citizen = formObject(fd, ["fullName", "phone", "email", "subCityId", "woreda", "kebele"]);
    const c = await svc.submitCase(actor, input, files, citizen);
    id = c.id;
    portal = actor.permissions.has("portal.citizen");
    void dispatchOutbound().catch(() => {});
  } catch (e) {
    return { ok: false, error: userMessage(e) };
  }
  redirect(portal ? `/portal/cases/${id}?new=1` : `/staff/cases/${id}?new=1`);
}

export async function verifyCaseAction(id: string, _: A) {
  const a = await requireActor();
  return run(() => svc.verifyCase(a, id).then(() => "Case verified and registered."), paths(id));
}

export async function reviewCaseAction(id: string, _: A, fd: FormData) {
  const a = await requireActor();
  return run(
    () => svc.reviewCase(a, id, formObject(fd, ["categoryId", "priority", "confidentiality", "handling", "assessment", "recommendation", "subCityId"])).then(() => "Review saved."),
    paths(id),
  );
}

export async function requestInfoAction(id: string, _: A, fd: FormData) {
  const a = await requireActor();
  return run(() => svc.requestInfo(a, id, str(fd, "message")).then(() => "Request sent to the citizen."), paths(id));
}

export async function provideInfoAction(id: string, _: A, fd: FormData) {
  const a = await requireActor();
  return run(async () => {
    await svc.citizenProvideInfo(a, id, str(fd, "text"), await filesFromForm(fd));
    return "Thank you. Your information has been sent.";
  }, paths(id));
}

export async function assignAction(id: string, _: A, fd: FormData) {
  const a = await requireActor();
  return run(() => svc.assignToDepartment(a, id, formObject(fd, ["departmentId", "reason", "deadline"])).then(() => "Case assigned."), paths(id));
}

export async function assignCaseOfficerAction(id: string, _: A, fd: FormData) {
  const a = await requireActor();
  return run(() => svc.assignCaseOfficer(a, id, str(fd, "officerId")).then(() => "Case officer assigned. The officer and the citizen have been notified."), paths(id));
}

export async function forwardAction(id: string, _: A, fd: FormData) {
  const a = await requireActor();
  return run(() => svc.forwardToExecutive(a, id, formObject(fd, ["executiveId", "summary", "recommendedAction", "reason"])).then(() => "Case forwarded for executive attention."), paths(id));
}

export async function decisionAction(id: string, _: A, fd: FormData) {
  const a = await requireActor();
  return run(() => svc.recordDecision(a, id, formObject(fd, ["decisionType", "instruction", "departmentId", "delegateToId", "deadline"])).then(() => "Decision recorded."), paths(id));
}

export async function allocateAction(id: string, _: A, fd: FormData) {
  const a = await requireActor();
  return run(() => svc.allocateToOfficer(a, id, str(fd, "officerId")).then(() => "Case allocated."), paths(id));
}

export async function respondAction(id: string, _: A, fd: FormData) {
  const a = await requireActor();
  return run(async () => {
    await svc.departmentRespond(a, id, formObject(fd, ["responseType", "content"]), await filesFromForm(fd));
    return "Response submitted.";
  }, paths(id));
}

export async function closeAction(id: string, _: A, fd: FormData) {
  const a = await requireActor();
  return run(() => svc.closeCase(a, id, str(fd, "resolution")).then(() => "Case closed."), paths(id));
}

export async function reopenAction(id: string, _: A, fd: FormData) {
  const a = await requireActor();
  return run(() => svc.reopenCase(a, id, str(fd, "reason")).then(() => "Case reopened."), paths(id));
}

export async function escalateAction(id: string, _: A) {
  const a = await requireActor();
  return run(() => svc.escalateOverdue(a, id).then(() => "Escalation sent to the department."), paths(id));
}

export async function noteAction(id: string, _: A, fd: FormData) {
  const a = await requireActor();
  return run(async () => {
    await svc.addNote(a, id, str(fd, "note"), bool(fd, "isPublic"), await filesFromForm(fd));
    return "Saved.";
  }, paths(id));
}

export async function feedbackAction(id: string, _: A, fd: FormData) {
  const a = await requireActor();
  return run(() => svc.submitFeedback(a, id, Number(str(fd, "rating")), str(fd, "comment")).then(() => "Thank you for your feedback."), paths(id));
}

export type TrackState = ActionResult & { result?: svc.TrackResult; matches?: svc.TrackMatch[]; phone?: string };

export async function trackAction(_: TrackState | null, fd: FormData): Promise<TrackState> {
  const referenceNo = str(fd, "referenceNo").trim();
  const phone = str(fd, "phone").trim();
  if (!referenceNo && !phone) return { ok: false, error: "required" };
  const r = await svc.trackCase({ referenceNo, phone });
  if (!r) return { ok: false, error: "notfound" };
  return { ok: true, ...r, phone };
}
