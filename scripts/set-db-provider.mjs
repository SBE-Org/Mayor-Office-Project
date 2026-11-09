// Switch the Prisma datasource between SQLite (local development) and PostgreSQL (production).
//   node scripts/set-db-provider.mjs postgresql            (Docker / own server)
//   node scripts/set-db-provider.mjs postgresql --direct   (Neon / Vercel: adds directUrl = DIRECT_URL for migrations)
//   node scripts/set-db-provider.mjs sqlite
import fs from "node:fs";

const args = process.argv.slice(2);
const target = args[0];
const direct = args.includes("--direct");
if (!["sqlite", "postgresql"].includes(target)) {
  console.error("Usage: node scripts/set-db-provider.mjs <sqlite|postgresql> [--direct]");
  process.exit(1);
}
const file = "prisma/schema.prisma";
const src = fs.readFileSync(file, "utf8");
const eol = src.includes("\r\n") ? "\r\n" : "\n";
const block = [
  "datasource db {",
  `  provider = "${target}"`,
  '  url      = env("DATABASE_URL")',
  ...(target === "postgresql" && direct ? ['  directUrl = env("DIRECT_URL")'] : []),
  "}",
].join(eol);
const out = src.replace(/datasource db \{[^}]*\}/, block);
fs.writeFileSync(file, out);
console.log(`Prisma provider set to ${target}${direct && target === "postgresql" ? " (with directUrl)" : ""}. Run "npx prisma generate" next.`);
