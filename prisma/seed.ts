/**
 * Seeds the permission catalogue and roles (always), and DEMO data when DEMO_MODE=true.
 *   npm run db:seed                      -> sync catalogue; keep existing role permissions
 *   npm run db:seed -- --reset-permissions -> re-apply the default role/permission matrix
 * Demo records are clearly labelled "(Demo)" and must not be used as real institutional records.
 */
import { prisma } from "../src/server/db";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_UPGRADES, PERMISSIONS, RETIRED_ROLES, ROLES, type RoleCode } from "../src/shared/permissions";
import { hashPassword } from "../src/server/auth/password";
import { loadActor } from "../src/server/auth/actor";
import * as cases from "../src/server/services/cases";
import * as appts from "../src/server/services/appointments";
import * as rsv from "../src/server/services/reservations";
import * as corr from "../src/server/services/correspondence";
import { BASE_CATEGORIES, ensureBaseCategories } from "../src/server/services/directory";

export const DEMO_PASSWORD = "Demo@2026pass";
const resetPerms = process.argv.includes("--reset-permissions");

async function seedAccessControl() {
  for (const [code, p] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { code }, create: { code, name: p.name, module: p.module }, update: { name: p.name, module: p.module } });
  }
  const perms = await prisma.permission.findMany();
  const byCode = new Map(perms.map((p) => [p.code, p.id]));
  for (const [code, r] of Object.entries(ROLES)) {
    const existing = await prisma.role.findUnique({ where: { code } });
    const role = await prisma.role.upsert({ where: { code }, create: { code, name: r.name, description: r.description }, update: { name: r.name, description: r.description } });
    if (!existing || resetPerms) {
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      await prisma.rolePermission.createMany({ data: DEFAULT_ROLE_PERMISSIONS[code as RoleCode].map((pc) => ({ roleId: role.id, permissionId: byCode.get(pc)! })) });
    }
  }
  // Retired roles: move their users to the replacement role, then remove the role.
  for (const [oldCode, newCode] of Object.entries(RETIRED_ROLES)) {
    const old = await prisma.role.findUnique({ where: { code: oldCode } });
    if (!old) continue;
    const target = await prisma.role.findUniqueOrThrow({ where: { code: newCode } });
    const moved = await prisma.user.updateMany({ where: { roleId: old.id }, data: { roleId: target.id } });
    await prisma.role.delete({ where: { id: old.id } });
    console.log(`• role ${oldCode} removed; ${moved.count} user(s) moved to ${newCode}`);
  }
  // One-time additions to the default permissions for databases created earlier.
  for (const up of PERMISSION_UPGRADES) {
    const key = `perm-upgrade:${up.key}`;
    if (await prisma.counter.findUnique({ where: { key } })) continue;
    for (const [roleCode, codes] of Object.entries(up.grants)) {
      const role = await prisma.role.findUnique({ where: { code: roleCode } });
      if (!role) continue;
      for (const pc of codes ?? []) {
        const permissionId = byCode.get(pc)!;
        await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId } }, create: { roleId: role.id, permissionId }, update: {} });
      }
    }
    await prisma.counter.create({ data: { key, value: 1 } });
  }
  console.log(`✓ ${perms.length} permissions, ${Object.keys(ROLES).length} roles`);
}

async function seedBaseCategories() {
  const n = await ensureBaseCategories();
  if (n) console.log(`✓ ${n} case categories created`);
}

function nextWeekday(offsetDays: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const local = (d: Date) => `${ymd(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

async function seedDemo() {
  if (await prisma.user.findFirst({ where: { email: "admin@demo.local" } })) {
    console.log("• demo data already present - skipped");
    return;
  }
  const roles = new Map((await prisma.role.findMany()).map((r) => [r.code, r.id]));
  const pw = await hashPassword(DEMO_PASSWORD);

  const subCities = await Promise.all(
    ["A", "B", "C", "D"].map((x, i) => prisma.subCity.create({ data: { code: `SC-${x}`, name: `Demo Sub-City ${x}`, mayorName: `Mayor of Sub-City ${x} (Demo)` } }).then((s) => ({ ...s, i }))),
  );
  // Woredas 01-03 with kebeles 01-03 in each demo sub-city (maintained later under Sub-cities, woredas & kebeles)
  for (const sc of subCities) {
    for (const w of ["01", "02", "03"]) {
      await prisma.woreda.create({ data: { subCityId: sc.id, name: w, kebeles: { create: ["01", "02", "03"].map((name) => ({ name })) } } });
    }
  }
  const dept = async (code: string, name: string, type = "DEPARTMENT", subCityId?: string) =>
    prisma.department.create({ data: { code, name: `${name} (Demo)`, type, subCityId, headName: `Head of ${name}` } });
  const land = await dept("LAND", "Land Administration Office");
  const housing = await dept("HOUSING", "Housing Development Office");
  const labour = await dept("JOBS", "Jobs and Enterprise Office");
  const social = await dept("SOCIAL", "Social Affairs Office");
  const infra = await dept("INFRA", "Infrastructure Office");
  const sca = await dept("SCA-A", "Sub-City A Administration", "SUBCITY_ADMIN", subCities[0].id);

  // Default offices for the baseline categories
  const defaultDept: Record<string, string> = { LAND: land.id, HOUSING: housing.id, EMPLOYMENT: labour.id, SOCIAL: social.id, COMMUNITY: sca.id, INFRA: infra.id };
  const cat = new Map<string, string>();
  for (const [code, name, , , days] of BASE_CATEGORIES) {
    const c = await prisma.caseCategory.upsert({
      where: { code },
      create: { code, name, defaultDepartmentId: defaultDept[code] ?? null, defaultDeadlineDays: days },
      update: { defaultDepartmentId: defaultDept[code] ?? null },
    });
    cat.set(code, c.id);
  }

  const user = (email: string, fullName: string, role: RoleCode, extra: Record<string, unknown> = {}) =>
    prisma.user.create({ data: { email, fullName, passwordHash: pw, roleId: roles.get(role)!, ...extra } });
  await user("admin@demo.local", "System Administrator (Demo)", "SUPER_ADMIN");
  const mayor = await user("mayor@demo.local", "Mayor (Demo Account)", "MAYOR", { title: "Mayor of Shaggar City", acceptsAppointments: true, appointmentLabel: "Mayor", appointmentOrder: 1 });
  const dep1 = await user("deputy.economic@demo.local", "Deputy Mayor - Economic (Demo)", "DEPUTY_MAYOR", { title: "Deputy Mayor, Economic Affairs (Demo)", acceptsAppointments: true, appointmentLabel: "Deputy Mayor – Economic Affairs", appointmentOrder: 2 });
  const dep2 = await user("deputy.social@demo.local", "Deputy Mayor - Social (Demo)", "DEPUTY_MAYOR", { title: "Deputy Mayor, Social Affairs (Demo)", acceptsAppointments: true, appointmentLabel: "Deputy Mayor – Social Affairs", appointmentOrder: 3 });
  const chief = await user("chief@demo.local", "Head of Mayor's Office (Demo)", "CHIEF_OF_STAFF", { title: "Head of the Office of the Mayor", acceptsAppointments: true, appointmentLabel: "Head of Mayor's Office", appointmentOrder: 4 });
  const secretary = await user("secretary@demo.local", "Mayor's Secretary (Demo)", "SECRETARY", { title: "Secretary to the Mayor" });
  const landHead = await user("land.head@demo.local", "Land Office Head (Demo)", "DEPARTMENT_HEAD", { departmentId: land.id });
  await user("infra.head@demo.local", "Infrastructure Head (Demo)", "DEPARTMENT_HEAD", { departmentId: infra.id });
  await user("social.head@demo.local", "Social Affairs Head (Demo)", "DEPARTMENT_HEAD", { departmentId: social.id });

  const mkCitizen = async (email: string, fullName: string, phone: string, sc: string) => {
    const u = await user(email, fullName, "CITIZEN", { phone });
    await prisma.citizen.create({ data: { userId: u.id, fullName, phone, email, subCityId: sc, woreda: "01" } });
    return u;
  };
  const c1u = await mkCitizen("citizen@demo.local", "Chaltu Demo", "0911000001", subCities[0].id);
  const c2u = await mkCitizen("citizen2@demo.local", "Bekele Demo", "0911000002", subCities[1].id);

  const hall = await prisma.facility.create({ data: { name: "Main Conference Hall (Demo)", type: "HALL", capacity: 120, location: "Ground floor", managerId: secretary.id } });
  await prisma.facility.create({ data: { name: "Executive Meeting Room (Demo)", type: "MEETING_ROOM", capacity: 16, location: "2nd floor" } });
  await prisma.facility.create({ data: { name: "Community Event Space (Demo)", type: "EVENT_SPACE", capacity: 300, location: "Annex" } });

  const A = async (id: string) => (await loadActor(id))!;
  const [aC1, aC2, aMayor, aLand, aSec, aChief] = await Promise.all([c1u, c2u, mayor, landHead, secretary, chief].map((u) => A(u.id)));
  const aRev = aChief; // Head of Office reviews and forwards
  const aAsst = aSec; // Secretary registers walk-ins
  const aDocs = aSec; // Secretary registers correspondence

  // Case 1: full workflow -> awaiting Mayor
  const k1 = await cases.submitCase(aC1, { type: "CASE", categoryId: cat.get("LAND"), title: "Unresolved land title transfer after inheritance", description: "My late father's plot has not been transferred to the heirs for over two years despite submitting all documents to the sub-city office.", subCityId: subCities[0].id });
  await cases.reviewCase(aRev, k1.id, { categoryId: cat.get("LAND"), priority: "HIGH", confidentiality: "NORMAL", handling: "EXECUTIVE", assessment: "Documents appear complete; delay exceeds the service standard and involves multiple offices.", recommendation: "Instruct the Land Administration Office to complete the transfer within 15 days." });
  await cases.assignCaseOfficer(aChief, k1.id, secretary.id);
  await appts.scheduleCaseAppointment(aSec, k1.id, { date: ymd(nextWeekday(2, 10)), time: "10:00", duration: 30, purpose: "Bring the original inheritance documents for verification." });
  await cases.forwardToExecutive(aRev, k1.id, { executiveId: mayor.id, summary: "Inheritance title transfer pending for over two years; complete documentation on file.", recommendedAction: "Instruct Land Administration to finalise within 15 days and report back.", reason: "Cross-office delay requiring executive instruction." });

  // Case 2: decided by Mayor -> with land department -> responded
  const k2 = await cases.submitCase(aC2, { type: "COMPLAINT", categoryId: cat.get("LAND"), title: "Boundary dispute with neighbouring construction", description: "A neighbouring construction has encroached about two metres into my registered plot. The kebele has not acted on my complaint.", subCityId: subCities[1].id });
  await cases.reviewCase(aRev, k2.id, { categoryId: cat.get("LAND"), priority: "NORMAL", confidentiality: "NORMAL", handling: "EXECUTIVE", assessment: "Survey needed to verify boundary.", recommendation: "Order a site survey by the Land Administration Office." });
  await cases.forwardToExecutive(aRev, k2.id, { executiveId: mayor.id, summary: "Alleged encroachment by neighbouring construction.", recommendedAction: "Order a site survey and report.", reason: "Requires instruction to land office." });
  await cases.recordDecision(aMayor, k2.id, { decisionType: "APPROVE_RECOMMENDATION", instruction: "Approved. Land Administration to conduct a site survey and report within 10 days.", departmentId: land.id, deadline: ymd(nextWeekday(10, 9)) });
  await cases.departmentRespond(aLand, k2.id, { responseType: "COMPLETED", content: "Site survey completed. Encroachment of 1.8 m confirmed; stop-work order issued and owner instructed to restore the boundary." });

  // Case 3: forwarded to Deputy Mayor (social), confidential -> handled by Head of Office (reviewers cannot see confidential cases by default)
  const k3 = await cases.submitCase(aAsst, { type: "PETITION", categoryId: cat.get("SOCIAL"), title: "Request for support for a vulnerable household", description: "Walk-in petition requesting emergency support for a household with an elderly member and two children without income.", channel: "WALK_IN", priority: "URGENT", confidentiality: "CONFIDENTIAL", subCityId: subCities[2].id }, [], { fullName: "Walk-in Visitor (Demo)", phone: "0911000099" });
  await cases.reviewCase(aChief, k3.id, { categoryId: cat.get("SOCIAL"), priority: "URGENT", confidentiality: "CONFIDENTIAL", handling: "EXECUTIVE", assessment: "Urgent humanitarian need verified by phone with kebele.", recommendation: "Refer to Social Affairs for emergency support." });
  await cases.forwardToExecutive(aChief, k3.id, { executiveId: dep2.id, summary: "Vulnerable household needing emergency support.", recommendedAction: "Instruct Social Affairs to provide emergency support.", reason: "Social sector matter." });

  // Case 4: simple online submission waiting for verification; Case 5 assigned and overdue
  await cases.submitCase(aC1, { type: "SUGGESTION", categoryId: cat.get("INFRA"), title: "Street lighting on the main road near the school", description: "Street lights near the primary school have been off for months, making the road unsafe for students in the evening." });
  const k5 = await cases.submitCase(aC2, { type: "COMPLAINT", categoryId: cat.get("SERVICE"), title: "Delayed service at the sub-city ID office", description: "I have been asked to return five times for a residence ID renewal with no explanation given by the office." });
  await cases.reviewCase(aRev, k5.id, { categoryId: cat.get("SERVICE"), priority: "NORMAL", confidentiality: "NORMAL", handling: "DEPARTMENT", assessment: "Service complaint for sub-city administration." });
  await cases.assignToDepartment(aRev, k5.id, { departmentId: sca.id, reason: "Investigate and respond to the citizen.", deadline: undefined });
  await prisma.case.update({ where: { id: k5.id }, data: { deadline: new Date(Date.now() - 2 * 86400_000) } });

  // Appointments
  const t1 = nextWeekday(1, 9);
  await appts.requestAppointment(aC1, { officialId: mayor.id, category: "PERSONAL_CASE", purpose: "Follow up on my land title transfer case with the Mayor.", date: ymd(t1), time: "09:00", duration: 30 });
  await appts.requestAppointment(aSec, { officialId: mayor.id, category: "INSTITUTIONAL", purpose: "Courtesy meeting with community elders' representatives.", date: ymd(t1), time: "10:00", duration: 60 }, { fullName: "Elders Representative (Demo)", phone: "0911000077" });
  await appts.requestAppointment(aC2, { officialId: dep1.id, category: "INVESTMENT_BUSINESS", purpose: "Discuss a proposal for a small manufacturing investment.", date: ymd(nextWeekday(2, 14)), time: "14:00", duration: 30 });

  // Reservations
  const r0 = nextWeekday(3, 9);
  const r1 = new Date(r0.getTime() + 3 * 3600_000);
  const r = await rsv.requestReservation(aChief, { facilityId: hall.id, title: "Quarterly sub-city coordination meeting", purpose: "Coordination", attendees: 60, startAt: local(r0), endAt: local(r1) });
  await rsv.decideReservation(aSec, r.id, true, "Approved");

  // Correspondence
  await corr.createCorrespondence(aDocs, { direction: "INCOMING", subject: "Request for joint planning workshop", senderOrg: "Partner Organisation (Demo)", recipientOrg: "Office of the Mayor", letterDate: ymd(new Date()), receivedDate: ymd(new Date()), confidentiality: "NORMAL" }, []);
  await corr.createCorrespondence(aChief, { direction: "OUTGOING", subject: "Instruction on inheritance title transfer", senderOrg: "Office of the Mayor", recipientOrg: "Land Administration Office (Demo)", letterDate: ymd(new Date()), confidentiality: "NORMAL", caseReference: k1.referenceNo }, []);

  console.log(`✓ demo data created. Demo password for all accounts: ${DEMO_PASSWORD}`);
}

async function main() {
  await seedAccessControl();
  await seedBaseCategories();
  if (process.env.DEMO_MODE === "true") await seedDemo();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
