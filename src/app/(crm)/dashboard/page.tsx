import type { Metadata } from "next";
import { PriorityLeads } from "@/features/dashboard/components/priority-leads";
import { DashboardHeader } from "@/features/dashboard/components/dashboard-header";
import { KPICards } from "@/features/dashboard/components/kpi-cards";
import { PipelineSnapshot } from "@/features/dashboard/components/pipeline-snapshot";
import { RevenueSnapshot } from "@/features/dashboard/components/revenue-snapshot";
import { RecentActivity } from "@/features/dashboard/components/recent-activity";
import { priorityPage } from "@/features/dashboard/priority-page";

import { getDashboardData } from "@/app/actions/dashboard";
import Link from "next/link";
import { CalendarClock, ArrowRight, AlertTriangle } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [result, priorityResult] = await Promise.all([getDashboardData(), priorityPage(1).then(data => ({ data, error: null })).catch(() => ({ data: null, error: "Could not load priority leads. Open Leads to review your records." }))]);
  
  if (!result.success || !result.data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertTriangle className="h-10 w-10 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-900">Failed to load dashboard</h2>
        <p className="text-slate-500 mt-2">{result.error || "An unknown error occurred"}</p>
      </div>
    );
  }

  const { data } = result;

  return (
    <div className="space-y-6 pb-12">
      <DashboardHeader />
      <section aria-labelledby="recent-activity-heading">
        <h2 id="recent-activity-heading" className="mb-3 text-lg font-bold tracking-tight text-slate-900">Recent Activity</h2>
        <div className="rounded-2xl border bg-white p-3 sm:p-4"><RecentActivity data={data.recentActivity.slice(0, 6)} /></div>
      </section>

      <KPICards data={data.kpis} />
      
      {priorityResult.data ? <PriorityLeads initialPage={priorityResult.data} /> : <section><h2 className="text-lg font-bold">Priority Leads</h2><p role="alert" className="mt-3 text-sm text-rose-700">{priorityResult.error}</p><Link href="/leads" className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-700">Open Leads</Link></section>}
      <section aria-labelledby="today-followups-heading">
        <h2 id="today-followups-heading" className="mb-3 text-lg font-bold text-slate-900">Today&apos;s Follow-ups</h2>
        <Link href="/follow-ups?filter=today" className="flex min-w-0 items-center gap-3 rounded-xl border bg-white p-4 transition-colors duration-150 hover:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-600">
          <CalendarClock className="size-6 shrink-0 text-blue-600" aria-hidden="true" />
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{data.kpis.followUpsToday} scheduled today</p><p className="mt-1 text-xs text-slate-500">View your schedule, mark done, or reschedule.</p></div>
          <ArrowRight className="size-5 shrink-0 text-slate-400" aria-hidden="true" />
        </Link>
      </section>
      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <section><h2 className="mb-3 text-lg font-bold text-slate-900">Pipeline Summary</h2><div className="rounded-2xl border bg-white p-4"><PipelineSnapshot data={data.pipeline} /></div></section>
        <section><h2 className="mb-3 text-lg font-bold text-slate-900">Revenue Summary</h2><RevenueSnapshot data={data.revenue} /></section>
      </div>
    </div>
  );
}
