# Deployment guide

## 1. Production with Docker and PostgreSQL (recommended)

1. Install Docker Engine and the Docker Compose plugin on the server.
2. Create a `.env` file next to `docker-compose.yml`:
   ```env
   POSTGRES_PASSWORD=<long random password>
   DEMO_MODE=false
   JOB_TOKEN=<long random token>
   # optional integrations, see section 4
   SMS_PROVIDER_URL=
   SMS_PROVIDER_TOKEN=
   SMS_SENDER_ID=
   EMAIL_WEBHOOK_URL=
   EMAIL_WEBHOOK_TOKEN=
   EMAIL_FROM=
   ```
3. Run `docker compose up -d --build`. On start, the container applies `prisma/migrations`, syncs the roles and permission catalogue, and starts the server on port 3000.
4. Put a TLS reverse proxy (nginx, Caddy or IIS ARR) in front of port 3000. Session cookies are `Secure` in production, so HTTPS is required.
5. Create the first administrator. With `DEMO_MODE=false` no users are seeded:
   ```bash
   docker compose exec app npx tsx scripts/create-admin.ts admin@example.gov "Full Name"
   ```
   This prints a temporary password, which must be changed at first sign-in.
6. Sign in, enable two-step verification, then create staff accounts under **Users**. Set up departments, sub-cities, categories and facilities.

## 2. Without Docker (Node.js 20+ and PostgreSQL 14+)

```bash
npm ci
npm run db:provider -- postgresql   # switch Prisma to PostgreSQL
npx prisma generate
export DATABASE_URL="postgresql://user:pass@host:5432/smo"
npx prisma migrate deploy
npm run db:seed
npm run build
NODE_ENV=production TZ=Africa/Addis_Ababa npm start
```

Run it under a process manager (systemd, pm2 or NSSM on Windows). For local development keep SQLite (`npm run db:provider -- sqlite`) and use `npx prisma db push`.

## 3. Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | Database connection | `file:./dev.db` (SQLite) |
| `STORAGE_DIR` | Uploaded documents. Keep it outside the web root, on encrypted storage | `./storage` |
| `DEMO_MODE` | `true` shows the demo banner and seeds demo data | `false` in production |
| `SESSION_HOURS` / `SESSION_IDLE_MINUTES` | Absolute and idle session timeout | 8 / 60 |
| `TZ` | Server time zone used for office hours | `Africa/Addis_Ababa` |
| `JOB_TOKEN` | Bearer token for scheduled jobs | — |
| `SMS_*`, `EMAIL_*` | Notification gateways | not configured |

## 4. SMS and email integration

Notifications are always stored in the app. Each SMS or email is also queued in `OutboundMessage` and sent through a configurable HTTP gateway:

- **SMS:** `POST $SMS_PROVIDER_URL` with header `Authorization: Bearer $SMS_PROVIDER_TOKEN` and body `{ "to": "+2519…", "from": "$SMS_SENDER_ID", "message": "…" }`
- **Email:** `POST $EMAIL_WEBHOOK_URL` with body `{ "to", "from", "subject", "text" }`

Any 2xx response marks the message SENT. If no gateway is configured, messages are marked SKIPPED and shown on the admin dashboard. If your provider uses a different payload (for example an ethio telecom SMS gateway or SMTP), adapt `dispatchOutbound()` in `src/server/services/notifications.ts` or put a small relay in front of it.

## 5. Scheduled jobs

Appointment reminders, sent the day before:

```bash
curl -X POST -H "Authorization: Bearer $JOB_TOKEN" https://your-host/api/v1/jobs/reminders
```

Schedule it daily, for example at 17:00, with cron or Windows Task Scheduler.

## 6. Backups and recovery

- `npm run backup` writes `backups/<timestamp>/`, containing the database (a copy of the SQLite file, or a `pg_dump` custom-format dump) and the uploaded documents.
- Schedule it nightly and copy the backups off-site. Keep them for the retention period approved by the Mayor's Office.
- **Restore (PostgreSQL):** `pg_restore --clean --dbname "$DATABASE_URL" backups/<ts>/database.dump`, then copy `storage/` back.
- **Restore (SQLite):** stop the app, copy `database.sqlite` over `prisma/dev.db`, copy `storage/` back.
- Test a restore at least quarterly.

## 7. Security checklist

- HTTPS only; keep the server and Node.js patched; run `npm audit` regularly.
- Encryption at rest: use encrypted disks or volumes for the database and `STORAGE_DIR`, and turn on PostgreSQL TLS.
- Require two-step verification for the Mayor, Deputy Mayors, the Head of Office and administrators. Accounts can enable it under **Profile**.
- Accounts lock for 15 minutes after 5 failed sign-ins. Sign-in attempts are also rate-limited per IP. When running several app instances, replace the in-memory limiter in `src/server/actions/auth.ts` with a shared store.
- Uploaded files are checked by content (not only extension), limited to PDF/JPG/PNG/DOC/DOCX and 10 MB, stored under random names, and served only to users allowed to see the parent record.
- Review the audit log and the "Failed sign-ins (24h)" counter weekly.
