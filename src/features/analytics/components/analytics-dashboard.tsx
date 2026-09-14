"use client";

import { useState } from "react";
import type { DateRange, AnalyticsData } from "@/features/analytics/types";
import { AnalyticsPageHeader } from "@/features/analytics/components/analytics-date-filter";
import { AnalyticsKpis } from "@/features/analytics/components/analytics-kpis";
import { SalesFunnel } from "@/features/analytics/components/sales-funnel";
import { RevenueTrend } from "@/features/analytics/components/revenue-trend";
import { LeadTrend } from "@/features/analytics/components/lead-trend";

import { WinLossCard } from "@/features/analytics/components/win-loss-card";
import { PipelineHealth } from "@/features/analytics/components/pipeline-health";
import { FollowUpPerformance } from "@/features/analytics/components/follow-up-performance";

type Props = {
  /**
   * AGENT A: Replace this with the real AnalyticsData object returned by your
   * server action. The prop shape is defined in @/features/analytics/types.ts.
   *
   * Pass in the data for the currently selected DateRange by calling your
   * action when `dateRange` changes (via useEffect / transition / etc.).
   */
  initialData: AnalyticsData;
  /**
   * AGENT A: Optionally accept a server-side callback so date-range changes
   * can refetch. For now the client filters from the same initial snapshot.
   */
  onDateRangeChange?: (range: DateRange) => void;
};

export function AnalyticsDashboard({ initialData, onDateRangeChange }: Props) {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [data] = useState<AnalyticsData>(initialData);

  function handleRangeChange(range: DateRange) {
    setDateRange(range);
    onDateRangeChange?.(range);
    // AGENT A: trigger refetch here (e.g. router.push with search param, or a
    //          Server Action call that updates data state).
  }

  return (
    <div className="space-y-6 pb-16">
      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <AnalyticsPageHeader
        dateRange={dateRange}
        onDateRangeChange={handleRangeChange}
      />

      {/* ── KPIs ────────────────────────────────────────────────────────────── */}
      <AnalyticsKpis data={data.kpis} />

      {/* ── Main Grid ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

        {/* Left column: Funnel + Pipeline Health + Follow-up */}
        <div className="space-y-6 xl:col-span-1">
          <SalesFunnel dataCoverage={data.dataCoverage} stages={data.funnel} />
          <PipelineHealth data={data.pipelineHealth.stages} />
        </div>

        {/* Right column: Trends + Source + Win/Loss + Follow-up */}
        <div className="space-y-6 xl:col-span-2">
          {/* Revenue & Lead trends side-by-side on large screens */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RevenueTrend data={data.revenueTrend} />
            <LeadTrend data={data.leadTrend.points} />
          </div>


          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <WinLossCard 
              wonLeads={data.winLoss.won} 
              lostLeads={data.winLoss.lost} 
              winRate={data.winLoss.winRate} 
              lostRate={data.winLoss.lostRate} 
            />
            <FollowUpPerformance data={data.followUpPerformance} />
          </div>
        </div>
      </div>
    </div>
  );
}
