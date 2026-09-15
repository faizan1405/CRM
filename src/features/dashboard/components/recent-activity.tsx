import { Plus, Check, MessageSquare, Clock, RefreshCw, Activity } from "lucide-react";
import { ActionCard } from "@/components/action-card";
import type { DashboardData } from "@/app/actions/dashboard";

export function RecentActivity({ data }: { data: DashboardData['recentActivity'] }) {
  const getIconInfo = (type: string) => {
    switch (type) {
      case "LEAD_CREATED": return { icon: Plus, color: "text-blue-500", bg: "bg-blue-50" };
      case "STATUS_CHANGED": return { icon: RefreshCw, color: "text-cyan-500", bg: "bg-cyan-50" };
      case "FOLLOWUP_COMPLETED": return { icon: Check, color: "text-green-500", bg: "bg-green-50" };
      case "NOTE_ADDED": return { icon: MessageSquare, color: "text-purple-500", bg: "bg-purple-50" };
      case "FOLLOWUP_CREATED":
      case "FOLLOWUP_RESCHEDULED": return { icon: Clock, color: "text-amber-500", bg: "bg-amber-50" };
      default: return { icon: Activity, color: "text-slate-500", bg: "bg-slate-50" };
    }
  };

  return (
    <div className="relative">
      {/* Vertical line connecting timeline items */}
      <div className="absolute bottom-0 left-8 top-4 w-px bg-slate-200" />
      
      <div className="flex flex-col gap-2">
        {data.length === 0 ? (
          <div className="text-sm text-slate-500 py-4 text-center">No recent activity found.</div>
        ) : (
          data.map((activity) => {
            const iconInfo = getIconInfo(activity.type);
            return (
              <ActionCard key={activity.activityId} href={`/leads?selected=${encodeURIComponent(activity.leadId)}&action=activity`} aria-label={`Open activity for ${activity.leadName}`} className="group relative flex items-start gap-3 rounded-lg p-2 transition-colors duration-150 hover:bg-slate-50">
                <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white ${iconInfo.bg} shadow-sm ring-4 ring-white`}>
                  <iconInfo.icon className={`h-4 w-4 ${iconInfo.color}`} />
                </div>
                <div className="min-w-0 flex flex-col pt-1 break-words">
                  <p className="text-sm font-medium text-slate-900">
                    {activity.message} <span className="text-slate-500 font-normal">for</span> {activity.leadName}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{activity.createdAt}</p>
                </div>
              </ActionCard>
            );
          })
        )}
      </div>
    </div>
  );
}
