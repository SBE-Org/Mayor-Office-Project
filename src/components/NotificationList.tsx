import Link from "next/link";
import { prisma } from "@/server/db";
import type { Actor } from "@/server/access";
import { markNotificationsReadAction } from "@/server/actions/auth";
import { fmtDateTime } from "@/shared/format";
import { Empty } from "./ui";

export async function NotificationList({ actor, labels }: { actor: Actor; labels: { markAllRead: string; none: string; open: string } }) {
  const items = await prisma.notification.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.some((n) => !n.readAt);
  return (
    <div className="card">
      {unread && (
        <form action={markNotificationsReadAction} className="border-b border-slate-100 px-5 py-3 text-right">
          <button className="btn-outline btn-sm">{labels.markAllRead}</button>
        </form>
      )}
      {!items.length ? (
        <div className="p-5"><Empty>{labels.none}</Empty></div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((n) => (
            <li key={n.id} className={`flex items-start justify-between gap-3 px-5 py-3 ${n.readAt ? "" : "bg-brand-50/50"}`}>
              <div>
                <p className={`text-sm ${n.readAt ? "text-slate-700" : "font-semibold text-slate-900"}`}>{n.title}</p>
                {n.body && <p className="text-sm text-slate-600">{n.body}</p>}
                <p className="text-xs text-slate-400">{fmtDateTime(n.createdAt)}</p>
              </div>
              {n.link && <Link href={n.link} className="link shrink-0 text-xs">{labels.open}</Link>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
