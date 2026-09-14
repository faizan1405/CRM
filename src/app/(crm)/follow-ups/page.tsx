import type { Metadata } from "next";
import { CalendarClock } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Follow-ups" };

export default function FollowUpsPage() {
  return <PlaceholderPage title="Follow-ups" description="Keep track of upcoming conversations and next steps." message="Follow-up management will be added in a later phase." icon={CalendarClock} />;
}
