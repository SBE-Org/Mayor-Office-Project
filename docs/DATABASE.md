# Database design

Defined in `prisma/schema.prisma`. The same schema runs on SQLite (development) and PostgreSQL (production; migration in `prisma/migrations/0001_init`). Status and type columns are strings, validated in `src/shared/constants.ts` and the service schemas.

| Area | Tables | Key relationships |
|---|---|---|
| Access control | `Role`, `Permission`, `RolePermission`, `User`, `Session` | User → one Role; Role ↔ Permission (many-to-many); User → Department (department staff) |
| Directory | `SubCity`, `Department`, `Citizen` | Department → SubCity (optional); Citizen → User (optional; walk-ins have no account) |
| Cases | `CaseCategory`, `Case`, `CaseAssignment`, `CaseForwarding`, `CaseAction`, `ExecutiveDecision`, `DepartmentResponse`, `Feedback` | Case → Citizen, Category, Department, case officer, department officer, current executive; everything else → Case |
| Scheduling | `Appointment`, `Facility`, `Reservation` | Appointment → Citizen and official (User); Reservation → Facility and requester |
| Records | `Correspondence`, `CorrespondenceAction`, `Document` | Document → Case, Correspondence or Appointment |
| Platform | `Notification`, `OutboundMessage`, `AuditLog`, `Counter` | Counter issues sequential reference numbers per year |

## Rules enforced

- Unique reference numbers: `Case.referenceNo` (`SMO-YYYY-NNNNNN`), `Appointment.referenceNo`, `Reservation.referenceNo` and `Correspondence.documentNo` are unique and issued inside the same transaction as the record.
- No double booking: appointment and reservation overlaps are checked inside the transaction, on request and again on approval. Indexes: `(officialId, startAt)` and `(facilityId, startAt)`.
- Traceability: `CaseForwarding` and `CaseAssignment` store sender, recipient, date and reason. `CaseAction` stores every status change.
- Append-only: `ExecutiveDecision`, `CaseAction`, `DepartmentResponse`, `CorrespondenceAction` and `AuditLog` reject update and delete in the data layer (`src/server/db.ts`). For extra protection in PostgreSQL, revoke `UPDATE, DELETE` on those tables from the application database user.
- Closed cases keep their full history. Nothing is deleted on close.

## Data retention

Nothing is deleted automatically. The retention period for cases, documents, audit logs and backups must be set by the Mayor's Office (see DECISIONS.md) and then implemented as a scheduled archive job.
