// Switch the Prisma datasource between SQLite (local development) and PostgreSQL (production).
//   node scripts/set-db-provider.mjs postgresql
//   node scripts/set-db-provider.mjs sqlite
import fs from "node:fs";

const target = process.argv[2];
if (!["sqlite", "postgresql"].includes(target)) {
  console.error("Usage: node scripts/set-db-provider.mjs <sqlite|postgresql>");
  process.exit(1);
}
const file = "prisma/schema.prisma";
const src = fs.readFileSync(file, "utf8");
const out = src.replace(/(datasource db \{\s*provider\s*=\s*)"(sqlite|postgresql)"/, `$1"${target}"`);
fs.writeFileSync(file, out);
console.log(`Prisma provider set to ${target}. Run "npx prisma generate" next.`);
