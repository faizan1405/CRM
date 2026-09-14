import type { Metadata } from "next";
import { DailyBriefingWorkspace } from "@/features/daily-briefing";

export const metadata: Metadata = {
  title: "Daily Sales Briefing | CRM",
  description:
    "Mobile-first Daily Sales Briefing workspace that summarizes what matters today: hot leads, overdue follow-ups, new leads, and key priority actions.",
};

export default function DailyBriefingPage() {
  return <DailyBriefingWorkspace />;
}
