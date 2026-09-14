import type { Metadata } from "next";
import { BadgeCheck, CalendarClock, CircleDollarSign, Handshake, Inbox, UserPlus, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";

export const metadata: Metadata = { title: "Dashboard" };

const dashboardStats = [
  { label: "Total Leads", value: "—", icon: UsersRound },
  { label: "New Leads", value: "—", icon: UserPlus },
  { label: "Follow-ups Today", value: "—", icon: CalendarClock },
  { label: "Qualified Leads", value: "—", icon: BadgeCheck },
  { label: "Won Clients", value: "—", icon: Handshake },
  { label: "Revenue", value: "—", icon: CircleDollarSign },
] as const;

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="A clear view of your sales activity." />
      <section aria-labelledby="sales-overview-heading">
        <h2 id="sales-overview-heading" className="sr-only">Sales overview</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{dashboardStats.map((stat) => <StatCard key={stat.label} {...stat} />)}</div>
      </section>
      <section aria-labelledby="follow-ups-heading" className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-6">
        <div className="mb-5">
          <h2 id="follow-ups-heading" className="text-lg font-semibold tracking-tight text-slate-950">Today&apos;s Follow-ups</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Your scheduled conversations will appear here.</p>
        </div>
        <EmptyState title="No follow-ups scheduled for today." description="You are all caught up for now." icon={Inbox} />
      </section>
    </div>
  );
}
