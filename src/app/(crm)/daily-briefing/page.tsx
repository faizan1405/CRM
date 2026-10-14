import type { Metadata } from "next";
import { DailyBriefingWorkspace } from "@/features/daily-briefing";
import { getDailyBriefing } from "@/app/actions/daily-briefing";

export const metadata: Metadata = {
  title: "Daily Sales Briefing | CRM",
  description:
    "Mobile-first Daily Sales Briefing workspace that summarizes what matters today: hot leads, overdue follow-ups, new leads, and key priority actions.",
};

export default async function DailyBriefingPage() {
  const res = await getDailyBriefing();
  const payload = res.success ? res.data : undefined;

  return (
    <DailyBriefingWorkspace
      initialStats={payload?.summaryStats}
      initialActions={payload?.priorityActions}
      initialAiBriefing={payload?.aiBriefing}
    />
  );
}
