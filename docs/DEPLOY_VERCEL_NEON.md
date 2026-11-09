# Deploy on Vercel + Neon + Supabase Storage

Files changed for this setup: `src/server/storage.ts` (Supabase driver), `src/app/api/v1/jobs/reminders/route.ts` (GET + CRON_SECRET), `scripts/set-db-provider.mjs` (`--direct`), `package.json` (`vercel-build`), `vercel.json` (daily cron). Local dev, Docker and VPS setups are unchanged.

1. **Neon**: create a project, region closest to Ethiopia (e.g. Frankfurt). Click Connect, copy the pooled string (DATABASE_URL) and the non-pooled string (DIRECT_URL).
2. **Supabase**: create a project, then Storage > New bucket named `smo-documents`, **Public bucket OFF**. Copy the project URL and the secret / service_role key from Project Settings > API.
3. **Create tables locally (one time)**:
   ```bash
   npm ci
   npm run db:provider -- postgresql --direct
   npx prisma generate
   # put DATABASE_URL and DIRECT_URL from .env.neon.example into .env
   npx prisma migrate deploy
   DEMO_MODE=false npm run db:seed        # roles and permissions only
   npx tsx --env-file=.env scripts/create-admin.ts admin@example.gov "Full Name"   # prints a temporary password
   npm run db:provider -- sqlite && npx prisma generate   # back to local dev mode
   ```
4. **GitHub**: push the project (the `.gitignore` already excludes `.env`, `.next`, `*.db`, `storage/`).
5. **Vercel**: Add New > Project > import the repo. Framework: Next.js. Paste every variable from `.env.neon.example`. Deploy. The `vercel-build` script applies migrations and syncs permissions on every deploy.
6. **First login**: open the site, sign in as the admin, change the password, enable two-step verification.
7. **Check**: submit a case with a PDF, open it as staff (file must open), then Vercel > Settings > Cron Jobs > Run to test reminders.

Notes: cron runs in UTC, so `0 14 * * *` = 17:00 Addis Ababa; Hobby may fire anywhere within that hour. Neon scales to zero, so the first request after idle can take about a second.
