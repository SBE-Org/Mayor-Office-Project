import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/server/db";
import { loadActor } from "../src/server/auth/actor";
import type { Actor } from "../src/server/access";
import { ForbiddenError, NotFoundError, AppError } from "../src/server/errors";
import * as cases from "../src/server/services/cases";
import * as appts from "../src/server/services/appointments";
import * as rsv from "../src/server/services/reservations";
import * as acc from "../src/server/services/accounts";
import { buildReport, parseRange } from "../src/server/services/reports";
import { generateSecret, totp, verifyTotp } from "../src/server/auth/totp";
import { validateUpload } from "../src/server/storage";

const A: Record<string, Actor> = {};
const ids: Record<string, string> = {};

async function actor(email: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  return (await loadActor(u.id))!;
}
function nextWeekday(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nextSaturday() {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

beforeAll(async () => {
  for (const [k, e] of Object.entries({
    mayor: "mayor@demo.local", depEco: "deputy.economic@demo.local", depSoc: "deputy.social@demo.local", chief: "chief@demo.local",
    secretary: "secretary@demo.local", assistant: "assistant@demo.local", registrar: "registrar@demo.local", reviewer: "reviewer@demo.local",
    docs: "documents@demo.local", landHead: "land.head@demo.local", landOfficer: "land.officer@demo.local", infraHead: "infra.head@demo.local",
    admin: "admin@demo.local", citizen: "citizen@demo.local", citizen2: "citizen2@demo.local",
  })) A[k] = await actor(e);
  ids.land = (await prisma.caseCategory.findUniqueOrThrow({ where: { code: "LAND" } })).id;
  ids.landDept = (await prisma.department.findUniqueOrThrow({ where: { code: "LAND" } })).id;
  ids.hall = (await prisma.facility.findFirstOrThrow({ where: { type: "HALL" } })).id;
  ids.meeting = (await prisma.facility.findFirstOrThrow({ where: { type: "MEETING_ROOM" } })).id;
});
afterAll(() => prisma.$disconnect());

describe("Role-based access control", () => {
  it("each role has only its intended dashboards", () => {
    expect(A.mayor.permissions.has("dashboard.executive")).toBe(true);
    expect(A.depEco.permissions.has("dashboard.executive")).toBe(true);
    expect(A.chief.permissions.has("dashboard.office")).toBe(true);
    expect(A.secretary.permissions.has("dashboard.office")).toBe(true);
    expect(A.assistant.permissions.has("dashboard.office")).toBe(true);
    expect(A.assistant.permissions.has("case.forward")).toBe(false);
    expect(A.secretary.permissions.has("case.decide")).toBe(false);
    expect(A.admin.permissions.has("case.view.all")).toBe(false);
  });

  it("citizens see only their own cases", async () => {
    const mine = await cases.listCases(A.citizen);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((c) => c.citizenId === A.citizen.citizenId)).toBe(true);
    const other = (await cases.listCases(A.citizen2))[0];
    await expect(cases.getCase(A.citizen, other.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("citizen view hides internal assessment, forwardings and decisions", async () => {
    const c = (await cases.listCases(A.citizen2)).find((x) => x.status === "RESPONDED")!;
    const v = await cases.getCase(A.citizen2, c.id);
    expect(v.assessment).toBeNull();
    expect(v.decisions).toHaveLength(0);
    expect(v.actions.every((x) => x.isPublic)).toBe(true);
  });

  it("a Deputy Mayor sees only cases forwarded to them", async () => {
    const eco = await cases.listCases(A.depEco);
    const soc = await cases.listCases(A.depSoc);
    expect(eco.length).toBe(0);
    expect(soc.length).toBe(1);
    await expect(cases.getCase(A.depEco, soc[0].id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("confidential cases are hidden from the review officer and secretary but visible to the Head of Office and Mayor", async () => {
    const conf = await prisma.case.findFirstOrThrow({ where: { confidentiality: "CONFIDENTIAL" } });
    await expect(cases.getCase(A.reviewer, conf.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(cases.getCase(A.secretary, conf.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await cases.getCase(A.chief, conf.id)).id).toBe(conf.id);
    expect((await cases.getCase(A.mayor, conf.id)).id).toBe(conf.id);
  });

  it("the Super Administrator cannot read case content", async () => {
    expect(await cases.listCases(A.admin)).toHaveLength(0);
  });

  it("the office assistant can register cases but only sees cases they registered and cannot review or forward", async () => {
    const list = await cases.listCases(A.assistant);
    expect(list.every((c) => c.registeredById === A.assistant.id)).toBe(true);
    const any = await prisma.case.findFirstOrThrow({ where: { status: "AWAITING_EXECUTIVE", confidentiality: "NORMAL" } });
    await expect(cases.forwardToExecutive(A.assistant, any.id, { executiveId: A.mayor.id, summary: "x".repeat(20), recommendedAction: "do it now", reason: "because" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(cases.reviewCase(A.assistant, any.id, {})).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("department heads only see their own department's cases", async () => {
    const infra = await cases.listCases(A.infraHead);
    expect(infra.every((c) => c.departmentId !== ids.landDept)).toBe(true);
    const landCase = await prisma.case.findFirstOrThrow({ where: { departmentId: ids.landDept } });
    await expect(cases.departmentRespond(A.infraHead, landCase.id, { responseType: "PROGRESS", content: "Trying to respond to another department" })).rejects.toBeInstanceOf(Error);
  });

  it("revoking a permission in the matrix takes effect immediately", async () => {
    await acc.setRolePermission(A.admin, "OFFICE_ASSISTANT", "case.register", false);
    const limited = await actor("assistant@demo.local");
    await expect(cases.submitCase(limited, { type: "CASE", categoryId: ids.land, title: "Should fail", description: "This should be rejected by permissions." }, [], { fullName: "Some Visitor", phone: "0911222333" })).rejects.toBeInstanceOf(ForbiddenError);
    await acc.setRolePermission(A.admin, "OFFICE_ASSISTANT", "case.register", true);
    expect((await actor("assistant@demo.local")).permissions.has("case.register")).toBe(true);
  });

  it("only a Super Administrator can change permissions", async () => {
    await expect(acc.setRolePermission(A.mayor, "SECRETARY", "case.decide", true)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("Case workflow end-to-end", () => {
  let caseId = "";
  it("citizen submits online and receives a unique reference number", async () => {
    const c = await cases.submitCase(A.citizen, { type: "COMPLAINT", categoryId: ids.land, title: "Test: delayed land service", description: "Automated test case describing a delayed land administration service." });
    caseId = c.id;
    expect(c.referenceNo).toMatch(/^SMO-\d{4}-\d{6}$/);
    expect(c.status).toBe("SUBMITTED");
    const refs = await prisma.case.findMany({ select: { referenceNo: true } });
    expect(new Set(refs.map((r) => r.referenceNo)).size).toBe(refs.length);
  });
  it("registration officer verifies", async () => {
    await cases.verifyCase(A.registrar, caseId);
    expect((await prisma.case.findUniqueOrThrow({ where: { id: caseId } })).status).toBe("REGISTERED");
  });
  it("review officer assesses and forwards to the economic Deputy Mayor", async () => {
    await cases.reviewCase(A.reviewer, caseId, { categoryId: ids.land, priority: "HIGH", confidentiality: "NORMAL", handling: "EXECUTIVE", assessment: "Needs executive instruction", recommendation: "Instruct land office" });
    await cases.forwardToExecutive(A.reviewer, caseId, { executiveId: A.depEco.id, summary: "Delayed land service needing instruction", recommendedAction: "Instruct land office to resolve", reason: "Cross-office delay" });
    const c = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    expect(c.status).toBe("AWAITING_EXECUTIVE");
    expect(c.executiveId).toBe(A.depEco.id);
    expect((await cases.listCases(A.depEco)).map((x) => x.id)).toContain(caseId);
  });
  it("another Deputy Mayor cannot decide on it", async () => {
    await expect(cases.recordDecision(A.depSoc, caseId, { decisionType: "FINAL_DECISION", instruction: "Not my case" })).rejects.toBeInstanceOf(NotFoundError);
  });
  it("the Deputy Mayor issues an instruction assigning the land department", async () => {
    await cases.recordDecision(A.depEco, caseId, { decisionType: "INSTRUCTION", instruction: "Land office to resolve within 10 days.", departmentId: ids.landDept });
    const c = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
    expect(c.status).toBe("ASSIGNED");
    expect(c.departmentId).toBe(ids.landDept);
    expect(await prisma.executiveDecision.count({ where: { caseId } })).toBe(1);
  });
  it("department head allocates and the officer responds", async () => {
    await cases.allocateToOfficer(A.landHead, caseId, A.landOfficer.id);
    const officer = await actor("land.officer@demo.local");
    expect((await cases.listCases(officer)).map((x) => x.id)).toContain(caseId);
    await cases.departmentRespond(officer, caseId, { responseType: "COMPLETED", content: "Service completed and certificate issued to the citizen." });
    expect((await prisma.case.findUniqueOrThrow({ where: { id: caseId } })).status).toBe("RESPONDED");
  });
  it("review officer closes; citizen is notified and can rate once", async () => {
    await cases.closeCase(A.reviewer, caseId, "Certificate issued; matter resolved.");
    expect((await prisma.case.findUniqueOrThrow({ where: { id: caseId } })).status).toBe("CLOSED");
    expect(await prisma.notification.count({ where: { userId: A.citizen.id, title: { contains: "closed" } } })).toBeGreaterThan(0);
    await cases.submitFeedback(A.citizen, caseId, 5, "Thank you");
    await expect(cases.submitFeedback(A.citizen, caseId, 4)).rejects.toBeInstanceOf(AppError);
  });
  it("every step is traceable in the action history", async () => {
    const actions = await prisma.caseAction.findMany({ where: { caseId } });
    expect(actions.length).toBeGreaterThanOrEqual(8);
    expect(actions.some((a) => a.action.startsWith("Forwarded to"))).toBe(true);
    expect(actions.some((a) => a.action.startsWith("Executive decision"))).toBe(true);
  });
  it("closed cases can be reopened with justification", async () => {
    await expect(cases.reopenCase(A.reviewer, caseId, "short")).rejects.toBeInstanceOf(AppError);
    await cases.reopenCase(A.reviewer, caseId, "Citizen reports the certificate contains an error.");
    expect((await prisma.case.findUniqueOrThrow({ where: { id: caseId } })).status).toBe("UNDER_REVIEW");
  });
  it("the Mayor can delegate a forwarded case to a Deputy Mayor", async () => {
    const c = await prisma.case.findFirstOrThrow({ where: { status: "AWAITING_EXECUTIVE", executiveId: A.mayor.id } });
    await cases.recordDecision(A.mayor, c.id, { decisionType: "DELEGATE", instruction: "Please handle this matter.", delegateToId: A.depEco.id });
    expect((await prisma.case.findUniqueOrThrow({ where: { id: c.id } })).executiveId).toBe(A.depEco.id);
  });
});

describe("Official records cannot be silently modified", () => {
  it("executive decisions are append-only", async () => {
    const d = await prisma.executiveDecision.findFirstOrThrow();
    await expect(prisma.executiveDecision.update({ where: { id: d.id }, data: { instruction: "changed" } })).rejects.toThrow(/append-only/);
    await expect(prisma.executiveDecision.delete({ where: { id: d.id } })).rejects.toThrow(/append-only/);
  });
  it("case actions and audit logs are append-only", async () => {
    await expect(prisma.caseAction.deleteMany({})).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.updateMany({ data: { action: "x" } })).rejects.toThrow(/append-only/);
  });
});

describe("Appointments", () => {
  const date = nextWeekday(4);
  it("prevents double booking of the same official", async () => {
    await appts.requestAppointment(A.citizen, { officialId: A.depSoc.id, category: "PERSONAL_CASE", purpose: "Discuss a social support matter", date, time: "15:00", duration: 60 });
    await expect(appts.requestAppointment(A.citizen2, { officialId: A.depSoc.id, category: "PERSONAL_CASE", purpose: "Overlapping request time", date, time: "15:30", duration: 30 })).rejects.toThrow(/already booked/);
    // A different official at the same time is fine
    await appts.requestAppointment(A.citizen2, { officialId: A.depEco.id, category: "PERSONAL_CASE", purpose: "Same time, other official", date, time: "15:30", duration: 30 });
  });
  it("rejects weekends, lunch and past times", async () => {
    await expect(appts.requestAppointment(A.citizen, { officialId: A.mayor.id, category: "OTHER", purpose: "Weekend request test", date: nextSaturday(), time: "10:00", duration: 30 })).rejects.toThrow(/Monday to Friday/);
    await expect(appts.requestAppointment(A.citizen, { officialId: A.mayor.id, category: "OTHER", purpose: "Lunch request test", date, time: "12:00", duration: 30 })).rejects.toThrow(/lunch/);
    await expect(appts.requestAppointment(A.citizen, { officialId: A.mayor.id, category: "OTHER", purpose: "Past request test", date: "2020-01-06", time: "10:00", duration: 30 })).rejects.toThrow(/future/);
  });
  it("walk-in booking with empty optional form fields (as sent by the browser) works", async () => {
    const r = await appts.requestAppointment(
      A.assistant,
      { officialId: A.mayor.id, category: "PERSONAL_CASE", purpose: "Walk-in visitor with blank optional fields", date, time: "08:00", duration: "30" },
      { fullName: "Walk In Regression", phone: "0911777666", email: "", subCityId: "", woreda: "", kebele: "" },
    );
    expect(r.status).toBe("REQUESTED"); // assistant cannot auto-approve
    const c = await cases.submitCase(A.assistant, { type: "CASE", categoryId: ids.land, title: "Blank optional fields", description: "Walk-in case submitted with blank optional fields.", subCityId: "", channel: "WALK_IN", priority: "NORMAL", confidentiality: "NORMAL" }, [], { fullName: "Walk In Regression", phone: "0911777666", email: "", subCityId: "" });
    expect(c.subCityId).toBeNull();
  });
  it("availability marks booked slots", async () => {
    const slots = await appts.availability(A.depSoc.id, date);
    expect(slots.find((s) => s.time === "15:00")?.free).toBe(false);
    expect(slots.find((s) => s.time === "09:00")?.free).toBe(true);
  });
  it("rejection requires an explanation; the secretary can approve; the assistant cannot", async () => {
    const r = await prisma.appointment.findFirstOrThrow({ where: { status: "REQUESTED", officialId: A.depSoc.id } });
    await expect(appts.decideAppointment(A.secretary, r.id, false)).rejects.toThrow(/reason/);
    await expect(appts.decideAppointment(A.assistant, r.id, true)).rejects.toBeInstanceOf(ForbiddenError);
    await appts.decideAppointment(A.secretary, r.id, true);
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("APPROVED");
  });
  it("citizens only see their own appointments", async () => {
    const list = await appts.listAppointments(A.citizen);
    expect(list.every((x) => x.citizenId === A.citizen.citizenId)).toBe(true);
  });
});

describe("Reservations", () => {
  const day = nextWeekday(6);
  it("detects conflicts and enforces capacity", async () => {
    await rsv.requestReservation(A.secretary, { facilityId: ids.meeting, title: "Test meeting", attendees: 10, startAt: `${day}T09:00`, endAt: `${day}T11:00` });
    await expect(rsv.requestReservation(A.chief, { facilityId: ids.meeting, title: "Overlap", attendees: 5, startAt: `${day}T10:00`, endAt: `${day}T12:00` })).rejects.toThrow(/already/);
    await expect(rsv.requestReservation(A.chief, { facilityId: ids.meeting, title: "Too many", attendees: 500, startAt: `${day}T13:00`, endAt: `${day}T14:00` })).rejects.toThrow(/holds at most/);
    await rsv.requestReservation(A.chief, { facilityId: ids.meeting, title: "Back to back", attendees: 5, startAt: `${day}T11:00`, endAt: `${day}T12:00` });
  });
  it("department officers without permission cannot reserve", async () => {
    await expect(rsv.requestReservation(A.landOfficer, { facilityId: ids.hall, title: "x", attendees: 1, startAt: `${day}T15:00`, endAt: `${day}T16:00` })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("Security utilities", () => {
  it("rejects disguised executables and accepts real PDFs", () => {
    expect(() => validateUpload("invoice.pdf", Buffer.from("MZ\x90\x00 fake exe"))).toThrow(/not an allowed type/);
    expect(() => validateUpload("photo.png", Buffer.from("%PDF-1.4 mismatched"))).toThrow(/not an allowed type/);
    expect(validateUpload("letter.pdf", Buffer.from("%PDF-1.4\n%test"))).toBe("application/pdf");
    expect(() => validateUpload("big.pdf", Buffer.concat([Buffer.from("%PDF"), Buffer.alloc(11 * 1024 * 1024)]))).toThrow(/10 MB/);
  });
  it("TOTP codes verify and expire", () => {
    const s = generateSecret();
    expect(verifyTotp(s, totp(s))).toBe(true);
    expect(verifyTotp(s, totp(s, Date.now() - 5 * 60_000))).toBe(false);
  });
  it("locks an account after 5 failed sign-ins", async () => {
    for (let i = 0; i < 5; i++) await acc.authenticate("registrar@demo.local", "wrong-password", undefined, null);
    const r = await acc.authenticate("registrar@demo.local", "Demo@2026pass", undefined, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/locked/);
    await prisma.user.update({ where: { email: "registrar@demo.local" }, data: { lockedUntil: null, failedLoginCount: 0 } });
    expect((await acc.authenticate("registrar@demo.local", "Demo@2026pass", undefined, null)).ok).toBe(true);
  });
  it("reports are scoped: department heads only get their department", async () => {
    const r = await buildReport(A.landHead, parseRange({}));
    expect(r.byDepartment.every((d) => d.name.startsWith("Land"))).toBe(true);
  });
});
