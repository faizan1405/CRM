import { Info } from "lucide-react";
import type { AnalyticsData, AnalyticsDateRange } from "../types";
import { AnalyticsDateFilter } from "./analytics-date-filter";
import { AnalyticsKpis } from "./analytics-kpis";
import { FollowUpPerformance } from "./follow-up-performance";
import { LeadTrend } from "./lead-trend";
import { PipelineHealth } from "./pipeline-health";
import { RevenueTrend } from "./revenue-trend";
import { SalesFunnel } from "./sales-funnel";
import { WinLossCard } from "./win-loss-card";
import { LostReasonsAnalytics } from "@/features/lost-reasons/lost-reasons-analytics";
import type { LostReasonsAnalyticsData } from "@/features/lost-reasons/types";

export function AnalyticsDashboard({
  data,
  lostReasons,
  selectedRange,
}: {
  data: AnalyticsData;
  lostReasons: LostReasonsAnalyticsData;
  selectedRange: AnalyticsDateRange;
}) {
  const showCoverageWarning = Boolean(data.dataCoverageWarning || data.dataCoverage?.funnelWarning);
  const warningText =
    data.dataCoverageWarning ??
    "Historical stage tracking began after some existing leads were created, so older funnel data may be incomplete.";

  return (
    <div className="space-y-5 pb-10 sm:space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
            Performance & diagnosis
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Sales Analytics</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">
            See where deals slow down, what drives revenue, and where your team needs to follow through.
          </p>
        </div>
        <AnalyticsDateFilter selected={selectedRange} />
      </header>

      {showCoverageWarning ? (
        <div
          role="note"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm leading-5 text-amber-900"
        >
          <Info aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600" size={17} />
          <p>{warningText}</p>
        </div>
      ) : null}

      <AnalyticsKpis data={data.kpis} />
      <div className="grid min-w-0 gap-5 xl:grid-cols-3">
        <SalesFunnel stages={data.funnel} />
        <WinLossCard data={data.winLoss} />
      </div>
      <LostReasonsAnalytics data={lostReasons} />
      <div className="grid min-w-0 gap-5 xl:grid-cols-3">
        <RevenueTrend data={data.revenueTrend} />
        <LeadTrend data={data.leadTrend.points} />
      </div>
      <PipelineHealth stages={data.pipelineHealth.stages} />
      <FollowUpPerformance data={data.followUpPerformance} />
    </div>
  );
}
