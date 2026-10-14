import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import DailyBriefingPage from "@/app/(crm)/daily-briefing/page";
import { DailyBriefingWorkspace } from "@/features/daily-briefing/components/daily-briefing-workspace";
import { BriefingHero } from "@/features/daily-briefing/components/briefing-hero";
import { BriefingSummaryCards } from "@/features/daily-briefing/components/briefing-summary-cards";
import { AiBriefingBanner } from "@/features/daily-briefing/components/ai-briefing-banner";
import { TodaysCallList } from "@/features/daily-briefing/components/todays-call-list";
import { ProposalsAwaitingReply } from "@/features/daily-briefing/components/proposals-awaiting-reply";
import { PaymentToChase } from "@/features/daily-briefing/components/payment-to-chase";
import type {
  BriefingSummaryStats,
  BriefingActionItem,
  AiBriefingData,
  BriefingCallItem,
  BriefingProposalItem,
  BriefingPaymentItem,
} from "@/features/daily-briefing/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
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

const mockStats: BriefingSummaryStats = {
  hotLeadsCount: 5,
  followUpsTodayCount: 7,
  overdueFollowUpsCount: 2,
  newLeadsCount: 3,
  staleLeadsCount: 4,
  activeOpportunityValue: 450000,
  activeOpportunityValueFormatted: "₹4,50,000",
};

const mockAiBriefing: AiBriefingData = {
  summary: "5 hot prospects and 2 overdue follow-ups need immediate reconnection.",
  keyPoints: [
    "Rahul Sharma is in final decision stage",
    "Overdue touch with Priya Enterprises needs immediate call",
  ],
  recommendation: "Call Rahul Sharma first regarding payment confirmation.",
  generatedAt: "2026-10-14T10:00:00.000Z",
};

const mockActions: BriefingActionItem[] = [
  {
    id: "action-1",
    title: "Rahul Sharma",
    subtitle: "Sharma Tech Solutions",
    priority: "Critical",
    isDone: false,
    score: 95,
    formattedValue: "₹1,50,000",
    dueTime: "10:30 AM",
    phone: "9876543210",
    reason: "Scheduled call is overdue",
    recommendedAction: "Call immediately to finalize proposal terms",
    leadId: "lead-1",
    leadName: "Rahul Sharma",
  },
  {
    id: "action-2",
    title: "Anita Desai",
    subtitle: "Desai Architects",
    priority: "Important",
    isDone: false,
    score: 82,
    formattedValue: "₹80,000",
    dueTime: "02:00 PM",
    phone: "9876543211",
    reason: "High buying intent",
    recommendedAction: "Send WhatsApp portfolio update",
    leadId: "lead-2",
    leadName: "Anita Desai",
  },
];

const mockCalls: BriefingCallItem[] = [
  {
    id: "call-1",
    leadId: "lead-1",
    leadName: "Rahul Sharma",
    phone: "9876543210",
    context: "Review software implementation proposal",
    timeFormatted: "Late",
    isOverdue: true,
    scheduledAt: "2026-10-14T09:00:00.000Z",
  },
  {
    id: "call-2",
    leadId: "lead-2",
    leadName: "Anita Desai",
    phone: "9876543211",
    context: "Follow-up on design requirements",
    timeFormatted: "14:30",
    isOverdue: false,
    scheduledAt: "2026-10-14T14:30:00.000Z",
  },
];

const mockProposals: BriefingProposalItem[] = [
  {
    id: "prop-1",
    leadId: "lead-3",
    clientName: "Vikram Malhotra",
    companyName: "Malhotra Logistics",
    quotedAmountFormatted: "₹2.5L",
    statusLabel: "Proposal Sent",
    daysAgo: 2,
  },
];

const mockPayment: BriefingPaymentItem = {
  id: "deal-1",
  dealId: "deal-1",
  leadId: "lead-4",
  clientName: "Mehta Exports",
  companyName: "Mehta & Co",
  amount: 180000,
  amountFormatted: "₹1,80,000",
  dueDateFormatted: "due 18 Oct",
  isOverdue: true,
};

vi.mock("@/app/actions/daily-briefing", () => ({
  getDailyBriefing: async () => ({
    success: true,
    data: {
      briefingDate: "2026-10-14",
      summaryStats: mockStats,
      priorityActions: mockActions,
      aiBriefing: mockAiBriefing,
      todayCalls: mockCalls,
      awaitingProposals: mockProposals,
      paymentToChase: mockPayment,
    },
  }),
  refreshDailyBriefingAi: vi.fn(),
}));

describe("Daily Briefing Redesign - Lovable Fidelity & Functional Preservation", () => {
  it("renders the complete DailyBriefingPage with authentic data", async () => {
    const html = renderToStaticMarkup(await DailyBriefingPage());

    // Section 1: Hero
    expect(html).toContain("DAILY BRIEFING");
    expect(html).toContain("5 hot leads, 7 follow-ups due, ₹4,50,000 in pipeline.");
    expect(html).toContain("Follow-ups");
    expect(html).toContain("Overdue");
    expect(html).toContain("Hot Leads");

    // Section 2: AI Daily Intelligence
    expect(html).toContain("AI Daily Intelligence");
    expect(html).toContain("5 hot prospects and 2 overdue follow-ups need immediate reconnection.");
    expect(html).toContain("Recommended action:");
    expect(html).toContain("Call Rahul Sharma first regarding payment confirmation.");
    expect(html).toContain("Why these 3 leads?");

    // Section 3: All 6 Pipeline Snapshot cards
    expect(html).toContain("Pipeline Snapshot");
    expect(html).toContain("Hot Leads");
    expect(html).toContain("Follow-ups Today");
    expect(html).toContain("Overdue Follow-ups");
    expect(html).toContain("New Leads");
    expect(html).toContain("Leads Becoming Stale");
    expect(html).toContain("Active Opportunity Value");

    // Section 4: Left column - Top Priorities
    expect(html).toContain("Top priorities");
    expect(html).toContain("Rahul Sharma");
    expect(html).toContain("Sharma Tech Solutions");
    expect(html).toContain("Critical");
    expect(html).toContain("Anita Desai");
    expect(html).toContain("Important");
    expect(html).toContain("All (2)");
    expect(html).toContain("Critical (1)");
    expect(html).toContain("Important (1)");
    expect(html).toContain("Done (0)");
    expect(html).toContain("Progress:");

    // Section 4: Right column widgets
    // Widget 1: Today's Call List
    expect(html).toContain("Today&#x27;s Call List");
    expect(html).toContain("Review software implementation proposal");
    expect(html).toContain("Late");

    // Widget 2: Proposals (Proposal Stage Leads)
    expect(html).toContain("Proposal Stage Leads");
    expect(html).toContain("Vikram Malhotra");
    expect(html).toContain("Malhotra Logistics");
    expect(html).toContain("₹2.5L");
    expect(html).toContain("2d ago");

    // Widget 3: Payment to Chase
    expect(html).toContain("Payment to Chase");
    expect(html).toContain("₹1,80,000");
    expect(html).toContain("Mehta Exports");
    expect(html).toContain("due 18 Oct");
    expect(html).toContain("Overdue");
  });

  it("renders BriefingHero with real stats and reset action", () => {
    const html = renderToStaticMarkup(
      <BriefingHero
        stats={mockStats}
        onResetActions={() => {}}
      />
    );
    expect(html).toContain("DAILY BRIEFING");
    expect(html).toContain("5 hot leads, 7 follow-ups due, ₹4,50,000 in pipeline.");
    expect(html).toContain("Reset");
    expect(html).toContain("7"); // follow-ups
    expect(html).toContain("2"); // overdue
    expect(html).toContain("5"); // hot leads
  });

  it("renders all six summary snapshot cards with correct badges and counts", () => {
    const html = renderToStaticMarkup(
      <BriefingSummaryCards
        stats={mockStats}
        selectedCard={null}
      />
    );
    expect(html).toContain("Hot Leads");
    expect(html).toContain("Follow-ups Today");
    expect(html).toContain("Overdue Follow-ups");
    expect(html).toContain("New Leads");
    expect(html).toContain("Leads Becoming Stale");
    expect(html).toContain("Active Opportunity Value");
    expect(html).toContain("₹4,50,000");
    expect(html).toContain("High engagement score");
    expect(html).toContain("No touch for 7+ days");
  });

  it("renders AI Daily Intelligence banner with recommendation and key points", () => {
    const html = renderToStaticMarkup(
      <AiBriefingBanner
        data={mockAiBriefing}
        onRefresh={() => {}}
      />
    );
    expect(html).toContain("AI Daily Intelligence");
    expect(html).toContain("5 hot prospects and 2 overdue follow-ups need immediate reconnection.");
    expect(html).toContain("Recommended action:");
    expect(html).toContain("Call Rahul Sharma first regarding payment confirmation.");
    expect(html).toContain("Why these 3 leads?");
    expect(html).toContain("Refresh");
  });

  it("renders Today's Call List with real call items and empty state when empty", () => {
    const htmlWithCalls = renderToStaticMarkup(
      <TodaysCallList calls={mockCalls} />
    );
    expect(htmlWithCalls).toContain("Rahul Sharma");
    expect(htmlWithCalls).toContain("Late");
    expect(htmlWithCalls).toContain("14:30");

    const htmlEmpty = renderToStaticMarkup(
      <TodaysCallList calls={[]} />
    );
    expect(htmlEmpty).toContain("No calls scheduled for today");
    expect(htmlEmpty).toContain("All pending follow-ups are up to date.");
  });

  it("renders Proposals Awaiting Reply with real data and empty state when empty", () => {
    const htmlWithProposals = renderToStaticMarkup(
      <ProposalsAwaitingReply proposals={mockProposals} />
    );
    expect(htmlWithProposals).toContain("Vikram Malhotra");
    expect(htmlWithProposals).toContain("Malhotra Logistics");
    expect(htmlWithProposals).toContain("₹2.5L");
    expect(htmlWithProposals).toContain("2d ago");

    const htmlEmpty = renderToStaticMarkup(
      <ProposalsAwaitingReply proposals={[]} />
    );
    expect(htmlEmpty).toContain("No leads in proposal stage");
    expect(htmlEmpty).toContain("Leads in Proposal Sent stage will appear here.");
  });

  it("renders Payment to Chase with canonical financial data and empty state when null", () => {
    const htmlWithPayment = renderToStaticMarkup(
      <PaymentToChase payment={mockPayment} />
    );
    expect(htmlWithPayment).toContain("₹1,80,000");
    expect(htmlWithPayment).toContain("Mehta Exports");
    expect(htmlWithPayment).toContain("due 18 Oct");
    expect(htmlWithPayment).toContain("Overdue");

    const htmlEmpty = renderToStaticMarkup(
      <PaymentToChase payment={null} />
    );
    expect(htmlEmpty).toContain("No overdue payments");
    expect(htmlEmpty).toContain("All deal collections and milestones are current.");
  });

  it("renders DailyBriefingWorkspace with empty state when all actions are done", () => {
    const doneActions = mockActions.map((a) => ({ ...a, isDone: true }));
    const html = renderToStaticMarkup(
      <DailyBriefingWorkspace
        initialStats={mockStats}
        initialActions={doneActions}
        initialAiBriefing={mockAiBriefing}
        initialCalls={mockCalls}
        initialProposals={mockProposals}
        initialPayment={mockPayment}
      />
    );
    expect(html).toContain("Nothing urgent today 🎉");
    expect(html).toContain("Reset Checklist");
  });
});
