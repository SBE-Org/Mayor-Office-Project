import type { Lang } from "@/server/i18n";

export function catName(c: { name: string; nameOm?: string | null; nameAm?: string | null }, lang: Lang) {
  if (lang === "om" && c.nameOm) return c.nameOm;
  if (lang === "am" && c.nameAm) return c.nameAm;
  return c.name;
}

// Citizen-facing status names (translations require review).
const STATUS: Record<string, Record<Lang, string>> = {
  SUBMITTED: { en: "Submitted", om: "Dhiyaate", am: "ቀርቧል" },
  REGISTERED: { en: "Registered", om: "Galmaa'e", am: "ተመዝግቧል" },
  UNDER_REVIEW: { en: "Under review", om: "Qorannoo irra jira", am: "በግምገማ ላይ" },
  INFO_REQUESTED: { en: "Information requested", om: "Odeeffannoon gaafatame", am: "መረጃ ተጠይቋል" },
  AWAITING_EXECUTIVE: { en: "Executive review", om: "Ilaalcha hoggansaa", am: "በአመራር ግምገማ" },
  DECIDED: { en: "Decision made", om: "Murtiin kenname", am: "ውሳኔ ተሰጥቷል" },
  ASSIGNED: { en: "Referred to office", om: "Waajjiraaf dabarfame", am: "ለጽ/ቤት ተመርቷል" },
  IN_PROGRESS: { en: "In progress", om: "Hojii irra jira", am: "በሂደት ላይ" },
  RESPONDED: { en: "Action reported", om: "Tarkaanfiin gabaafame", am: "እርምጃ ሪፖርት ተደርጓል" },
  CLOSED: { en: "Closed", om: "Xumurame", am: "ተዘግቷል" },
  REQUESTED: { en: "Requested", om: "Gaafatame", am: "ተጠይቋል" },
  APPROVED: { en: "Approved", om: "Mirkanaa'e", am: "ጸድቋል" },
  REJECTED: { en: "Not approved", om: "Hin mirkanoofne", am: "አልጸደቀም" },
  CANCELLED: { en: "Cancelled", om: "Haqame", am: "ተሰርዟል" },
  COMPLETED: { en: "Completed", om: "Raawwatame", am: "ተጠናቋል" },
  NO_SHOW: { en: "Did not attend", om: "Hin dhufne", am: "አልተገኙም" },
};
export function statusName(s: string, lang: Lang) {
  return STATUS[s]?.[lang] ?? s.replace(/_/g, " ").toLowerCase();
}
