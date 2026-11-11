import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD } from "@/shared/constants";
import { AppError } from "@/server/errors";

export const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || "./storage");

export type StoredFile = { fileName: string; storedName: string; mimeType: string; size: number; sha256: string };

// Magic-byte signatures so a renamed executable cannot be uploaded as a PDF/image.
function sniff(buf: Buffer): string | null {
  if (buf.subarray(0, 4).toString() === "%PDF") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (buf.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return "application/msword";
  return null;
}

export function validateUpload(name: string, buf: Buffer) {
  if (buf.length === 0) throw new AppError(`File "${name}" is empty.`);
  if (buf.length > UPLOAD.maxBytes) throw new AppError(`File "${name}" exceeds the 10 MB limit.`);
  const ext = path.extname(name).toLowerCase();
  const mime = sniff(buf);
  if (!mime || !UPLOAD.allowed[mime]?.includes(ext)) {
    throw new AppError(`File "${name}" is not an allowed type (PDF, JPG, PNG, DOC, DOCX).`);
  }
  return mime;
}

export async function saveFile(name: string, buf: Buffer): Promise<StoredFile> {
  const mimeType = validateUpload(name, buf);
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  const storedName = `${crypto.randomUUID()}${path.extname(name).toLowerCase()}`;
  await fs.writeFile(path.join(STORAGE_DIR, storedName), buf);
  const safeName = path.basename(name).replace(/[^\w.\- ()]/g, "_").slice(0, 150);
  return { fileName: safeName, storedName, mimeType, size: buf.length, sha256: crypto.createHash("sha256").update(buf).digest("hex") };
}

export async function readStoredFile(storedName: string) {
  const p = path.join(STORAGE_DIR, path.basename(storedName));
  return fs.readFile(p);
}

/** Extract uploaded files from FormData (field name "files"). */
export async function filesFromForm(fd: FormData, field = "files"): Promise<{ name: string; buf: Buffer }[]> {
  const files = fd.getAll(field).filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f && (f as File).size > 0);
  if (files.length > UPLOAD.maxFiles) throw new AppError(`At most ${UPLOAD.maxFiles} files may be attached at once.`);
  return Promise.all(files.map(async (f) => ({ name: f.name, buf: Buffer.from(await f.arrayBuffer()) })));
}
