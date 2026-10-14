import Link from "next/link";
import {
  ArrowRightLeft,
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  Coins,
  MessageCircle,
  PencilLine,
  StickyNote,
  UserPlus,
  Activity as ActivityIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cleanLeadName } from "@/features/leads/formatters";
import type { DashboardData } from "@/app/actions/dashboard";
import { cn } from "@/lib/utils";

type ActivityItem = DashboardData["recentActivity"][number];

export function RecentActivity({ data }: { data: ActivityItem[] }) {
  const getIconInfo = (
    type: string
  ): { icon: LucideIcon; color: string; bg?: string } => {
    switch (type) {
      case "LEAD_CREATED":
        return { icon: UserPlus, color: "text-primary" };
      case "STATUS_CHANGED":
        return { icon: ArrowRightLeft, color: "text-info" };
      case "FOLLOWUP_COMPLETED":
        return { icon: CalendarCheck2, color: "text-primary" };
      case "FOLLOWUP_CANCELLED":
        return { icon: CalendarX2, color: "text-destructive" };
      case "NOTE_ADDED":
        return { icon: StickyNote, color: "text-chart-2" };
      case "WHATSAPP_OPENED":
        return { icon: MessageCircle, color: "text-whatsapp" };
      case "FOLLOWUP_CREATED":
      case "FOLLOWUP_RESCHEDULED":
        return { icon: CalendarClock, color: "text-warning" };
      case "PAYMENT_RECEIVED":
        return { icon: Coins, color: "text-primary" };
      default:
        return { icon: PencilLine, color: "text-muted-foreground" };
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
      {/* Subtle vertical connector line */}
      <span
        className="absolute bottom-6 left-[15px] top-3 w-px bg-border"
        aria-hidden="true"
      />

      <ol className="flex flex-col gap-1.5">
        {data.map((activity) => {
          const iconInfo = getIconInfo(activity.type);
          const Icon = iconInfo.icon;
          const cleanName = cleanLeadName(activity.leadName);

          return (
            <li
              key={activity.activityId}
              className="group relative flex items-start gap-3 rounded-lg p-2 transition-colors duration-150 hover:bg-muted/40"
            >
              <div
                className={cn(
                  "relative z-10 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-card ring-1 ring-border shadow-xs",
                  iconInfo.color
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>

              <div className="min-w-0 flex-1 pt-0.5 text-[13px]">
                <p className="leading-snug text-foreground">
                  {activity.leadId ? (
                    <Link
                      href={`/leads?selected=${encodeURIComponent(activity.leadId)}&action=activity`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {cleanName}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">{cleanName}</span>
                  )}{" "}
                  <span className="text-muted-foreground">{activity.message}</span>
                </p>
              </div>

              <span className="shrink-0 pt-0.5 text-[12px] text-subtle tabular">
                {activity.createdAt}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
