import type { Metadata } from "next";
import { NotificationsWorkspace } from "@/features/notifications";
import { 
  getNotifications, 
  markNotificationRead, 
  markNotificationResolved, 
  dismissNotification 
} from "@/app/actions/notifications";

export const metadata: Metadata = {
  title: "Notifications & Attention Center",
  description: "Sales alerts, overdue follow-ups, and AI recommendations for CRM leads.",
};

export default async function NotificationsPage() {
  const result = await getNotifications();
  const notifications = result.success ? result.data : [];

  return (
    <NotificationsWorkspace 
      initialNotifications={notifications}
      onMarkRead={async (id) => {
        "use server";
        const res = await markNotificationRead(id);
        if (!res.success) throw new Error(res.error);
      }}
      onMarkDone={async (id) => {
        "use server";
        const res = await markNotificationResolved(id);
        if (!res.success) throw new Error(res.error);
      }}
      onDismiss={async (id) => {
        "use server";
        const res = await dismissNotification(id);
        if (!res.success) throw new Error(res.error);
      }}
    />
  );
}
