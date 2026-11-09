// Permission catalogue and DEFAULT role -> permission matrix.
// The live matrix is stored in the database (Role / Permission / RolePermission)
// and can be changed by a Super Administrator at /staff/admin/roles.
// These defaults are configurable assumptions that require Mayor's Office approval.

export const PERMISSIONS = {
  // Dashboards / interfaces
  "portal.citizen": { module: "Interfaces", name: "Use the citizen portal" },
  "dashboard.executive": { module: "Interfaces", name: "Executive (Mayor / Deputy Mayor) dashboard" },
  "dashboard.office": { module: "Interfaces", name: "Mayor's Office administration dashboard" },
  "dashboard.department": { module: "Interfaces", name: "Department dashboard" },
  "dashboard.admin": { module: "Interfaces", name: "System administration dashboard" },

  // Cases
  "case.register": { module: "Cases", name: "Register walk-in / offline cases and verify online submissions" },
  "case.view.all": { module: "Cases", name: "View all non-confidential cases" },
  "case.view.confidential": { module: "Cases", name: "View confidential and strictly confidential cases" },
  "case.view.department": { module: "Cases", name: "View cases assigned to own department" },
  "case.view.assigned": { module: "Cases", name: "View cases personally assigned" },
  "case.view.forwarded": { module: "Cases", name: "View cases forwarded to self for executive attention" },
  "case.review": { module: "Cases", name: "Review, categorise, prioritise and assess cases" },
  "case.assign": { module: "Cases", name: "Assign cases to departments / sub-cities and set deadlines" },
  "case.forward": { module: "Cases", name: "Forward cases to the Mayor or a Deputy Mayor" },
  "case.decide": { module: "Cases", name: "Issue executive instructions and decisions" },
  "case.respond": { module: "Cases", name: "Submit department responses" },
  "case.dept.assign": { module: "Cases", name: "Allocate department cases to department officers" },
  "case.close": { module: "Cases", name: "Verify outcomes and close cases" },
  "case.reopen": { module: "Cases", name: "Reopen closed cases" },

  // Appointments
  "appointment.view": { module: "Appointments", name: "View all appointments and calendars" },
  "appointment.manage": { module: "Appointments", name: "Approve, reject, reschedule and complete appointments" },
  "appointment.walkin": { module: "Appointments", name: "Register walk-in visitors and book on behalf of citizens" },
  "appointment.own": { module: "Appointments", name: "Receive appointments (own calendar)" },

  // Reservations
  "reservation.request": { module: "Reservations", name: "Request facility reservations" },
  "reservation.manage": { module: "Reservations", name: "Approve / reject facility reservations" },

  // Correspondence
  "correspondence.view": { module: "Correspondence", name: "View official correspondence" },
  "correspondence.manage": { module: "Correspondence", name: "Register and manage correspondence" },
  "correspondence.approve": { module: "Correspondence", name: "Approve outgoing correspondence" },

  // Administration
  "department.view": { module: "Administration", name: "View department / sub-city directory" },
  "department.manage": { module: "Administration", name: "Manage departments and sub-cities" },
  "facility.manage": { module: "Administration", name: "Manage reservable facilities" },
  "category.manage": { module: "Administration", name: "Manage case categories" },
  "user.manage": { module: "Administration", name: "Manage user accounts" },
  "role.manage": { module: "Administration", name: "Manage roles and permissions" },
  "audit.view": { module: "Administration", name: "View audit logs" },
  "report.view": { module: "Administration", name: "View reports and analytics" },
} as const;

export type PermissionCode = keyof typeof PERMISSIONS;

export const ROLES = {
  SUPER_ADMIN: { name: "Super Administrator", description: "System configuration, users and roles. No access to case content by default." },
  MAYOR: { name: "Mayor", description: "Executive authority. Reviews forwarded cases and records decisions." },
  DEPUTY_MAYOR: { name: "Deputy Mayor", description: "Executive authority for cases and appointments forwarded or delegated to them." },
  CHIEF_OF_STAFF: { name: "Head of Mayor's Office (Chief of Staff)", description: "Runs the Office of the Mayor: review, forwarding, assignment and oversight." },
  SECRETARY: { name: "Mayor's Office Secretary", description: "Manages the Mayor's calendar, appointments, reservations and correspondence." },
  OFFICE_ASSISTANT: { name: "Mayor's Office Assistant", description: "Front desk: registers walk-in visitors and cases; no review or forwarding." },
  CASE_REGISTRATION_OFFICER: { name: "Case Registration Officer", description: "Registers and verifies incoming cases." },
  CASE_REVIEW_OFFICER: { name: "Case Review Officer", description: "Reviews, assigns and forwards cases." },
  DEPARTMENT_HEAD: { name: "Department Head", description: "Receives and responds to department cases; allocates to officers." },
  DEPARTMENT_OFFICER: { name: "Department Officer", description: "Works on cases personally assigned." },
  DOCUMENT_OFFICER: { name: "Document Management Officer", description: "Registers and archives official correspondence." },
  CITIZEN: { name: "Citizen", description: "Public portal user." },
} as const;

export type RoleCode = keyof typeof ROLES;

const OFFICE_COMMON: PermissionCode[] = ["dashboard.office", "department.view"];

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  SUPER_ADMIN: [
    "dashboard.admin", "user.manage", "role.manage", "department.view", "department.manage",
    "facility.manage", "category.manage", "audit.view", "report.view",
  ],
  MAYOR: [
    "dashboard.executive", "case.view.all", "case.view.confidential", "case.view.forwarded", "case.decide",
    "appointment.own", "appointment.view", "reservation.request", "correspondence.view", "correspondence.approve",
    "department.view", "report.view", "audit.view",
  ],
  DEPUTY_MAYOR: [
    "dashboard.executive", "case.view.forwarded", "case.decide", "appointment.own", "reservation.request",
    "correspondence.view", "department.view", "report.view",
  ],
  CHIEF_OF_STAFF: [
    ...OFFICE_COMMON, "case.register", "case.view.all", "case.view.confidential", "case.review", "case.assign",
    "case.forward", "case.close", "case.reopen", "appointment.view", "appointment.manage", "appointment.walkin",
    "appointment.own", "reservation.request", "reservation.manage", "correspondence.view", "correspondence.manage",
    "correspondence.approve", "report.view", "audit.view",
  ],
  SECRETARY: [
    ...OFFICE_COMMON, "case.register", "case.view.all", "appointment.view", "appointment.manage", "appointment.walkin",
    "reservation.request", "reservation.manage", "correspondence.view", "correspondence.manage",
  ],
  OFFICE_ASSISTANT: [
    ...OFFICE_COMMON, "case.register", "appointment.view", "appointment.walkin", "reservation.request", "correspondence.view",
  ],
  CASE_REGISTRATION_OFFICER: [...OFFICE_COMMON, "case.register", "case.view.all", "appointment.walkin"],
  CASE_REVIEW_OFFICER: [
    ...OFFICE_COMMON, "case.register", "case.view.all", "case.view.assigned", "case.review", "case.assign",
    "case.forward", "case.close", "case.reopen", "report.view",
  ],
  DEPARTMENT_HEAD: [
    "dashboard.department", "case.view.department", "case.respond", "case.dept.assign", "department.view",
    "reservation.request", "report.view",
  ],
  DEPARTMENT_OFFICER: ["dashboard.department", "case.view.assigned", "case.respond"],
  DOCUMENT_OFFICER: [...OFFICE_COMMON, "correspondence.view", "correspondence.manage"],
  CITIZEN: ["portal.citizen"],
};

export const EXECUTIVE_ROLES: RoleCode[] = ["MAYOR", "DEPUTY_MAYOR"];
