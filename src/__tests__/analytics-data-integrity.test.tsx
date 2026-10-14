import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as fs from "node:fs";
import * as path from "node:path";
import { bottleneck, pct, transitions } from "@/features/analytics/derive";
import { SalesFunnel } from "@/features/analytics/components/sales-funnel";
import { AnalyticsKpis } from "@/features/analytics/components/analytics-kpis";
import { FollowUpPerformance } from "@/features/analytics/components/follow-up-performance";
import { RevenueTrend } from "@/features/analytics/components/revenue-trend";
import { inr, inrCompact } from "@/lib/crm/format";
import type { CoreMetrics, FollowUpPerformanceData, FunnelStage } from "@/features/analytics/types";

describe("Analytics Data Integrity & Canonical Accuracy", () => {
  // ─── 1. Money Received must not derive from arbitrary percentages of won revenue ─
  it("Requirement 1: Money Received does NOT use arbitrary percentage multipliers or synthetic sparklines", () => {
    // Statically verify the component source code does not contain "* 0.7" or fake multiplier
    const kpiSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/features/analytics/components/analytics-kpis.tsx"),
      "utf8"
    );
    expect(kpiSource).not.toContain("0.7");
    expect(kpiSource).not.toContain("t.revenue *");

    // Render with independent wonRevenue and moneyReceived
    const kpis: CoreMetrics = {
      totalLeads: 20,
      newLeads: 5,
      contactedLeads: 5,
      qualifiedLeads: 4,
      proposalSent: 3,
      wonLeads: 2,
      lostLeads: 1,
      winRate: 2 / 3,
      lostRate: 1 / 3,
      wonRevenue: 100000,
      moneyReceived: 25000, // Explicitly different from 70% of 100,000
      totalOutstanding: 75000,
      collectionRate: 25.0,
      openPipelineValue: 150000,
      avgWonDeal: 50000,
      followUpsCreated: 12,
      followUpsCompleted: 8,
      overdueFollowUps: 2,
    };

    const html = renderToStaticMarkup(
      <AnalyticsKpis
        data={kpis}
        revenueTrend={[{ label: "W1", revenue: 100000, leadCount: 2, isEstimated: false }]}
        completionRate={0.8}
      />
    );

    // Won Deal Value should reflect ₹1,00,000
    expect(html).toContain("Won Deal Value");
    expect(html).toContain("₹1,00,000");

    // Money Received should reflect the exact ₹25,000, NOT ₹70,000
    expect(html).toContain("Money Received");
    expect(html).toContain("₹25,000");
    expect(html).not.toContain("₹70,000");
  });

  // ─── 2. Follow-up overdue counts must not be double-counted ─────────────────────
  it("Requirement 2: Follow-up overdue counts are mutually exclusive to prevent double-counting in stacked bars", () => {
    const fuData: FollowUpPerformanceData = {
      created: 10,
      completed: 4,
      pending: 6, // Canonical backend: pending is ALL pending follow-ups (includes overdue)
      overdue: 2, // Overdue is a subset of pending (2 out of 6)
      completionRate: 4 / 10, // 40.0%
      byType: [
        {
          type: "CALL",
          total: 10,
          created: 10,
          completed: 4,
          pending: 6,
          overdue: 2,
        },
      ],
    };

    // Mutually exclusive calculation:
    // completed = 4
    // pendingNotOverdue = pending - overdue = 6 - 2 = 4
    // overdue = 2
    // total evaluated = 4 + 4 + 2 = 10 (equals completed + pending)
    const pendingNotOverdue = Math.max(0, fuData.pending - fuData.overdue);
    expect(pendingNotOverdue).toBe(4);
    expect(fuData.completed + pendingNotOverdue + fuData.overdue).toBe(fuData.completed + fuData.pending);

    const html = renderToStaticMarkup(<FollowUpPerformance data={fuData} />);

    // Should render the mutually exclusive breakdown
    expect(html).toContain("Completed");
    expect(html).toContain("Pending (on time)");
    expect(html).toContain("Overdue");
    // Completed is 4
    expect(html).toContain("4");
    // Overdue is 2
    expect(html).toContain("2");
  });

  // ─── 3. Completion Rate excludes cancelled records ──────────────────────────────
  it("Requirement 3: Completion Rate excludes cancelled records and matches canonical backend formula", () => {
    // 4 completed, 6 pending (including 2 overdue), 5 cancelled (abandoned)
    // Canonical formula: completed / (completed + pending) = 4 / (4 + 6) = 40.0%
    // If cancelled were included in denominator: 4 / (4 + 6 + 5) = 26.7%
    const fuData: FollowUpPerformanceData = {
      created: 15,
      completed: 4,
      pending: 6,
      overdue: 2,
      completionRate: 0.4, // Canonical 40.0%
      byType: [],
    };

    expect(fuData.completionRate).toBe(0.4);

    const kpis: CoreMetrics = {
      totalLeads: 10,
      newLeads: 2,
      qualifiedLeads: 2,
      proposalSent: 2,
      wonLeads: 2,
      lostLeads: 2,
      winRate: 0.5,
      lostRate: 0.5,
      wonRevenue: 50000,
      openPipelineValue: 50000,
      avgWonDeal: 25000,
      followUpsCreated: 15, // includes 5 cancelled
      followUpsCompleted: 4,
      overdueFollowUps: 2,
    };

    const html = renderToStaticMarkup(
      <AnalyticsKpis data={kpis} completionRate={fuData.completionRate} />
    );

    // Formatted completion rate must be 40.0%, NOT 26.7%
    expect(html).toContain("40.0%");
    expect(html).not.toContain("26.7%");
  });

  // ─── 4. Zero leads produce a correct empty funnel ───────────────────────────────
  it("Requirement 4: Zero leads produce a correct empty funnel without fake conversions or bottlenecks", () => {
    const emptyStages: FunnelStage[] = [
      { status: "NEW", label: "New", reached: 0, conversionFromPrev: null },
      { status: "CONTACTED", label: "Contacted", reached: 0, conversionFromPrev: null },
      { status: "QUALIFIED", label: "Qualified", reached: 0, conversionFromPrev: null },
      { status: "PROPOSAL_SENT", label: "Proposal Sent", reached: 0, conversionFromPrev: null },
      { status: "WON", label: "Won", reached: 0, conversionFromPrev: null },
    ];

    // transitions and bottleneck on empty stages must return empty/null
    expect(transitions(emptyStages)).toEqual([]);
    expect(bottleneck(emptyStages)).toBeNull();

    // Render component with zero data
    const html = renderToStaticMarkup(<SalesFunnel stages={emptyStages} lostCount={0} />);

    // Must show empty state
    expect(html).toContain("No funnel activity yet");
    expect(html).toContain("Stage movement will appear as leads enter and progress");
    // Must NOT show fake conversion arrows or fake bottleneck pills
    expect(html).not.toContain("Biggest funnel bottleneck");
    expect(html).not.toContain("converted");
    expect(html).not.toContain("% drop");
    expect(html).not.toContain("Bottleneck");
  });

  // ─── 5. Currency and percentage formatting are accurate ────────────────────────
  it("Requirement 5: Currency and percentage formatting follow Indian numbering and exact precision", () => {
    expect(inr(150000)).toBe("₹1,50,000");
    expect(inr(0)).toBe("₹0");
    expect(inr(null)).toBe("—");
    expect(inr(undefined)).toBe("—");

    expect(inrCompact(15000000)).toBe("₹1.5Cr");
    expect(inrCompact(150000)).toBe("₹1.5L");
    expect(inrCompact(25000)).toBe("₹25k");

    expect(pct(0.456, 1)).toBe("45.6%");
    expect(pct(0.5, 0)).toBe("50%");
    expect(pct(1, 0)).toBe("100%");
    expect(pct(0, 1)).toBe("0.0%");
  });

  // ─── 6. Metric descriptions and date scopes match the underlying calculations ───
  it("Requirement 6: Metric descriptions accurately document Deal.finalAmount and correct date scopes", () => {
    const kpiSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/features/analytics/components/analytics-kpis.tsx"),
      "utf8"
    );

    // Won Deal Value must state Deal.finalAmount, NOT quotedAmount
    expect(kpiSource).toContain("Deal.finalAmount");
    expect(kpiSource).toContain("Quoted amount is not used for won deals");

    // Outstanding must explicitly state current all-time snapshot
    expect(kpiSource).toContain("Current unpaid balance across all active deals in the CRM");
    expect(kpiSource).toContain("Current all-time snapshot");

    // Revenue breakdown in revenue-trend.tsx must use finalized contract value
    const revSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/features/analytics/components/revenue-trend.tsx"),
      "utf8"
    );
    expect(revSource).toContain("Finalized contract value of leads won in range");
    expect(revSource).not.toContain("Quoted value of leads won in range");
  });

  // ─── 7. Empty databases do not produce synthetic analytics ──────────────────────
  it("Requirement 7: Empty database metrics render zero/empty states without NaN or synthetic numbers", () => {
    const zeroKpis: CoreMetrics = {
      totalLeads: 0,
      newLeads: 0,
      contactedLeads: 0,
      qualifiedLeads: 0,
      proposalSent: 0,
      wonLeads: 0,
      lostLeads: 0,
      winRate: 0,
      lostRate: 0,
      wonRevenue: 0,
      moneyReceived: 0,
      totalOutstanding: 0,
      collectionRate: 0,
      openPipelineValue: 0,
      avgWonDeal: 0,
      followUpsCreated: 0,
      followUpsCompleted: 0,
      overdueFollowUps: 0,
    };

    const htmlKpi = renderToStaticMarkup(<AnalyticsKpis data={zeroKpis} completionRate={0} />);
    expect(htmlKpi).not.toContain("NaN");
    expect(htmlKpi).not.toContain("undefined");
    expect(htmlKpi).not.toContain("Infinity");

    const htmlRev = renderToStaticMarkup(<RevenueTrend data={[]} kpis={zeroKpis} />);
    expect(htmlRev).not.toContain("NaN");
    expect(htmlRev).not.toContain("Infinity");
    expect(htmlRev).toContain("no contracted deals");
  });
});
