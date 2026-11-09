// Creates the first Super Administrator: npx tsx scripts/create-admin.ts <email> "<Full Name>"
import crypto from "node:crypto";
import { prisma } from "../src/server/db";
import { hashPassword } from "../src/server/auth/password";

async function main() {
  const [email, fullName] = process.argv.slice(2);
  if (!email || !fullName) throw new Error('Usage: npx tsx scripts/create-admin.ts <email> "<Full Name>"');
  const role = await prisma.role.findUniqueOrThrow({ where: { code: "SUPER_ADMIN" } });
  const pw = crypto.randomBytes(9).toString("base64url") + "7a";
  await prisma.user.create({ data: { email: email.toLowerCase(), fullName, roleId: role.id, passwordHash: await hashPassword(pw), mustChangePassword: true } });
  console.log(`Created ${email}. Temporary password: ${pw}`);
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
