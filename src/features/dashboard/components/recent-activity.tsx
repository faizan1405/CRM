import { Plus, Check, MessageSquare, Clock, RefreshCw } from "lucide-react";

export function RecentActivity() {
  const activities = [
    {
      id: "1",
      event: "Lead created",
      leadName: "Diana Prince",
      time: "10 mins ago",
      icon: Plus,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      id: "2",
      event: "Status changed to Contacted",
      leadName: "Bruce Wayne",
      time: "1 hour ago",
      icon: RefreshCw,
      color: "text-cyan-500",
      bg: "bg-cyan-50",
    },
    {
      id: "3",
      event: "Follow-up completed",
      leadName: "Clark Kent",
      time: "2 hours ago",
      icon: Check,
      color: "text-green-500",
      bg: "bg-green-50",
    },
    {
      id: "4",
      event: "Note added",
      leadName: "Arthur Curry",
      time: "Yesterday",
      icon: MessageSquare,
      color: "text-purple-500",
      bg: "bg-purple-50",
    },
    {
      id: "5",
      event: "Follow-up scheduled",
      leadName: "Barry Allen",
      time: "Yesterday",
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="relative pl-4">
      {/* Vertical line connecting timeline items */}
      <div className="absolute bottom-0 left-8 top-4 w-px bg-slate-200" />
      
      <div className="flex flex-col gap-6">
        {activities.map((activity) => (
          <div key={activity.id} className="group relative flex items-start gap-4">
            <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white ${activity.bg} shadow-sm ring-4 ring-white`}>
              <activity.icon className={`h-4 w-4 ${activity.color}`} />
            </div>
            <div className="flex flex-col pt-1">
              <p className="text-sm font-medium text-slate-900">
                {activity.event} <span className="text-slate-500 font-normal">for</span> {activity.leadName}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
