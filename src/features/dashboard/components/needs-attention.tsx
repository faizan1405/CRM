import { AlertCircle, FileText, UserMinus } from "lucide-react";
import Link from "next/link";

export function NeedsAttention({ data }: { data: { overdueFollowUps: number; proposalsPending: number; leadsNotContacted: number } }) {
  const alerts = [];

  if (data.overdueFollowUps > 0) {
    alerts.push({
      id: 1,
      title: `${data.overdueFollowUps} Overdue Follow-ups`,
      description: "You have follow-ups that missed their scheduled time.",
      icon: AlertCircle,
      color: "text-red-600",
      bg: "bg-red-100",
      border: "border-red-200",
      actionText: "View Overdue",
      href: "/follow-ups?filter=overdue",
    });
  }

  if (data.proposalsPending > 0) {
    alerts.push({
      id: 2,
      title: `${data.proposalsPending} Proposals Pending`,
      description: "Awaiting response on sent proposals.",
      icon: FileText,
      color: "text-amber-600",
      bg: "bg-amber-100",
      border: "border-amber-200",
      actionText: "Review Pipeline",
      href: "/pipeline?stage=PROPOSAL_SENT",
    });
  }

  if (data.leadsNotContacted > 0) {
    alerts.push({
      id: 3,
      title: `${data.leadsNotContacted} New Leads Uncontacted`,
      description: "Leads waiting for their first touchpoint.",
      icon: UserMinus,
      color: "text-blue-600",
      bg: "bg-blue-100",
      border: "border-blue-200",
      actionText: "Contact Leads",
      href: "/leads?status=NEW",
    });
  }

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center bg-slate-50">
        <p className="text-sm text-slate-500 font-medium">All caught up! No urgent tasks. 🎉</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {alerts.map((alert) => (
        <Link href={alert.href} aria-label={alert.actionText} key={alert.id} className={`flex flex-wrap items-start gap-4 rounded-xl border p-4 ${alert.bg} ${alert.border} transition-colors duration-150 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600`}>
          <div className={`mt-0.5 rounded-full p-1 ${alert.color}`}>
            <alert.icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h4 className={`text-sm font-semibold ${alert.color}`}>{alert.title}</h4>
            <p className="mt-1 text-xs text-slate-600">{alert.description}</p>
          </div>
          <span
            className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 transition-colors border"
          >
            {alert.actionText}
          </span>
        </Link>
      ))}
    </div>
  );
}
