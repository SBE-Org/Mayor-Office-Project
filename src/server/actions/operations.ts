"use server";
import { redirect } from "next/navigation";
import { bool, formObject, run, str, type ActionResult } from "@/server/action";
import { requireActor } from "@/server/auth/session";
import { filesFromForm } from "@/server/storage";
import { userMessage } from "@/server/errors";
import * as appt from "@/server/services/appointments";
import * as rsv from "@/server/services/reservations";
import * as corr from "@/server/services/correspondence";
import { dispatchOutbound } from "@/server/services/notifications";

type A = ActionResult | null;
const APPT_PATHS = ["/staff/appointments", "/portal/appointments", "/portal", "/staff/executive", "/staff/office"];

// ------------------------------------------------------------- appointments

export async function requestAppointmentAction(_: A, fd: FormData): Promise<ActionResult> {
  const a = await requireActor(["portal.citizen", "appointment.walkin"]);
  let target = "/portal/appointments?new=1";
  try {
    const r = await appt.requestAppointment(
      a,
      formObject(fd, ["officialId", "category", "purpose", "date", "time", "duration"]),
      formObject(fd, ["fullName", "phone", "email", "subCityId"]),
    );
    if (!a.permissions.has("portal.citizen")) target = `/staff/appointments/${r.id}`;
    void dispatchOutbound().catch(() => {});
  } catch (e) {
    return { ok: false, error: userMessage(e) };
  }
  redirect(target);
}

export async function decideAppointmentAction(id: string, _: A, fd: FormData) {
  const a = await requireActor();
  const approve = str(fd, "decision") === "approve";
  return run(() => appt.decideAppointment(a, id, approve, str(fd, "note")).then(() => (approve ? "Appointment approved." : "Appointment rejected.")), [...APPT_PATHS, `/staff/appointments/${id}`]);
}
export async function rescheduleAppointmentAction(id: string, _: A, fd: FormData) {
  const a = await requireActor();
  return run(() => appt.rescheduleAppointment(a, id, str(fd, "date"), str(fd, "time"), Number(str(fd, "duration") || 30), str(fd, "note")).then(() => "Appointment rescheduled."), [...APPT_PATHS, `/staff/appointments/${id}`]);
}
export async function cancelAppointmentAction(id: string, _: A, fd: FormData) {
  const a = await requireActor();
  return run(() => appt.cancelAppointment(a, id, str(fd, "note")).then(() => "Appointment cancelled."), [...APPT_PATHS, `/staff/appointments/${id}`]);
}
export async function checkInAction(id: string, _: A) {
  const a = await requireActor();
  return run(() => appt.checkInAppointment(a, id).then(() => "Visitor checked in; the official has been notified."), [...APPT_PATHS, `/staff/appointments/${id}`]);
}
export async function completeAppointmentAction(id: string, _: A, fd: FormData) {
  const a = await requireActor();
  return run(() => appt.completeAppointment(a, id, str(fd, "outcome"), str(fd, "followUp"), bool(fd, "noShow")).then(() => "Outcome recorded."), [...APPT_PATHS, `/staff/appointments/${id}`]);
}

// ------------------------------------------------------------- reservations

export async function requestReservationAction(_: A, fd: FormData) {
  const a = await requireActor();
  return run(() => rsv.requestReservation(a, formObject(fd, ["facilityId", "title", "purpose", "attendees", "startAt", "endAt"])).then((r) => `Reservation ${r.referenceNo} requested.`), ["/staff/reservations"]);
}
export async function decideReservationAction(id: string, _: A, fd: FormData) {
  const a = await requireActor();
  const approve = str(fd, "decision") === "approve";
  return run(() => rsv.decideReservation(a, id, approve, str(fd, "note")).then(() => (approve ? "Approved." : "Rejected.")), ["/staff/reservations"]);
}
export async function cancelReservationAction(id: string, _: A) {
  const a = await requireActor();
  return run(() => rsv.cancelReservation(a, id).then(() => "Cancelled."), ["/staff/reservations"]);
}

// ------------------------------------------------------------- correspondence

export async function createCorrespondenceAction(_: A, fd: FormData): Promise<ActionResult> {
  const a = await requireActor("correspondence.manage");
  let id: string;
  try {
    const d = await corr.createCorrespondence(
      a,
      formObject(fd, ["direction", "subject", "summary", "senderOrg", "recipientOrg", "letterDate", "receivedDate", "confidentiality", "caseReference", "handlerId"]),
      await filesFromForm(fd),
    );
    id = d.id;
  } catch (e) {
    return { ok: false, error: userMessage(e) };
  }
  redirect(`/staff/correspondence/${id}`);
}
export async function correspondenceStatusAction(id: string, _: A, fd: FormData) {
  const a = await requireActor();
  return run(() => corr.changeCorrespondenceStatus(a, id, str(fd, "to"), str(fd, "note")).then(() => "Status updated."), [`/staff/correspondence/${id}`, "/staff/correspondence"]);
}
export async function correspondenceFilesAction(id: string, _: A, fd: FormData) {
  const a = await requireActor();
  return run(async () => {
    await corr.addCorrespondenceFiles(a, id, await filesFromForm(fd), str(fd, "note"));
    return "Saved.";
  }, [`/staff/correspondence/${id}`]);
}
