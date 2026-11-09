# Decisions required from the Mayor's Office

The system is built so that each item below is a setting, not hard-coded policy. The current values are **assumptions** made for the demo. Each must be confirmed or changed before production.

| # | Question | Current assumption | Where to change |
|---|---|---|---|
| 1 | Which officials receive appointment requests, and who approves them? | Mayor, each Deputy Mayor and the Head of Office receive requests. The Secretary and Head of Office approve; each official may approve their own | Users (*Receives appointments*), Roles & permissions (`appointment.manage`, `appointment.own`) |
| 2 | Office hours and slot length | Mon–Fri 08:00–17:00, lunch 12:00–13:00, 30/60-minute slots, Gregorian calendar | `OFFICE_HOURS` in `src/shared/constants.ts` |
| 3 | Which rooms can be reserved, and who controls them? | Three demo facilities; Secretary and Head of Office approve | Facilities, Roles & permissions |
| 4 | Case categories and confidentiality levels | 9 categories from the master prompt; levels Normal / Confidential / Strict | Case categories; `CONFIDENTIALITY` constant |
| 5 | Which cases staff may handle, which go to departments, which to the Mayor | Decided case by case by the reviewer ("Handling" field) | Review form |
| 6 | Who may forward cases and issue executive instructions? | Forward: Head of Office, Case Review Officer. Decide: Mayor and Deputy Mayors (Deputies only on cases forwarded or delegated to them) | Roles & permissions (`case.forward`, `case.decide`) |
| 7 | Who may see confidential cases? | Mayor and Head of Office; others only if directly involved | Roles & permissions (`case.view.confidential`) |
| 8 | Departments and sub-cities | Demo placeholders only (marked "(Demo)") | Departments |
| 9 | Response deadlines and escalation | Per-category default days (10–30); overdue cases escalated manually | Case categories |
| 10 | Languages | Afaan Oromoo, Amharic, English. **The translations are drafts and need review by qualified translators** | `src/server/i18n.ts`, `src/shared/localize.ts` |
| 11 | SMS provider, email service, hosting | Not configured | DEPLOYMENT.md §4 |
| 12 | Data retention | Nothing deleted automatically | DATABASE.md |
| 13 | Official branding | Neutral placeholder icon. No official emblem was used | `src/components/Brand.tsx` |

The platform supports official decision-making and record-keeping. It does not replace legally required approvals, signatures or records procedures.
