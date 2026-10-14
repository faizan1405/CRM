import { Plus, Check, MessageSquare, Clock, RefreshCw, Activity, MessageCircle, PencilLine, UserPlus, CalendarCheck2, CalendarX2 } from "lucide-react";
import { ActionCard } from "@/components/action-card";
import { cleanLeadName } from "@/features/leads/formatters";
import type { DashboardData } from "@/app/actions/dashboard";
import { cn } from "@/lib/utils";

export function RecentActivity({ data }: { data: DashboardData["recentActivity"] }) {
  const getIconInfo = (type: string) => {
    switch (type) {
      case "LEAD_CREATED":
        return { icon: UserPlus, color: "text-primary", bg: "bg-success-soft" };
      case "STATUS_CHANGED":
        return { icon: RefreshCw, color: "text-info", bg: "bg-info-soft" };
      case "FOLLOWUP_COMPLETED":
        return { icon: CalendarCheck2, color: "text-primary", bg: "bg-success-soft" };
      case "FOLLOWUP_CANCELLED":
        return { icon: CalendarX2, color: "text-destructive", bg: "bg-danger-soft" };
      case "NOTE_ADDED":
        return { icon: MessageSquare, color: "text-chart-2", bg: "bg-muted" };
      case "WHATSAPP_OPENED":
        return { icon: MessageCircle, color: "text-whatsapp", bg: "bg-success-soft" };
      case "FOLLOWUP_CREATED":
      case "FOLLOWUP_RESCHEDULED":
        return { icon: Clock, color: "text-warning", bg: "bg-warning-soft" };
      default:
        return { icon: PencilLine, color: "text-muted-foreground", bg: "bg-muted" };
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="py-8 text-center text-[13px] text-muted-foreground">
        No recent activity found. Calls, stage changes and notes will appear here.
      </div>
    );
  }

  return (
    <div className="relative">
      <span className="absolute bottom-4 left-[15px] top-4 w-px bg-border" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        {data.map((activity) => {
          const iconInfo = getIconInfo(activity.type);
          const Icon = iconInfo.icon;
          return (
            <ActionCard
              key={activity.activityId}
              href={`/leads?selected=${encodeURIComponent(activity.leadId)}&action=activity`}
              aria-label={`Open activity for ${cleanLeadName(activity.leadName)}`}
              className="group relative flex items-start gap-3 rounded-lg p-2.5 transition-colors duration-150 hover:bg-muted/50"
            >
              <div
                className={cn(
                  "relative z-10 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-card ring-1 ring-border",
                  iconInfo.color
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5 text-[13px]">
                <p className="leading-snug">
                  <span className="font-semibold text-foreground hover:underline">
                    {cleanLeadName(activity.leadName)}
                  </span>{" "}
                  <span className="text-muted-foreground">{activity.message}</span>
                </p>
                <p className="mt-0.5 text-[11.5px] text-subtle tabular">{activity.createdAt}</p>
              </div>
            </ActionCard>
          );
        })}
      </div>
    </div>
  );
}
