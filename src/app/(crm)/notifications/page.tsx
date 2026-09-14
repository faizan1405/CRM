import type { Metadata } from "next";
import { NotificationsWorkspace } from "@/features/notifications";

export const metadata: Metadata = {
  title: "Notifications & Attention Center",
  description: "Sales alerts, overdue follow-ups, and AI recommendations for CRM leads.",
};

export default function NotificationsPage() {
  return <NotificationsWorkspace />;
}
