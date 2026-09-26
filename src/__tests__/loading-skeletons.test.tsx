import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Skeleton,
  KPICardSkeleton,
  KPICardsGridSkeleton,
  ActivitySkeleton,
  LeadCardSkeleton,
  LeadTableSkeleton,
  PipelineCardSkeleton,
  PipelineColumnSkeleton,
  FollowUpCardSkeleton,
  NoteCardSkeleton,
  LeadDetailSkeleton,
  DashboardSkeleton,
  LeadsSkeleton,
  PipelineSkeleton,
  FollowUpsSkeleton,
  DealsSkeleton,
  AnalyticsSkeleton,
  PersonalNotesSkeleton,
} from "@/components/skeletons";

describe("CRM Loading & Skeleton UX Suite", () => {
  describe("Base Skeleton Component", () => {
    it("renders with aria-hidden and skeleton-shimmer class", () => {
      const html = renderToStaticMarkup(<Skeleton className="h-6 w-24" />);
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain("skeleton-shimmer");
      expect(html).toContain("h-6 w-24");
    });

    it("supports custom inline styles for chart placeholders", () => {
      const html = renderToStaticMarkup(<Skeleton className="rounded" style={{ width: "75%" }} />);
      expect(html).toContain('style="width:75%"');
    });
  });

  describe("Shared Skeleton Units", () => {
    it("renders KPICardSkeleton with label, value, and icon placeholder", () => {
      const html = renderToStaticMarkup(<KPICardSkeleton />);
      expect(html).toContain("rounded-2xl border border-slate-200");
      expect(html).toContain('aria-hidden="true"');
    });

    it("renders KPICardsGridSkeleton with 6 responsive cards", () => {
      const html = renderToStaticMarkup(<KPICardsGridSkeleton count={6} />);
      expect(html).toContain("lg:grid lg:grid-cols-6");
      expect(html).toContain("overflow-x-auto");
    });

    it("renders LeadCardSkeleton with mobile actions and badges", () => {
      const html = renderToStaticMarkup(<LeadCardSkeleton />);
      expect(html).toContain("rounded-xl border border-slate-200 bg-white");
    });

    it("renders LeadTableSkeleton with standard table columns", () => {
      const html = renderToStaticMarkup(<LeadTableSkeleton rows={5} />);
      expect(html).toContain("<table");
      expect(html).toContain("<tbody");
    });

    it("renders PipelineColumnSkeleton with column header and cards", () => {
      const html = renderToStaticMarkup(<PipelineColumnSkeleton count={2} />);
      expect(html).toContain("w-[85vw] sm:w-[18rem] lg:w-80");
    });

    it("renders FollowUpCardSkeleton with schedule and actions", () => {
      const html = renderToStaticMarkup(<FollowUpCardSkeleton />);
      expect(html).toContain("rounded-xl border border-slate-200 bg-white");
    });

    it("renders NoteCardSkeleton with title and content placeholders", () => {
      const html = renderToStaticMarkup(<NoteCardSkeleton />);
      expect(html).toContain("rounded-2xl border border-slate-200 bg-white");
    });

    it("renders LeadDetailSkeleton with detail grid and activity section", () => {
      const html = renderToStaticMarkup(<LeadDetailSkeleton />);
      expect(html).toContain("grid grid-cols-2");
    });
  });

  describe("App Router Full-Page Skeletons", () => {
    it("renders DashboardSkeleton with KPI cards, follow-ups, and activity", () => {
      const html = renderToStaticMarkup(<DashboardSkeleton />);
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Loading dashboard"');
      expect(html).toContain("lg:grid-cols-6");
      // Height maintaining structure without content jumps
      expect(html).toContain("grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-2");
    });

    it("renders LeadsSkeleton with search, tabs, table, and mobile cards", () => {
      const html = renderToStaticMarkup(<LeadsSkeleton />);
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Loading leads"');
      expect(html).toContain("<table"); // desktop
      expect(html).toContain("lg:hidden"); // mobile cards container
    });

    it("renders PipelineSkeleton with horizontal columns and analytics", () => {
      const html = renderToStaticMarkup(<PipelineSkeleton />);
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Loading pipeline"');
      expect(html).toContain("overflow-x-auto");
      expect(html).toContain("w-[85vw]");
    });

    it("renders FollowUpsSkeleton with tab navigation and card grid", () => {
      const html = renderToStaticMarkup(<FollowUpsSkeleton />);
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Loading follow-ups"');
      expect(html).toContain("grid grid-cols-1 md:grid-cols-2");
    });

    it("renders DealsSkeleton with 5 financial KPI cards, tabs, and table", () => {
      const html = renderToStaticMarkup(<DealsSkeleton />);
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Loading deals and payments"');
      expect(html).toContain("grid-cols-2 md:grid-cols-3 lg:grid-cols-5");
      expect(html).toContain("<table");
    });

    it("renders AnalyticsSkeleton with 6 KPI cards, funnel bars, and trend placeholders", () => {
      const html = renderToStaticMarkup(<AnalyticsSkeleton />);
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Loading analytics"');
      expect(html).toContain("grid-cols-2 md:grid-cols-3 lg:grid-cols-6");
      // Funnel chart placeholder shapes
      expect(html).toContain("style=\"width:90%\"");
      expect(html).toContain("style=\"width:75%\"");
    });

    it("renders PersonalNotesSkeleton with search bar, quick capture, and card grid", () => {
      const html = renderToStaticMarkup(<PersonalNotesSkeleton />);
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('aria-label="Loading personal notes"');
      expect(html).toContain("grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3");
    });

    it("respects includeHeader=false for nested suspense fallback", () => {
      const htmlWithHeader = renderToStaticMarkup(<PipelineSkeleton includeHeader={true} />);
      const htmlWithoutHeader = renderToStaticMarkup(<PipelineSkeleton includeHeader={false} />);
      expect(htmlWithHeader.length).toBeGreaterThan(htmlWithoutHeader.length);
    });
  });

  describe("Accessibility & Motion Safety", () => {
    it("marks decorative skeleton items as aria-hidden", () => {
      const html = renderToStaticMarkup(<DashboardSkeleton />);
      expect(html).toContain('aria-hidden="true"');
    });

    it("does not render focusable tabIndex on decorative skeleton containers", () => {
      const html = renderToStaticMarkup(<DashboardSkeleton />);
      expect(html).not.toContain('tabindex="0"');
    });
  });
});
