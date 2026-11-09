# REST API (v1)

Authentication uses the same session cookie as the web app (`smo_session`, obtained by signing in). Every endpoint applies the caller's role permissions and row-level visibility, so it returns exactly what that user could see in the UI.

Responses: `{ "data": … }` on success, `{ "error": "message" }` on failure. Status codes: 400 validation, 401 not signed in, 403 forbidden, 404 not found or not visible.

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/cases?q=&status=&categoryId=&departmentId=&priority=&overdue=1&take=` | List visible cases |
| POST | `/api/v1/cases` | Submit a case. Citizen: own case. Staff with `case.register`: walk-in, requires `citizen` |
| GET | `/api/v1/cases/{id}` | Case detail, including history. Citizens receive the public view only |
| GET | `/api/v1/appointments?from=&to=&officialId=&status=` | List visible appointments |
| POST | `/api/v1/appointments` | Request an appointment. Rejects conflicting slots |
| GET | `/api/v1/notifications` | Caller's notifications |
| GET | `/api/availability?officialId=&date=YYYY-MM-DD` | Free and booked slots (no visitor details) |
| GET | `/api/files/{id}` | Download a document. Only if the parent record is visible; each download is audited |
| GET | `/api/reports/export?from=&to=` | Excel report (`report.view`) |
| POST | `/api/v1/jobs/reminders` | Send tomorrow's appointment reminders. Header `Authorization: Bearer $JOB_TOKEN` |

## Examples

```json
POST /api/v1/cases
{
  "type": "COMPLAINT",
  "categoryId": "<id>",
  "title": "Delayed service",
  "description": "At least twenty characters describing the matter…",
  "citizen": { "fullName": "Name", "phone": "0911000000" }
}
```

```json
POST /api/v1/appointments
{ "officialId": "<id>", "category": "PERSONAL_CASE", "purpose": "Discuss my case", "date": "2026-11-10", "time": "09:30", "duration": 30 }
```

Allowed values: `type` is CASE, COMPLAINT, PETITION, SUGGESTION or FEEDBACK. `category` (appointments) is PERSONAL_CASE, COMMUNITY_MATTER, INVESTMENT_BUSINESS, INSTITUTIONAL, COURTESY_VISIT or OTHER. See `src/shared/constants.ts` for the rest.

Other mutations (review, forward, decide, respond, close) are server actions in `src/server/actions/*`. They use the same services in `src/server/services/*`. Exposing them as REST endpoints only needs a thin route wrapper using `api()` from `src/server/api.ts`.
