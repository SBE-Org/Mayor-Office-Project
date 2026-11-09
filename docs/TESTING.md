# Test cases and results

Run with `npm test`. It creates a fresh SQLite database (`prisma/test.db`), seeds the demo data and runs `tests/system.test.ts`.

**Last result (7 Nov 2026): 34 passed, 0 failed.**

| # | Area | Test case | Result |
|---|---|---|---|
| 1 | Roles | Each role has only its intended dashboards; Assistant cannot forward; Secretary cannot decide; Admin cannot view cases | Pass |
| 2 | Roles | Citizens see only their own cases; another citizen's case returns "not found" | Pass |
| 3 | Roles | Citizen view hides assessment, forwardings, decisions and internal actions | Pass |
| 4 | Roles | A Deputy Mayor sees only cases forwarded to them, not the other Deputy's | Pass |
| 5 | Confidentiality | Confidential case hidden from Review Officer and Secretary; visible to Head of Office and Mayor | Pass |
| 6 | Roles | Super Administrator sees no case content | Pass |
| 7 | Roles | Office Assistant sees only cases they registered; cannot review or forward | Pass |
| 8 | Roles | Department head sees only own department; cannot respond to another department's case | Pass |
| 9 | Permissions | Revoking `case.register` from the Office Assistant blocks registration immediately; restoring works | Pass |
| 10 | Permissions | Only the Super Administrator can change the matrix | Pass |
| 11–20 | Workflow | Online submission → verify → review → forward to Deputy Mayor → other Deputy blocked → instruction assigns department → head allocates → officer responds → close and notify citizen → single feedback → full action trail → reopen with justification → Mayor delegates to a Deputy | Pass |
| 21–22 | Records | Executive decisions, case actions and audit logs reject update and delete | Pass |
| 23 | Appointments | Double booking of the same official blocked; another official at the same time allowed | Pass |
| 24 | Appointments | Weekend, lunch-break and past times rejected | Pass |
| 25 | Appointments | Walk-in booking with blank optional fields (browser form) works; Assistant bookings stay pending | Pass |
| 26 | Appointments | Availability marks booked slots | Pass |
| 27 | Appointments | Rejection requires a reason; Secretary can approve; Assistant cannot | Pass |
| 28 | Appointments | Citizens see only their own appointments | Pass |
| 29 | Reservations | Overlap blocked; capacity enforced; back-to-back allowed | Pass |
| 30 | Reservations | Roles without `reservation.request` cannot reserve | Pass |
| 31 | Uploads | Renamed executable, mismatched type and >10 MB rejected; real PDF accepted | Pass |
| 32 | MFA | TOTP code verifies; 5-minute-old code rejected | Pass |
| 33 | Security | Account locks after 5 failed sign-ins; unlock works | Pass |
| 34 | Reports | Department head's report covers only their department | Pass |

## Manual browser checks (production build)

| Check | Result |
|---|---|
| Mayor signs in → executive dashboard with attention queue; records "Approve recommendation" with department; decision appears as permanent record | Pass |
| Office Assistant signs in → front-desk menu only; opening `/staff/executive` shows "Access restricted" | Pass |
| Walk-in booking slot picker greys out booked slots (09:00, 10:00–11:00) | Pass |
| Walk-in booking with blank optional fields | Failed at first (empty sub-city sent as an ID). Fixed, covered by test 25; re-checked in browser: APT-2026-00004 created as "Requested" |
| Phone width (375 px): staff menu opens, and closes after choosing a page | Pass |

Not yet checked manually: the full citizen portal in Afaan Oromoo and Amharic on a phone, and SMS or email delivery (needs provider credentials).
