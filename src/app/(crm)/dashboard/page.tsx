import type { Metadata } from "next";
import { BadgeCheck, CalendarClock, CircleDollarSign, Handshake, Inbox, UserPlus, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { getDashboardFollowUpStats } from "@/app/actions/dashboard";
import Link from "next/link";
import { formatTime } from "@/features/followups/formatters";
import { getTypeIcon, typeStyles } from "@/features/followups/follow-up-types";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const followUpStats = await getDashboardFollowUpStats();
  
  const todayCount = followUpStats.success && followUpStats.data ? followUpStats.data.todayCount.toString() : "—";
  const overdueCount = followUpStats.success && followUpStats.data ? followUpStats.data.overdueCount : 0;
  const todayList = followUpStats.success && followUpStats.data ? followUpStats.data.todayList : [];

  const dashboardStats = [
    { label: "Total Leads", value: "—", icon: UsersRound },
    { label: "New Leads", value: "—", icon: UserPlus },
    { label: "Follow-ups Today", value: todayCount, icon: CalendarClock },
    { label: "Qualified Leads", value: "—", icon: BadgeCheck },
    { label: "Won Clients", value: "—", icon: Handshake },
    { label: "Revenue", value: "—", icon: CircleDollarSign },
  ] as const;

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="A clear view of your sales activity." />
      <section aria-labelledby="sales-overview-heading">
        <h2 id="sales-overview-heading" className="sr-only">Sales overview</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {dashboardStats.map((stat) => (
            <div key={stat.label} className="relative">
              <StatCard {...stat} />
              {stat.label === "Follow-ups Today" && overdueCount > 0 && (
                <div className="absolute top-2 right-2 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  {overdueCount} Overdue
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
      <section aria-labelledby="follow-ups-heading" className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 id="follow-ups-heading" className="text-lg font-semibold tracking-tight text-slate-950">Today&apos;s Follow-ups</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Your scheduled conversations will appear here.</p>
          </div>
          <Link href="/follow-ups" className="text-sm font-medium text-blue-600 hover:text-blue-700">View all &rarr;</Link>
        </div>
        {todayList.length === 0 ? (
          <EmptyState title="No follow-ups scheduled for today." description="You are all caught up for now." icon={Inbox} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {todayList.map(f => {
              const typeInfo = typeStyles[f.type] ?? typeStyles.Other;
              return (
                <div key={f.id} className="rounded-xl border border-[var(--border)] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-semibold text-slate-900 text-[15px]">{f.lead?.name || "Unknown"}</h3>
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${typeInfo.bg} ${typeInfo.text}`}>
                      {getTypeIcon(f.type)} {f.type}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-[var(--muted)]">{formatTime(f.scheduledAt)}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
