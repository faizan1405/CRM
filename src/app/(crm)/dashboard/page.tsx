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
    <div className="space-y-4 sm:space-y-6 pb-12">
      <DashboardHeader />
      
      <KPICards data={data.kpis} />
      
      <section aria-labelledby="today-followups-heading">
        <h2 id="today-followups-heading" className="mb-2 text-[15px] sm:text-lg font-bold text-slate-900">Today&apos;s Follow-ups</h2>
        <Link href="/follow-ups?filter=today" className="flex min-w-0 items-center gap-3 rounded-xl border bg-white p-3 sm:p-4 shadow-sm hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150 hover:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-600">
          <div className="bg-blue-50 p-2 rounded-lg">
            <CalendarClock className="size-5 sm:size-6 shrink-0 text-blue-600" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1"><p className="text-[14px] sm:text-sm font-bold text-slate-900">{data.kpis.followUpsToday} scheduled today</p><p className="mt-0.5 text-[11px] sm:text-xs text-slate-500">View your schedule, mark done, or reschedule.</p></div>
          <ArrowRight className="size-4 sm:size-5 shrink-0 text-slate-400" aria-hidden="true" />
        </Link>
      </section>

      {priorityResult.data ? <PriorityLeads initialPage={priorityResult.data} /> : <section><h2 className="text-[15px] sm:text-lg font-bold">Priority Leads</h2><p role="alert" className="mt-2 text-sm text-rose-700">{priorityResult.error}</p><Link href="/leads" className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-700">Open Leads</Link></section>}
      
      <section aria-labelledby="recent-activity-heading">
        <h2 id="recent-activity-heading" className="mb-2 text-[15px] sm:text-lg font-bold tracking-tight text-slate-900">Recent Activity</h2>
        <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm"><RecentActivity data={data.recentActivity.slice(0, 5)} /></div>
      </section>

      <div className="grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-2">
        <section><h2 className="mb-2 text-[15px] sm:text-lg font-bold text-slate-900">Pipeline Summary</h2><div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm"><PipelineSnapshot data={data.pipeline} /></div></section>
        <section><h2 className="mb-2 text-[15px] sm:text-lg font-bold text-slate-900">Revenue Summary</h2><div className="rounded-xl border bg-white shadow-sm"><RevenueSnapshot data={data.revenue} /></div></section>
      </div>
    </div>
  );
}
