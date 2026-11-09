import { requireActor } from "@/server/auth/session";
import { getDict } from "@/server/i18n";
import { NotificationList } from "@/components/NotificationList";

export default async function PortalNotifications() {
  const a = await requireActor("portal.citizen");
  const { t } = await getDict();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold">{t.notifications}</h1>
      <NotificationList actor={a} labels={{ markAllRead: t.markAllRead, none: t.none, open: t.open }} />
    </div>
  );
}
