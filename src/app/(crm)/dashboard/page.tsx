import type { Metadata } from "next";
import { getDashboardData } from "@/app/actions/dashboard";
import { DashboardHeader } from "@/features/dashboard/components/dashboard-header";
import { RevenueHeroCard } from "@/features/dashboard/components/revenue-hero-card";
import { TodaysPrioritiesCard } from "@/features/dashboard/components/todays-priorities-card";
import { KPICards } from "@/features/dashboard/components/kpi-cards";
import { PipelineSnapshot } from "@/features/dashboard/components/pipeline-snapshot";
import { PinnedLeadsCard } from "@/features/dashboard/components/pinned-leads-card";
import { RevenueSnapshot } from "@/features/dashboard/components/revenue-snapshot";
import { RecentActivity } from "@/features/dashboard/components/recent-activity";
import Link from "next/link";
import {
  CalendarClock,
  ArrowRight,
  AlertTriangle,
  Star,
  Clock,
} from "lucide-react";
import { Card, SectionHead } from "@/components/crm/primitives";
import { inrCompact } from "@/lib/crm/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const result = await getDashboardData();

  if (!result.success || !result.data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
        <h2 className="text-xl font-bold text-foreground">Failed to load dashboard</h2>
        <p className="text-muted-foreground mt-2">{result.error || "An unknown error occurred"}</p>
      </div>
    );
  }

  const { data } = result;

  // Month name in IST
  const now = new Date();
  const currentMonthName = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    month: "long",
  }).format(now);

  // Prepare Today's Priorities list combining scheduled follow-ups and high priority items
  const prioritiesForToday =
    data.todayFollowUps && data.todayFollowUps.length > 0
      ? data.todayFollowUps.slice(0, 6).map((f) => ({
          id: f.id,
          leadId: f.leadId,
          leadName: f.leadName,
          phone: f.phone,
          business: f.business,
          time: f.time,
          note: f.note,
          actionNeeded: f.type,
          isOverdue: f.isOverdue ?? false,
        }))
      : (data.priorities || []).slice(0, 6).map((p) => ({
          id: p.id,
          leadId: p.leadId,
          leadName: p.leadName,
          phone: p.phone,
          business: p.business,
          time: p.time,
          actionNeeded: p.actionNeeded,
          isOverdue: p.type === "OVERDUE",
        }));

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Premium Dashboard Header */}
      <DashboardHeader
        followUpsCount={data.kpis.followUpsToday}
        openPipelineValue={data.revenue.openPipeline}
        waitingToCollect={data.kpis.outstandingRevenue}
        userName={data.userName || "Faizan"}
      />

      {/* 2. Hero Row: Revenue Hero Chart + Today's Priorities */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <RevenueHeroCard
          wonRevenue={data.revenue.won}
          openPipeline={data.revenue.openPipeline}
          avgWonDeal={data.revenue.avgWonDeal}
          monthName={currentMonthName}
          revenueTrend={data.revenueTrend}
        />

        <TodaysPrioritiesCard
          priorities={prioritiesForToday}
          totalScheduledCount={data.kpis.followUpsToday}
        />
      </div>

      {/* 3. Premium KPI Strip + Secondary 6 Original KPIs */}
      <KPICards data={data.kpis} />

      {/* 4. Pipeline Overview + Pinned Leads */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <section aria-labelledby="pipeline-summary-heading">
          <Card className="p-5 sm:p-6 rounded-[var(--radius-xl)] border border-border/60 shadow-[var(--shadow-card)]">
            <SectionHead
              title="Pipeline Summary"
              meta={`${inrCompact(data.revenue.openPipeline)} open`}
              action={
                <Link
                  href="/pipeline"
                  className="text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Open board &rarr;
                </Link>
              }
            />
            <div className="mt-3">
              <PipelineSnapshot
                data={data.pipeline}
                values={data.pipelineStageValues}
              />
            </div>
          </Card>
        </section>

        <section aria-labelledby="pinned-leads-heading">
          <PinnedLeadsCard
            leads={data.pinnedLeadsList || []}
            totalPinnedCount={data.kpis.pinnedLeads}
          />
        </section>
      </div>

      {/* 5. Existing Revenue Summary and Important CRM Shortcuts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        {/* Left: 3 Quick Action Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <section aria-labelledby="today-followups-heading">
            <h2 id="today-followups-heading" className="mb-2 text-[14px] font-semibold text-foreground">
              Today&apos;s Follow-ups
            </h2>
            <Link
              href="/follow-ups?filter=today"
              className="card-surface card-hover flex min-w-0 items-center gap-3 p-4 transition-all duration-150 rounded-[var(--radius-xl)] border border-border/60 shadow-[var(--shadow-card)]"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                <CalendarClock className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-foreground">
                  {data.kpis.followUpsToday} scheduled today
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground truncate">
                  View schedule, mark done, or reschedule.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
            </Link>
          </section>

          <section aria-labelledby="pinned-leads-shortcut-heading">
            <h2 id="pinned-leads-shortcut-heading" className="mb-2 text-[14px] font-semibold text-foreground">
              Pinned Leads
            </h2>
            <Link
              href="/leads?view=pinned"
              className="card-surface card-hover flex min-w-0 items-center gap-3 p-4 transition-all duration-150 rounded-[var(--radius-xl)] border border-border/60 shadow-[var(--shadow-card)]"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning">
                <Star className="h-5 w-5 fill-warning" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-foreground">
                  {data.kpis.pinnedLeads} {data.kpis.pinnedLeads === 1 ? "pinned lead" : "pinned leads"}
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground truncate">
                  Your focused shortlist of serious prospects.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
            </Link>
          </section>

          <section aria-labelledby="stale-leads-shortcut-heading">
            <h2 id="stale-leads-shortcut-heading" className="mb-2 text-[14px] font-semibold text-foreground">
              Stale Leads
            </h2>
            <Link
              href="/leads?filter=stale"
              className="card-surface card-hover flex min-w-0 items-center gap-3 p-4 transition-all duration-150 rounded-[var(--radius-xl)] border border-border/60 shadow-[var(--shadow-card)]"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-danger-soft text-destructive">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-foreground">
                  {data.kpis.staleLeads} {data.kpis.staleLeads === 1 ? "stale lead" : "stale leads"}
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground truncate">
                  No activity or update for 3+ days.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
            </Link>
          </section>
        </div>

        {/* Right: Revenue Summary Card */}
        <section aria-labelledby="revenue-summary-heading">
          <Card className="p-5 sm:p-6 rounded-[var(--radius-xl)] border border-border/60 shadow-[var(--shadow-card)]">
            <SectionHead
              title="Revenue Summary"
              action={
                <Link
                  href="/analytics"
                  className="text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Analytics &rarr;
                </Link>
              }
            />
            <div className="mt-3">
              <RevenueSnapshot data={data.revenue} />
            </div>
          </Card>
        </section>
      </div>

      {/* 6. Recent Activity Timeline */}
      <section aria-labelledby="recent-activity-heading">
        <Card className="p-5 sm:p-6 rounded-[var(--radius-xl)] border border-border/60 shadow-[var(--shadow-card)]">
          <SectionHead
            title="Recent Activity"
            meta={`${data.recentActivity.length} recent`}
          />
          <div className="mt-3">
            <RecentActivity data={data.recentActivity.slice(0, 8)} />
          </div>
        </Card>
      </section>
    </div>
  );
}
