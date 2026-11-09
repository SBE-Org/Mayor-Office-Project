# Administrator and user guide

## Signing in

Go to `/login`. Citizens create their own accounts at `/register`. Staff accounts are created by the Super Administrator. Every new staff account gets a temporary password, which must be changed at first sign-in. **Profile** lets each user change their password, enable two-step verification (authenticator app) and sign out other devices.

Forgotten passwords: the administrator opens **Users → Manage → Reset password**. This signs out all of that user's sessions and shows a new temporary password.

## Super Administrator

| Task | Where |
|---|---|
| Create a staff account, set role, department, position and whether they receive appointments | Users |
| Deactivate an account (signs it out immediately) | Users → Manage → untick *Active* |
| Grant or revoke a permission for a role | Roles & permissions — click a cell. An amber dot marks a difference from the default |
| Add or edit departments, sub-city administrations and sub-cities | Departments |
| Edit case categories, their default office and response deadline (with Afaan Oromoo and Amharic names) | Case categories |
| Add rooms and halls and name the calendar manager | Facilities |
| Review security events, logins and changes | Audit log, System administration dashboard |

**Adding a Deputy Mayor:** create a user with role *Deputy Mayor*, give them a position title (for example "Deputy Mayor, Economic Affairs") and tick *Receives appointment requests*. They then appear in the forwarding list, the delegation list and the citizen appointment form.

The Super Administrator role cannot see case content by default. This is intentional (least privilege).

## Mayor and Deputy Mayors — Executive dashboard

- **Cases requiring my attention** lists forwarded cases. Each shows the summary, the reviewing officer's assessment, the recommended action, the documents and the history.
- **Review & decide** opens the case. Choose a decision type:
  - *Instruction* or *Approve recommendation*: optionally pick a department. The case goes straight to that department with a deadline.
  - *Return for review*: sends the case back to the office.
  - *Delegate*: passes the case to a Deputy Mayor (or back to the Mayor).
  - *Final decision*: records the decision. The office then closes the case.
- Decisions are permanent. They cannot be edited or deleted.
- The Mayor also sees cases forwarded to the Deputy Mayors and may act on them.

## Head of Office, Secretary, Assistant — Office dashboard

- **Register case** is for walk-in, phone or mail submissions. Give the citizen the reference number shown after saving. They can follow progress at `/track` using that number and their phone number.
- **Online submissions to verify:** open the case and click *Verify & register*.
- **Review & assess** (Head of Office, Review Officer): set category, priority, confidentiality and handling, and write the assessment.
- Then one of:
  - *Assign to department*, with a deadline.
  - *Forward to Mayor / Deputy Mayor*, with summary, recommendation and reason.
  - *Request more information* from the citizen.
- **Verify outcome & close** when a department reports completion. *Reopen* needs a written justification.
- **Overdue** cases show a red deadline. *Escalate* raises their priority and notifies the department head.
- **Appointments:**
  - Requests appear at the top of the Appointments page. Approve, or reject with a reason.
  - Reschedule with a reason; the citizen is notified each time.
  - On the day, reception uses *Check in visitor*. After the meeting, record the outcome and follow-up actions.
- **Walk-in visitor** books a slot for someone without an account. Already-booked times cannot be chosen.

## Department heads and officers

- The Department dashboard lists open cases, earliest deadline first.
- Heads *allocate* a case to an officer.
- Heads and the allocated officer submit responses:
  - *Progress*: an update.
  - *Info request*: asks the Mayor's Office for clarification.
  - *Completed*: reports the action taken. The office then verifies and closes the case.

## Document Management Officer

- **Correspondence → Register letter.** Numbers are assigned automatically (`IN/2026/0001`, `OUT/2026/0001`).
- Link a letter to a case by entering the case reference.
- Outgoing letters: Registered → Under review → Approved (by the Mayor or Head of Office) → Dispatched → Archived.
- Incoming letters: Registered → Under review → Archived.
- Archived letters cannot be changed.

## Reports

**Reports** filters by date range. It shows cases by status, category, department, sub-city and priority, average resolution time, overdue cases, department performance, appointment statistics, facility use and citizen satisfaction.

- *Export Excel* downloads all sheets. Citizen names are excluded from the export.
- *Print / PDF* uses the browser's print dialog ("Save as PDF").
