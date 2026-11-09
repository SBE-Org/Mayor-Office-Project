import { requireActor } from "@/server/auth/session";
import { NotificationList } from "@/components/NotificationList";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Notifications" };

export default async function StaffNotifications() {
  const a = await requireActor();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Notifications" />
      <NotificationList actor={a} labels={{ markAllRead: "Mark all as read", none: "No notifications.", open: "Open" }} />
    </div>
  );
}
