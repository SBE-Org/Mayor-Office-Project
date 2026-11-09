import type { NextRequest } from "next/server";
import { api } from "@/server/api";
import { getCase } from "@/server/services/cases";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return api((a) => getCase(a, id));
}
