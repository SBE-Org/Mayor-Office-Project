# Shaggar City Mayor's Office — Digital Management System

A web application for the Shaggar City Mayor's Office. It handles citizen appointments, facility reservations, citizen cases, complaints and petitions, internal review and forwarding, executive decisions by the Mayor and Deputy Mayors, department follow-up, official correspondence, notifications, reports and audit.

> **Status:** working application with demonstration data. Before production use, the Mayor's Office must confirm the decisions listed in [docs/DECISIONS.md](docs/DECISIONS.md).

## Quick start (local, SQLite)

Requirements: Node.js 20+.

```bash
npm install
npx prisma db push
npm run db:seed
npm run build
npm start            # http://localhost:3000
```

For development with hot reload use `npm run dev`. To run the automated tests: `npm test`.

### Demo accounts (demo environment only, `DEMO_MODE=true`)

Every demo account uses the password `Demo@2026pass`.

| Role | Email |
|---|---|
| Mayor | mayor@demo.local |
| Deputy Mayor (Economic) | deputy.economic@demo.local |
| Deputy Mayor (Social) | deputy.social@demo.local |
| Head of Mayor's Office (Chief of Staff) | chief@demo.local |
| Mayor's Office Secretary | secretary@demo.local |
| Department Head (Land) | land.head@demo.local |
| Department Head (Infrastructure / Social) | infra.head@demo.local / social.head@demo.local |
| Super Administrator | admin@demo.local |
| Citizens | citizen@demo.local, citizen2@demo.local |

## Roles and what each can do (default matrix)

Every permission is stored in the database. A Super Administrator can change any of them in **Roles & permissions** (`/staff/admin/roles`). The table shows the defaults in [src/shared/permissions.ts](src/shared/permissions.ts).

| Role | Interface | Cases | Appointments & reservations | Other |
|---|---|---|---|---|
| **Mayor** | Executive dashboard | Sees all cases, including confidential ones. Decides on any forwarded case: instruct, approve, return, delegate to a Deputy Mayor, or final decision | Own calendar; views all calendars; can request rooms | Approves outgoing letters; reports; audit log |
| **Deputy Mayor** (one account per deputy) | Executive dashboard | Sees **only** cases forwarded or delegated to them, and decides on those | Own calendar; can request rooms | Reads correspondence; reports |
| **Head of Mayor's Office** (Chief of Staff) | Office dashboard | Registers, reviews, **assigns the case officer**, assigns departments and forwards cases to the Mayor or a Deputy; closes and reopens them; sees confidential cases | Approves, rejects and reschedules appointments; gives case appointments; manages reservations | Manages and approves correspondence; reports; audit log |
| **Mayor's Office Secretary** | Office dashboard | Registers and verifies cases; sees non-confidential cases; can be **case officer**; **cannot** review, forward or decide | Manages the officials' calendars, books walk-in visitors; as case officer gives and approves case appointments; manages reservations | Registers and archives correspondence |
| **Department Head** | Department dashboard | Sees their department's cases and responds | Can request rooms | Department reports |
| Super Administrator | Admin dashboard | **No access to case content** | — | Users, roles, departments, categories, facilities, audit log |
| Citizen | Citizen portal | Submits cases and tracks **only their own** | Requests and cancels their own appointments | Notifications; satisfaction ratings |

Confidentiality levels: **Normal**, **Confidential** (requires `case.view.confidential`, or direct involvement) and **Strict** (hidden even from the staff member who registered it, unless they hold the confidential permission).

## Case workflow

```
Citizen (online) ──► SUBMITTED ──verify──► REGISTERED ──review──► UNDER_REVIEW
Office (walk-in) ─────────────────────────► REGISTERED          │
                                                                ├─ request info ─► INFO_REQUESTED ─citizen replies─► UNDER_REVIEW
                                                                ├─ forward ─► AWAITING_EXECUTIVE (Mayor / Deputy Mayor)
                                                                │                 ├─ instruct/approve + department ─► ASSIGNED
                                                                │                 ├─ decision only ─► DECIDED (office acts)
                                                                │                 ├─ delegate ─► AWAITING_EXECUTIVE (other official)
                                                                │                 └─ return ─► UNDER_REVIEW
                                                                └─ assign ─► ASSIGNED ─allocate─► IN_PROGRESS ─complete─► RESPONDED ─verify─► CLOSED ─reopen─► UNDER_REVIEW
```

Each step writes an append-only `CaseAction` record and an `AuditLog` entry. Some steps also notify the citizen and the staff concerned. Executive decisions, case actions, department responses and audit logs **cannot be updated or deleted**; the data layer blocks it in [src/server/db.ts](src/server/db.ts).

## Project layout

One Next.js application. The frontend (pages and components) and the backend (services, auth, database access) live in separate folders. The backend code runs only on the server.

```
.
├── prisma/                      DATABASE
│   ├── schema.prisma            tables, relations, indexes
│   ├── migrations/              PostgreSQL migration (production)
│   └── seed.ts                  roles, permission matrix, demo data
│
├── src/
│   ├── app/                     FRONTEND — pages (Next.js App Router)
│   │   ├── (public)/            landing, sign-in, registration, case tracking
│   │   ├── portal/              citizen portal (Afaan Oromoo / Amharic / English)
│   │   ├── staff/               executive, office, department, admin dashboards
│   │   └── api/                 HTTP endpoints: REST v1, file download, Excel export
│   ├── components/              FRONTEND — reusable UI (tables, calendar, forms…)
│   │
│   ├── server/                  BACKEND — server-only code
│   │   ├── actions/             form handlers called by the pages (server actions)
│   │   ├── services/            business logic: cases, appointments, reservations,
│   │   │                        correspondence, accounts, reports, notifications
│   │   ├── auth/                passwords, sessions, two-step verification
│   │   ├── access.ts            who can see which records (row-level rules)
│   │   ├── db.ts                database client (append-only protection)
│   │   ├── storage.ts           secure file uploads
│   │   └── i18n.ts              translations
│   │
│   ├── shared/                  used by both sides: constants, permissions, formatting
│   └── middleware.ts            redirects signed-out users to sign-in
│
├── tests/                       automated tests (vitest)
├── scripts/                     test runner, backup, create-admin, DB provider switch
├── docs/                        deployment, admin guide, API, database, testing, decisions
├── .github/workflows/ci.yml     GitHub Actions: typecheck + tests + build on every push
├── Dockerfile, docker-compose.yml   production deployment with PostgreSQL
└── .env.example                 configuration template (copy to .env)
```

## Documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): PostgreSQL and Docker deployment, environment variables, SMS and email integration, backups, scheduled jobs
- [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md): administrator user guide
- [docs/API.md](docs/API.md): REST endpoints
- [docs/DATABASE.md](docs/DATABASE.md): tables and relationships
- [docs/TESTING.md](docs/TESTING.md): test cases and results
- [docs/DECISIONS.md](docs/DECISIONS.md): assumptions that need Mayor's Office approval
