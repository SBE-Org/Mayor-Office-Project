// Creates a timestamped backup of the database and uploaded documents in ./backups.
// SQLite: copies the database file. PostgreSQL: runs pg_dump (must be installed).
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL || "file:./dev.db";
const storage = path.resolve(process.env.STORAGE_DIR || "./storage");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = path.resolve("backups", stamp);
fs.mkdirSync(dir, { recursive: true });

if (url.startsWith("file:")) {
  const db = path.resolve("prisma", url.replace(/^file:/, ""));
  fs.copyFileSync(db, path.join(dir, "database.sqlite"));
} else {
  execSync(`pg_dump --format=custom --file="${path.join(dir, "database.dump")}" "${url}"`, { stdio: "inherit" });
}
if (fs.existsSync(storage)) fs.cpSync(storage, path.join(dir, "storage"), { recursive: true });
console.log(`Backup written to ${dir}`);
