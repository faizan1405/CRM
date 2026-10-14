import type { Metadata } from "next";
import { DashboardHeader } from "@/features/dashboard/components/dashboard-header";
import { KPICards } from "@/features/dashboard/components/kpi-cards";
import { PipelineSnapshot } from "@/features/dashboard/components/pipeline-snapshot";
import { RevenueSnapshot } from "@/features/dashboard/components/revenue-snapshot";
import { RecentActivity } from "@/features/dashboard/components/recent-activity";
import { getDashboardData } from "@/app/actions/dashboard";
import Link from "next/link";
import {
  CalendarClock,
  ArrowRight,
  AlertTriangle,
  Star,
  Clock,
  Phone,
  MessageCircle,
} from "lucide-react";
import { Card, SectionHead } from "@/components/crm/primitives";
import { inr, inrCompact, waLink, telLink } from "@/lib/crm/format";
import { cleanLeadName } from "@/features/leads/formatters";

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
  const currentMonth = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "long",
  }).format(new Date());

  const todayFollowUpsList = (data.todayFollowUps || []).slice(0, 5);

  return (
    <div className="space-y-6 pb-12">
      <DashboardHeader
        followUpsCount={data.kpis.followUpsToday}
        openPipelineValue={data.revenue.openPipeline}
      />

      {/* Hero row: Revenue Overview + Today's Priorities */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        {/* Left Hero Card: Revenue */}
        <Card className="rise flex flex-col justify-between overflow-hidden p-5 sm:p-6">
          <div>
            <div className="flex items-center justify-between">
              <div className="eyebrow">Revenue · {currentMonth}</div>
              <Link
                href="/analytics"
                className="text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Analytics &rarr;
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[32px] font-semibold leading-none tracking-[-0.035em] tabular sm:text-[40px] text-foreground">
                {inr(data.revenue.won)}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-md bg-success-soft px-1.5 py-0.5 text-[11.5px] font-medium text-success tabular">
                Won Revenue
              </span>
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Open pipeline holds <span className="font-semibold text-foreground">{inr(data.revenue.openPipeline)}</span> across active deal stages.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-border">
            <div className="flex justify-between text-[12px] mb-1.5">
              <span className="text-muted-foreground">Average won deal</span>
              <span className="font-semibold tabular text-foreground">{inr(data.revenue.avgWonDeal)}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="grow-x h-full rounded-full bg-primary"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      (data.revenue.won / Math.max(data.revenue.won + data.revenue.openPipeline, 1)) * 100
                    )
                  )}%`,
                }}
              />
            </div>
          </div>
        </Card>

        {/* Right Hero Card: Dark Ink Priorities Panel */}
        <div className="rise flex flex-col justify-between overflow-hidden rounded-[var(--radius-xl)] bg-ink text-ink-foreground shadow-[var(--shadow-lift)] p-5">
          <div>
            <div className="flex items-center justify-between pb-2">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted">
                  Today&apos;s priorities
                </div>
                <div className="mt-1 text-[15px] font-semibold">
                  {todayFollowUpsList.length
                    ? `${data.kpis.followUpsToday} conversations to have`
                    : "Nothing due right now"}
                </div>
              </div>
              <Link
                href="/follow-ups?filter=today"
                className="press grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-ink-line hover:text-ink-foreground"
                aria-label="All follow-ups"
              >
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <ol className="mt-2 divide-y divide-ink-line/40">
              {todayFollowUpsList.map((f, i) => (
                <li
                  key={f.id}
                  className="group flex items-center gap-3 py-2.5 transition-colors"
                >
                  <span className="w-4 shrink-0 text-[12px] tabular text-ink-muted">
                    {i + 1}
                  </span>
                  <Link
                    href={`/leads?selected=${encodeURIComponent(f.leadId)}`}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-[13.5px] font-medium hover:underline text-ink-foreground">
                      {cleanLeadName(f.leadName)}
                    </div>
                    <div className="truncate text-[12px] text-ink-muted">
                      <span className="tabular">{f.time}</span> · {f.type}
                    </div>
                  </Link>
                  <Link
                    href={`/leads?selected=${encodeURIComponent(f.leadId)}`}
                    aria-label={`Open ${f.leadName}`}
                    className="press grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-ink-line hover:text-ink-foreground"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </li>
              ))}
              {!todayFollowUpsList.length && (
                <li className="py-6 text-center text-[13px] text-ink-muted">
                  All caught up for today! Add or schedule follow-ups from any lead.
                </li>
              )}
            </ol>
          </div>

          <div className="mt-3 pt-3 border-t border-ink-line flex items-center justify-between text-[12px] text-ink-muted">
            <span>{data.kpis.followUpsToday} scheduled today</span>
            <Link
              href="/daily-briefing"
              className="text-sidebar-primary hover:underline font-medium text-[12px]"
            >
              Open Daily Briefing &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <KPICards data={data.kpis} />

      {/* 3 Prospect Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        <section aria-labelledby="today-followups-heading">
          <h2 id="today-followups-heading" className="mb-2 text-[14px] font-semibold text-foreground">
            Today&apos;s Follow-ups
          </h2>
          <Link
            href="/follow-ups?filter=today"
            className="card-surface card-hover flex min-w-0 items-center gap-3 p-4 transition-all duration-150"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
              <CalendarClock className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-foreground">
                {data.kpis.followUpsToday} scheduled today
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                View your schedule, mark done, or reschedule.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
          </Link>
        </section>

        <section aria-labelledby="pinned-leads-heading">
          <h2 id="pinned-leads-heading" className="mb-2 text-[14px] font-semibold text-foreground">
            Pinned Leads
          </h2>
          <Link
            href="/leads?view=pinned"
            className="card-surface card-hover flex min-w-0 items-center gap-3 p-4 transition-all duration-150"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning">
              <Star className="h-5 w-5 fill-warning" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-foreground">
                {data.kpis.pinnedLeads} {data.kpis.pinnedLeads === 1 ? "pinned lead" : "pinned leads"}
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                Your focused shortlist of serious prospects.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
          </Link>
        </section>

        <section aria-labelledby="stale-leads-heading">
          <h2 id="stale-leads-heading" className="mb-2 text-[14px] font-semibold text-foreground">
            Stale Leads
          </h2>
          <Link
            href="/leads?filter=stale"
            className="card-surface card-hover flex min-w-0 items-center gap-3 p-4 transition-all duration-150"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-danger-soft text-destructive">
              <Clock className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-foreground">
                {data.kpis.staleLeads} {data.kpis.staleLeads === 1 ? "stale lead" : "stale leads"}
              </p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                No activity or update for 3+ days.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
          </Link>
        </section>
      </div>

      {/* 2-Column Grid: Pipeline Summary & Revenue Summary */}
      <div className="grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-2">
        <section aria-labelledby="pipeline-summary-heading">
          <Card className="p-5">
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
              <PipelineSnapshot data={data.pipeline} />
            </div>
          </Card>
        </section>

        <section aria-labelledby="revenue-summary-heading">
          <Card className="p-5">
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

      {/* Recent Activity */}
      <section aria-labelledby="recent-activity-heading">
        <Card className="p-5">
          <SectionHead
            title="Recent Activity"
            meta={`${data.recentActivity.length} recent`}
          />
          <div className="mt-3">
            <RecentActivity data={data.recentActivity.slice(0, 6)} />
          </div>
        </Card>
      </section>
    </div>
  );
}
