"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import type { AnalyticsData, AnalyticsDateRange } from "../types";
import { DATE_RANGE_LABELS } from "../types";
import { AnalyticsDateFilter } from "./analytics-date-filter";
import { AnalyticsKpis } from "./analytics-kpis";
import { SalesFunnel } from "./sales-funnel";
import { RevenueTrend } from "./revenue-trend";
import { LeadTrend } from "./lead-trend";
import { PipelineHealth } from "./pipeline-health";
import { FollowUpPerformance } from "./follow-up-performance";
import { LostDealSection } from "./lost-deal-section";
import { WinLossCard } from "./win-loss-card";
import { InsightsPanel } from "./insights-panel";
import type { LostReasonsAnalyticsData } from "@/features/lost-reasons/types";
import { SlidingTabs } from "./kit";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "funnel", label: "Sales Funnel" },
  { id: "revenue", label: "Revenue" },
  { id: "follow-ups", label: "Follow-ups" },
  { id: "insights", label: "Insights" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function Section({
  id,
  title,
  kicker,
  children,
}: {
  id: SectionId;
  title: string;
  kicker: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-[130px] lg:scroll-mt-[80px]">
      <div className="mb-3.5 mt-10 flex items-baseline gap-3 first:mt-0">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <span className="text-[12.5px] text-muted-foreground">{kicker}</span>
      </div>
      {children}
    </section>
  );
}

export function AnalyticsDashboard({
  data,
  lostReasons,
  selectedRange,
}: {
  data: AnalyticsData;
  lostReasons: LostReasonsAnalyticsData;
  selectedRange: AnalyticsDateRange;
}) {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActiveSection(vis.target.id as SectionId);
      },
      { rootMargin: "-130px 0px -55% 0px" }
    );

    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });

    return () => obs.disconnect();
  }, []);

  const scrollToSection = (id: SectionId) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({
        behavior: prefersReduced ? "auto" : "smooth",
        block: "start",
      });
    }
  };

  const showCoverageWarning = Boolean(
    data.dataCoverageWarning || data.dataCoverage?.funnelWarning
  );
  const warningText =
    data.dataCoverageWarning ??
    "Historical stage tracking began after some existing leads were created, so older funnel data may be incomplete.";

  return (
    <div className="space-y-6 pb-16 sm:space-y-7">
      {/* Top Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="eyebrow text-primary">Sales Intelligence</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight sm:text-[30px] text-foreground">
            Performance & Analytics
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Understand your conversion funnel, actual collections, follow-through discipline, and where deals are lost.
          </p>
        </div>
        <AnalyticsDateFilter selected={selectedRange} />
      </header>

      {/* Sticky Section Navigation */}
      <nav
        aria-label="Analytics sections"
        className="sticky top-[52px] z-20 -mx-4 border-b border-border bg-background/90 px-4 py-2 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10"
      >
        <SlidingTabs
          id="sections"
          size="sm"
          value={activeSection}
          onChange={scrollToSection}
          options={SECTIONS.map((s) => ({ value: s.id, label: s.label }))}
          className="bg-transparent p-0"
        />
      </nav>

      {showCoverageWarning && (
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-xl border border-dashed border-border/80 bg-muted/40 px-4 py-3 text-[12.5px] text-muted-foreground"
        >
          <Info aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" size={15} />
          <p>{warningText}</p>
        </div>
      )}

      {/* Overview Section */}
      <Section
        id="overview"
        title="Overview"
        kicker={DATE_RANGE_LABELS[selectedRange] || "Selected range"}
      >
        <AnalyticsKpis
          data={data.kpis}
          revenueTrend={data.revenueTrend}
          leadTrend={data.leadTrend?.points ?? []}
        />
        <div className="mt-4">
          <LeadTrend data={data.leadTrend?.points ?? []} kpis={data.kpis} />
        </div>
      </Section>

      {/* Sales Funnel Section */}
      <Section
        id="funnel"
        title="Sales funnel"
        kicker="New → Contacted → Qualified → Proposal Sent → Won"
      >
        <SalesFunnel stages={data.funnel} lostCount={data.kpis.lostLeads} />
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PipelineHealth stages={data.pipelineHealth?.stages ?? []} />
          <LostDealSection data={lostReasons} />
        </div>
        <div id="win-loss" className="mt-4">
          <WinLossCard data={data.winLoss} />
        </div>
      </Section>

      {/* Revenue Intelligence Section */}
      <Section
        id="revenue"
        title="Revenue intelligence"
        kicker="Won value, collections and pipeline are different measures"
      >
        <RevenueTrend data={data.revenueTrend} kpis={data.kpis} />
      </Section>

      {/* Follow-up Performance Section */}
      <Section
        id="follow-ups"
        title="Follow-up performance"
        kicker="Execution discipline"
      >
        <FollowUpPerformance data={data.followUpPerformance} />
      </Section>

      {/* Insights Section */}
      <Section
        id="insights"
        title="Insights"
        kicker="Derived from verified CRM activity"
      >
        <InsightsPanel data={data} lostReasons={lostReasons} />
      </Section>
    </div>
  );
}
