export const CASE_TYPES = ["CASE", "COMPLAINT", "PETITION", "SUGGESTION", "FEEDBACK"] as const;
export const CASE_CHANNELS = ["ONLINE", "WALK_IN", "MAIL", "PHONE"] as const;
export const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const CONFIDENTIALITY = ["NORMAL", "CONFIDENTIAL", "STRICT"] as const;

export const CASE_STATUSES = [
  "SUBMITTED", // received online, awaiting verification
  "REGISTERED", // verified / registered by office
  "UNDER_REVIEW",
  "INFO_REQUESTED", // returned to citizen for more information
  "AWAITING_EXECUTIVE", // forwarded to Mayor / Deputy Mayor
  "DECIDED", // executive decision recorded, office to act
  "ASSIGNED", // with department
  "IN_PROGRESS",
  "RESPONDED", // department reported completion, awaiting verification
  "CLOSED",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const OPEN_CASE_STATUSES: CaseStatus[] = CASE_STATUSES.filter((s) => s !== "CLOSED");

export const DECISION_TYPES = ["INSTRUCTION", "APPROVE_RECOMMENDATION", "RETURN_FOR_REVIEW", "DELEGATE", "FINAL_DECISION"] as const;
export const RESPONSE_TYPES = ["PROGRESS", "COMPLETED", "INFO_REQUEST"] as const;

export const APPOINTMENT_STATUSES = ["REQUESTED", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED", "NO_SHOW"] as const;
export const APPOINTMENT_CATEGORIES = ["PERSONAL_CASE", "COMMUNITY_MATTER", "INVESTMENT_BUSINESS", "INSTITUTIONAL", "COURTESY_VISIT", "OTHER"] as const;
export const ACTIVE_APPOINTMENT_STATUSES = ["REQUESTED", "APPROVED"];

export const RESERVATION_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export const FACILITY_TYPES = ["CONFERENCE_ROOM", "MEETING_ROOM", "HALL", "EVENT_SPACE", "OTHER"] as const;

export const CORRESPONDENCE_STATUSES = ["REGISTERED", "UNDER_REVIEW", "APPROVED", "DISPATCHED", "ARCHIVED"] as const;

// Office hours used for appointment slots (configurable assumption)
export const OFFICE_HOURS = { start: 8, end: 17, slotMinutes: 30, lunchStart: 12, lunchEnd: 13 };

export const UPLOAD = {
  maxBytes: 10 * 1024 * 1024,
  maxFiles: 5,
  allowed: {
    "application/pdf": [".pdf"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "application/msword": [".doc"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  } as Record<string, string[]>,
};

export function label(value: string | null | undefined) {
  if (!value) return "—";
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
