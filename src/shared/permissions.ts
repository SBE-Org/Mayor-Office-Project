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
  "case.view.assigned": { module: "Cases", name: "View cases personally assigned (case officer)" },
  "case.view.forwarded": { module: "Cases", name: "View cases forwarded to self for executive attention" },
  "case.review": { module: "Cases", name: "Review, categorise, prioritise and assess cases" },
  "case.assign": { module: "Cases", name: "Assign cases to departments / sub-cities and set deadlines" },
  "case.forward": { module: "Cases", name: "Forward cases to the Mayor or a Deputy Mayor" },
  "case.decide": { module: "Cases", name: "Issue executive instructions and decisions" },
  "case.respond": { module: "Cases", name: "Submit department responses" },
  "case.dept.assign": { module: "Cases", name: "Allocate department cases to individual department staff" },
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
  CHIEF_OF_STAFF: { name: "Head of Mayor's Office (Chief of Staff)", description: "Runs the Office of the Mayor: registration, review, case-officer assignment, forwarding, department assignment and oversight." },
  SECRETARY: { name: "Mayor's Office Secretary", description: "Registers walk-in cases and visitors, manages the Mayor's calendar, appointments, reservations and correspondence; can act as case officer." },
  DEPARTMENT_HEAD: { name: "Department Head", description: "Receives, works on and responds to cases assigned to the department." },
  CITIZEN: { name: "Citizen", description: "Public portal user (case owner)." },
} as const;

export type RoleCode = keyof typeof ROLES;

/**
 * Roles removed in the Nov 2026 review and the role their users are moved to
 * (applied automatically by the seed script: npm run db:seed).
 */
export const RETIRED_ROLES: Record<string, RoleCode> = {
  OFFICE_ASSISTANT: "SECRETARY",
  CASE_REGISTRATION_OFFICER: "SECRETARY",
  DOCUMENT_OFFICER: "SECRETARY",
  CASE_REVIEW_OFFICER: "CHIEF_OF_STAFF",
  DEPARTMENT_OFFICER: "DEPARTMENT_HEAD",
};

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
    ...OFFICE_COMMON, "case.register", "case.view.all", "case.view.confidential", "case.view.assigned", "case.review", "case.assign",
    "case.forward", "case.close", "case.reopen", "appointment.view", "appointment.manage", "appointment.walkin",
    "appointment.own", "reservation.request", "reservation.manage", "correspondence.view", "correspondence.manage",
    "correspondence.approve", "report.view", "audit.view",
  ],
  SECRETARY: [
    ...OFFICE_COMMON, "case.register", "case.view.all", "case.view.assigned", "appointment.view", "appointment.manage", "appointment.walkin",
    "appointment.own", "reservation.request", "reservation.manage", "correspondence.view", "correspondence.manage",
  ],
  DEPARTMENT_HEAD: [
    "dashboard.department", "case.view.department", "case.respond", "department.view", "reservation.request", "report.view",
  ],
  CITIZEN: ["portal.citizen"],
};

/**
 * Permissions added to the defaults after a role already existed. The seed grants them
 * once to existing databases (without touching other changes the administrator made).
 */
export const PERMISSION_UPGRADES: { key: string; grants: Partial<Record<RoleCode, PermissionCode[]>> }[] = [
  {
    key: "2026-11-roles",
    grants: {
      CHIEF_OF_STAFF: ["case.view.assigned"],
      SECRETARY: ["case.view.assigned", "appointment.own", "correspondence.manage"],
    },
  },
];

export const EXECUTIVE_ROLES: RoleCode[] = ["MAYOR", "DEPUTY_MAYOR"];
