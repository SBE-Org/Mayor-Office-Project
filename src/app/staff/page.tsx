import { redirect } from "next/navigation";
import { requireActor } from "@/server/auth/session";
import { homePath } from "@/server/access";

export default async function StaffHome() {
  const a = await requireActor();
  redirect(homePath(a));
}
