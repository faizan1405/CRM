import { Plus, Sunrise, KanbanSquare } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function DashboardHeader({
  followUpsCount = 0,
  openPipelineValue = 0,
}: {
  followUpsCount?: number;
  openPipelineValue?: number;
}) {
  const now = new Date();
  const hour = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }).format(now),
    10
  );

  let greeting = "Good morning";
  if (hour >= 12 && hour < 17) greeting = "Good afternoon";
  else if (hour >= 17) greeting = "Good evening";

  const dateStr = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  return (
    <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="eyebrow mb-1.5">{dateStr}</div>
        <h1 className="text-[24px] font-semibold leading-tight sm:text-[30px] text-foreground tracking-tight">
          {greeting}, Faizan
        </h1>
        <p className="mt-1.5 text-[13.5px] text-muted-foreground">
          <span className="font-medium text-foreground">
            {followUpsCount} {followUpsCount === 1 ? "follow-up" : "follow-ups"}
          </span>{" "}
          need you today. Here&apos;s your daily sales command center.
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button variant="outline" asChild>
          <Link href="/daily-briefing">
            <Sunrise className="h-4 w-4" />
            <span>Briefing</span>
          </Link>
        </Button>
        <Button asChild>
          <Link href="/leads?new=true">
            <Plus className="h-4 w-4" />
            <span>Add Lead</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}
