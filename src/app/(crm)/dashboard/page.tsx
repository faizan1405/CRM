import type { Metadata } from "next";
import { DashboardHeader } from "@/features/dashboard/components/dashboard-header";
import { KPICards } from "@/features/dashboard/components/kpi-cards";
import { NeedsAttention } from "@/features/dashboard/components/needs-attention";
import { TodaysPriorities } from "@/features/dashboard/components/todays-priorities";
import { PipelineSnapshot } from "@/features/dashboard/components/pipeline-snapshot";
import { RevenueSnapshot } from "@/features/dashboard/components/revenue-snapshot";
import { RecentActivity } from "@/features/dashboard/components/recent-activity";
import { AIAttentionDashboardSection } from "@/features/ai-attention";

import { getDashboardData } from "@/app/actions/dashboard";
import Link from "next/link";
import { getTypeIcon, typeStyles } from "@/features/followups/follow-up-types";
import { CalendarClock, ArrowRight, AlertTriangle, Sparkles } from "lucide-react";
import { FollowUpType } from "@prisma/client";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const result = await getDashboardData();
  
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
      
      <KPICards data={data.kpis} />
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Priorities & Attention */}
        <div className="xl:col-span-2 space-y-6">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" aria-hidden="true" />
                <h2 className="text-lg font-bold tracking-tight text-slate-900">AI Attention Leads</h2>
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Immediate Action</span>
            </div>
            <AIAttentionDashboardSection items={data.attentionLeads} priorities={data.priorities} />
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">Needs Attention</h2>
            </div>
            <NeedsAttention data={data.needsAttention} />
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">Today&apos;s Priorities</h2>
            </div>
            <TodaysPriorities priorities={data.priorities} />
          </section>
          
          <section>
             <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">Pipeline Snapshot</h2>
              <Link href="/pipeline" className="text-sm font-medium text-blue-600 hover:text-blue-700">View Pipeline &rarr;</Link>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <PipelineSnapshot data={data.pipeline} />
            </div>
          </section>
        </div>
        
        {/* Right Column: Snapshots & Activity */}
        <div className="space-y-6">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">Recent Activity</h2>
            </div>
            <div className="overflow-hidden rounded-2xl border bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              <RecentActivity data={data.recentActivity} />
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">Today&apos;s Follow-ups</h2>
              <Link href="/follow-ups" className="text-sm font-medium text-blue-600 hover:text-blue-700">View all &rarr;</Link>
            </div>
            <div className="rounded-2xl border bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
              {data.todayFollowUps.length === 0 ? (
                <div className="py-6 flex flex-col items-center justify-center text-center">
                  <div className="mb-3 rounded-full bg-slate-50 p-3 text-slate-400">
                    <CalendarClock className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">No follow-ups today</h3>
                  <p className="mt-1 text-xs text-slate-500">You&apos;re all caught up!</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {data.todayFollowUps.map(f => {
                    const typeInfo = typeStyles[f.type as keyof typeof typeStyles] ?? typeStyles.OTHER;
                    return (
                      <div key={f.id} className="group flex items-center justify-between gap-3 rounded-xl border p-3 hover:bg-slate-50 transition-colors">
                        <div className="flex flex-col gap-1 overflow-hidden">
                          <h3 className="truncate text-sm font-semibold text-slate-900">{f.leadName || "Unknown"}</h3>
                          <div className="flex items-center gap-2">
                             <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${typeInfo.bg} ${typeInfo.text}`}>
                                {getTypeIcon(f.type as FollowUpType)} {f.type}
                             </span>
                             <span className="text-xs text-slate-500">{f.time}</span>
                          </div>
                        </div>
                        <Link href={`/leads/${f.leadId}`} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border text-slate-400 shadow-sm hover:text-slate-900 hover:bg-slate-50 transition-colors shrink-0">
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">Revenue Snapshot</h2>
            </div>
            <RevenueSnapshot data={data.revenue} />
          </section>
        </div>
      </div>
    </div>
  );
}
