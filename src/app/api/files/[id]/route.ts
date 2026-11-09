import { NextResponse, type NextRequest } from "next/server";
import { getActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { appointmentWhere, can, caseWhere } from "@/server/access";
import { readStoredFile } from "@/server/storage";
import { audit } from "@/server/audit";

// Serves an uploaded document only if the user may see the record it belongs to.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await getActor();
  if (!a) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let allowed = false;
  if (doc.caseId) allowed = !!(await prisma.case.findFirst({ where: { AND: [{ id: doc.caseId }, caseWhere(a)] }, select: { id: true } }));
  else if (doc.correspondenceId) {
    const c = await prisma.correspondence.findUnique({ where: { id: doc.correspondenceId } });
    allowed = !!c && (can(a, "correspondence.view") || can(a, "correspondence.manage")) && (c.confidentiality === "NORMAL" || can(a, "correspondence.approve") || c.createdById === a.id || c.handlerId === a.id);
  } else if (doc.appointmentId) allowed = !!(await prisma.appointment.findFirst({ where: { AND: [{ id: doc.appointmentId }, appointmentWhere(a)] } }));
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buf = await readStoredFile(doc.storedName);
  await audit(prisma, a.id, "DOCUMENT_VIEW", "Document", doc.id);
  const inline = doc.mimeType === "application/pdf" || doc.mimeType.startsWith("image/");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": doc.mimeType,
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(doc.fileName)}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
