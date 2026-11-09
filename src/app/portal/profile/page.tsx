import { requireActor } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { getDict } from "@/server/i18n";
import { Card, DL } from "@/components/ui";
import { SecuritySettings } from "@/components/SecuritySettings";

export default async function PortalProfile() {
  const a = await requireActor("portal.citizen");
  const { t } = await getDict();
  const c = a.citizenId ? await prisma.citizen.findUnique({ where: { id: a.citizenId }, include: { subCity: true } }) : null;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">{t.profile}</h1>
      <Card>
        <DL items={[[t.fullName, a.fullName], [t.email, a.email], [t.phone, c?.phone ?? "—"], [t.subCity, c?.subCity?.name ?? "—"], ["Woreda / Kebele", [c?.woreda, c?.kebele].filter(Boolean).join(" / ") || "—"]]} />
      </Card>
      <SecuritySettings actor={a} />
    </div>
  );
}
