import bcrypt from "bcryptjs";
import { AppError } from "@/server/errors";

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}
export function assertStrongPassword(pw: string) {
  if (pw.length < 10 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    throw new AppError("Password must be at least 10 characters and include letters and numbers.");
  }
}

let dummy: Promise<string> | null = null;
/** Spend the same time as a real check so unknown emails cannot be detected by timing. */
export async function dummyVerify(pw: string) {
  dummy ??= bcrypt.hash("not-a-real-password", 12);
  await bcrypt.compare(pw, await dummy);
}
