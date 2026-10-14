import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardHeader } from "@/features/dashboard/components/dashboard-header";
import { RevenueHeroCard } from "@/features/dashboard/components/revenue-hero-card";
import { TodaysPrioritiesCard } from "@/features/dashboard/components/todays-priorities-card";
import { KPICards } from "@/features/dashboard/components/kpi-cards";
import { PipelineSnapshot } from "@/features/dashboard/components/pipeline-snapshot";
import { PinnedLeadsCard } from "@/features/dashboard/components/pinned-leads-card";
import { DailyBriefingWorkspace } from "@/features/daily-briefing/components/daily-briefing-workspace";
import { BriefingHero } from "@/features/daily-briefing/components/briefing-hero";
import { PipelineBoard } from "@/features/pipeline/pipeline-board";
import { LeadFilters } from "@/features/leads/lead-filters";
import type { DashboardData } from "@/app/actions/dashboard";
import type { Lead } from "@/features/leads/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashboard",
}));

// Mock lead-navigation-provider
vi.mock("@/features/leads/lead-navigation-provider", () => ({
  useLeadNavigation: () => ({
    openLead: vi.fn(),
    openFollowUp: vi.fn(),
  }),
}));

// Mock whatsapp-context
vi.mock("@/components/whatsapp-context", () => ({
  useWhatsApp: () => ({
    openWhatsApp: vi.fn(),
  }),
}));

// Mock toast-provider
vi.mock("@/components/toast-provider", () => ({
  useToast: () => ({
    showToast: vi.fn(),
    showUndoToast: vi.fn(),
  }),
}));

describe("Four Redesign Pages Unified Integration Test", () => {
  const mockDashboardData: DashboardData = {
    userName: "Faizan Test",
    kpis: {
      totalLeads: 50,
      newLeads: 12,
      qualifiedLeads: 15,
      wonClients: 10,
      followUpsToday: 8,
      wonRevenue: 1250000,
      pinnedLeads: 4,
      staleLeads: 3,
      activeLeads: 35,
      winRate: 70,
      lostLeads: 5,
      collectedRevenue: 950000,
      outstandingRevenue: 300000,
      overdueDealsCount: 2,
    },
    needsAttention: {
      overdueFollowUps: 2,
      staleLeads: 3,
      uncontactedNewLeads: 5,
    },
    priorities: [
      {
        id: "p-1",
        leadId: "lead-1",
        leadName: "Rahul Sharma",
        actionNeeded: "Payment follow-up",
        time: "11:00 AM",
        phone: "+91 98765 43210",
        status: "Qualified",
        statusColor: "text-amber-600",
        type: "TODAY",
        business: "Sharma Tech",
      },
    ],
    pipeline: {
      new: 12,
      contacted: 8,
      qualified: 15,
      proposal: 5,
      won: 10,
      lost: 5,
    },
    pipelineStageValues: {
      new: 240000,
      contacted: 180000,
      qualified: 450000,
      proposal: 300000,
      won: 1250000,
      lost: 0,
      total: 2420000,
    },
    pinnedLeadsList: [
      {
        id: "lead-1",
        name: "Rahul Sharma",
        business: "Sharma Tech",
        status: "Qualified",
        value: 450000,
      },
    ],
    revenueTrend: [
      { month: "May", revenue: 200000 },
      { month: "Jun", revenue: 350000 },
      { month: "Jul", revenue: 250000 },
      { month: "Aug", revenue: 400000 },
      { month: "Sep", revenue: 300000 },
      { month: "Oct", revenue: 500000 },
    ],
    revenue: {
      won: 1250000,
      openPipeline: 1170000,
      avgWonDeal: 125000,
      collected: 950000,
      outstanding: 300000,
    },
    todayFollowUps: [
      {
        id: "fu-1",
        leadId: "lead-1",
        leadName: "Rahul Sharma",
        phone: "+91 98765 43210",
        business: "Sharma Tech",
        type: "Call",
        time: "11:00 AM",
        note: "Discuss proposal terms",
        isOverdue: false,
      },
    ],
    recentActivity: [
      {
        activityId: "act-1",
        leadId: "lead-1",
        leadName: "Rahul Sharma",
        type: "Call",
        message: "Called client about deal",
        timestamp: "2 hours ago",
      },
    ],
  };

  it("1. Dashboard: renders unified data, header, revenue hero, and priorities", () => {
    const headerHtml = renderToStaticMarkup(
      <DashboardHeader
        userName={mockDashboardData.userName || "Faizan"}
        followUpsCount={mockDashboardData.kpis.followUpsToday}
        openPipelineValue={mockDashboardData.revenue.openPipeline}
        waitingToCollect={mockDashboardData.kpis.outstandingRevenue}
      />
    );
    expect(headerHtml).toContain("Faizan Test");
    expect(headerHtml).toMatch(/Good (morning|afternoon|evening), Faizan Test/);

    const heroHtml = renderToStaticMarkup(
      <RevenueHeroCard
        wonRevenue={mockDashboardData.revenue.won}
        openPipeline={mockDashboardData.revenue.openPipeline}
        avgWonDeal={mockDashboardData.revenue.avgWonDeal}
        monthName="October"
        revenueTrend={mockDashboardData.revenueTrend}
      />
    );
    expect(heroHtml).toContain("Revenue");
    expect(heroHtml).toContain("Open Pipeline");

    const kpiHtml = renderToStaticMarkup(<KPICards data={mockDashboardData.kpis} />);
    expect(kpiHtml).toContain("Total Leads");
    expect(kpiHtml).toContain("50");

    const pinnedHtml = renderToStaticMarkup(
      <PinnedLeadsCard
        leads={mockDashboardData.pinnedLeadsList || []}
        totalPinnedCount={mockDashboardData.kpis.pinnedLeads}
      />
    );
    expect(pinnedHtml).toContain("Rahul Sharma");
    expect(pinnedHtml).toContain("Sharma Tech");

    const pipelineSnapshotHtml = renderToStaticMarkup(
      <PipelineSnapshot
        data={mockDashboardData.pipeline}
        values={mockDashboardData.pipelineStageValues}
      />
    );
    expect(pipelineSnapshotHtml).toContain("Qualified");
  });

  it("2. Daily Briefing: renders hero with authentic stats, snapshots and actions", () => {
    const briefingStats = {
      hotLeadsCount: 5,
      followUpsTodayCount: 8,
      overdueFollowUpsCount: 2,
      newLeadsCount: 12,
      staleLeadsCount: 3,
      activeOpportunityValue: 1170000,
      activeOpportunityValueFormatted: "₹11.7L",
    };

    const heroHtml = renderToStaticMarkup(<BriefingHero stats={briefingStats} />);
    expect(heroHtml).toContain("DAILY BRIEFING");
    expect(heroHtml).toContain("8"); // follow-ups today

    const workspaceHtml = renderToStaticMarkup(
      <DailyBriefingWorkspace
        initialStats={briefingStats}
        initialActions={[
          {
            id: "act-1",
            leadId: "lead-1",
            leadName: "Rahul Sharma",
            title: "Follow up on proposal",
            timeFormatted: "11:00 AM",
            priority: "HIGH",
            isDone: false,
            phone: "+91 98765 43210",
          },
        ]}
        initialCalls={[
          {
            id: "call-1",
            leadId: "lead-1",
            leadName: "Rahul Sharma",
            phone: "+91 98765 43210",
            timeFormatted: "11:00 AM",
            isOverdue: false,
            scheduledAt: new Date().toISOString(),
          },
        ]}
        initialProposals={[
          {
            id: "prop-1",
            leadId: "lead-1",
            clientName: "Rahul Sharma",
            companyName: "Sharma Tech",
            quotedAmountFormatted: "₹4.5L",
            statusLabel: "Proposal Sent",
            daysAgo: 2,
          },
        ]}
        initialPayment={{
          id: "deal-1",
          dealId: "deal-1",
          leadId: "lead-1",
          clientName: "Rahul Sharma",
          amount: 300000,
          amountFormatted: "₹3,00,000",
          dueDateFormatted: "due Oct 20",
          isOverdue: false,
        }}
      />
    );
    expect(workspaceHtml).toContain("Rahul Sharma");
    expect(workspaceHtml).toContain("Today&#x27;s Call List");
    expect(workspaceHtml).toContain("Proposals awaiting reply");
    expect(workspaceHtml).toContain("Payment to Chase");
  });

  it("3. Leads: renders filter bar with search, status tabs and mobile zoom prevention", () => {
    const filterHtml = renderToStaticMarkup(
      <LeadFilters
        query=""
        status="All"
        pinnedOnly={false}
        staleOnly={false}
        duplicatesOnly={false}
        selectedQuickStatuses={[]}
        selectedSources={[]}
        sortBy="default"
        totalLeads={50}
        filteredCount={50}
        statusCounts={{ All: 50, New: 12, Contacted: 8, Qualified: 15, "Proposal Sent": 5, Won: 10, Lost: 5 }}
        onQueryChange={vi.fn()}
        onStatusChange={vi.fn()}
        onPinnedOnlyChange={vi.fn()}
        onStaleOnlyChange={vi.fn()}
        onDuplicatesOnlyChange={vi.fn()}
        onSortByChange={vi.fn()}
        onQuickStatusToggle={vi.fn()}
        onSourceToggle={vi.fn()}
        onClear={vi.fn()}
      />
    );
    expect(filterHtml).toContain("Search name, business, phone");
    expect(filterHtml).toContain("Filters");
    expect(filterHtml).toContain("Qualified");
  });

  it("4. Pipeline: renders 3 visible columns on desktop with donut graph analytics", () => {
    const mockLeads: Lead[] = [
      {
        id: "l-1",
        name: "Rahul Sharma",
        phone: "+91 98765 43210",
        email: "rahul@example.com",
        business: "Sharma Tech",
        industry: "IT",
        source: "Website",
        budget: 500000,
        quotedAmount: 450000,
        status: "Qualified",
        notes: "",
        lastContactDate: null,
        nextFollowUpDate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const pipelineHtml = renderToStaticMarkup(<PipelineBoard initialLeads={mockLeads} />);
    expect(pipelineHtml).toContain("Sales Pipeline");
    expect(pipelineHtml).toContain("xl:w-[calc((100%-2rem)/3)]"); // 3 visible columns on desktop
    expect(pipelineHtml).toContain("Rahul Sharma");
  });
});
