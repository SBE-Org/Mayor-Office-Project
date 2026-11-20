import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD } from "@/shared/constants";
import { AppError } from "@/server/errors";

export const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || "./storage");

// STORAGE_DRIVER=local (default): files on disk in STORAGE_DIR (local dev, Docker, VPS).
// STORAGE_DRIVER=supabase: private Supabase Storage bucket (Vercel and other serverless hosts).
// The bucket must be PRIVATE; files are only served through /api/files/[id], which checks access.
const driver = () => {
  const d = (process.env.STORAGE_DRIVER ?? "").trim().replace(/^["']|["']$/g, "").toLowerCase();
  if (d === "supabase") return "supabase";
  // Vercel's disk is read-only/temporary: fail with a clear message instead of a mkdir error.
  if (process.env.VERCEL) throw new AppError("File storage is misconfigured: set STORAGE_DRIVER=supabase in the Vercel environment variables (and remove STORAGE_DIR).");
  return "local";
};

function supabase() {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_KEY?.trim();
  const bucket = process.env.SUPABASE_BUCKET?.trim() || "smo-documents";
  if (!base || !key) throw new AppError("File storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY).");
  // Legacy service_role keys are JWTs and go in Authorization too; new sb_secret_ keys use apikey only.
  const headers: Record<string, string> = { apikey: key };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  return { url: `${base}/storage/v1/object/${bucket}`, headers };
}

function maxBytes() {
  const mb = Number(process.env.UPLOAD_MAX_MB);
  return Number.isFinite(mb) && mb > 0 ? mb * 1024 * 1024 : UPLOAD.maxBytes;
}

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
  if (buf.length > maxBytes()) throw new AppError(`File "${name}" exceeds the ${Math.round(maxBytes() / 1024 / 1024)} MB limit.`);
  const ext = path.extname(name).toLowerCase();
  const mime = sniff(buf);
  if (!mime || !UPLOAD.allowed[mime]?.includes(ext)) {
    throw new AppError(`File "${name}" is not an allowed type (PDF, JPG, PNG, DOC, DOCX).`);
  }
  return mime;
}

export async function saveFile(name: string, buf: Buffer): Promise<StoredFile> {
  const mimeType = validateUpload(name, buf);
  const storedName = `${crypto.randomUUID()}${path.extname(name).toLowerCase()}`;
  if (driver() === "supabase") {
    const sb = supabase();
    const res = await fetch(`${sb.url}/${storedName}`, {
      method: "POST",
      headers: { ...sb.headers, "content-type": mimeType, "x-upsert": "false" },
      body: new Uint8Array(buf),
    });
    if (!res.ok) {
      console.error("Supabase upload failed", res.status, await res.text().catch(() => ""));
      throw new AppError("The document could not be stored. Please try again.");
    }
  } else {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    await fs.writeFile(path.join(STORAGE_DIR, storedName), buf);
  }
  const safeName = path.basename(name).replace(/[^\w.\- ()]/g, "_").slice(0, 150);
  return { fileName: safeName, storedName, mimeType, size: buf.length, sha256: crypto.createHash("sha256").update(buf).digest("hex") };
}

export async function readStoredFile(storedName: string): Promise<Buffer> {
  const safe = path.basename(storedName);
  if (driver() === "supabase") {
    const sb = supabase();
    const res = await fetch(`${sb.url}/${safe}`, { headers: sb.headers, cache: "no-store" });
    if (!res.ok) throw new AppError("The document could not be retrieved.");
    return Buffer.from(await res.arrayBuffer());
  }
  return fs.readFile(path.join(STORAGE_DIR, safe));
}

/** Extract uploaded files from FormData (field name "files"). */
export async function filesFromForm(fd: FormData, field = "files"): Promise<{ name: string; buf: Buffer }[]> {
  const files = fd.getAll(field).filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f && (f as File).size > 0);
  if (files.length > UPLOAD.maxFiles) throw new AppError(`At most ${UPLOAD.maxFiles} files may be attached at once.`);
  return Promise.all(files.map(async (f) => ({ name: f.name, buf: Buffer.from(await f.arrayBuffer()) })));
}
