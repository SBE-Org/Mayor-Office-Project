// Runs the automated test-suite against a throw-away SQLite database seeded with demo data.
import { execSync } from "node:child_process";
import fs from "node:fs";

const env = { ...process.env, DATABASE_URL: "file:./test.db", STORAGE_DIR: "./storage-test", DEMO_MODE: "true", TZ: "Africa/Addis_Ababa" };
for (const f of ["prisma/test.db", "prisma/test.db-journal"]) fs.rmSync(f, { force: true });
fs.rmSync("storage-test", { recursive: true, force: true });
const run = (cmd) => execSync(cmd, { stdio: "inherit", env });
run("npx prisma db push --skip-generate");
run("npx tsx prisma/seed.ts");
run(`npx vitest run ${process.argv.slice(2).join(" ")}`);
