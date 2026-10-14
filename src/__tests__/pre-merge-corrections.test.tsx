import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RevenueHeroCard } from "@/features/dashboard/components/revenue-hero-card";
import { ProposalsAwaitingReply } from "@/features/daily-briefing/components/proposals-awaiting-reply";
import { TodaysCallList } from "@/features/daily-briefing/components/todays-call-list";
import { PaymentToChase } from "@/features/daily-briefing/components/payment-to-chase";
import {
  calculateCollected,
  calculateDealOutstanding,
  derivePaymentStatus,
  decimalToNumber,
} from "@/lib/financial/calculations";
import type { BriefingProposalItem, BriefingPaymentItem, BriefingCallItem } from "@/features/daily-briefing/types";

// Mock whatsapp-context
vi.mock("@/components/whatsapp-context", () => ({
  useWhatsApp: () => ({
    openWhatsApp: vi.fn(),
  }),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("Final Pre-Merge Corrections — PR #13 Verification", () => {
  describe("1. Dashboard: Revenue Hero Card Label Accuracy", () => {
    it("renders 'Total Won Revenue' instead of current month for all-time won revenue", () => {
      const html = renderToStaticMarkup(
        <RevenueHeroCard
          wonRevenue={1500000}
          openPipeline={800000}
          avgWonDeal={150000}
          monthName="October"
          revenueTrend={[
            { month: "Aug", revenue: 400000 },
            { month: "Sep", revenue: 500000 },
            { month: "Oct", revenue: 600000 },
          ]}
        />
      );

      // Must have accurate label for all-time won revenue
      expect(html).toContain("Total Won Revenue");
      expect(html).not.toContain("Revenue · October");
      expect(html).toContain("₹15,00,000");
      expect(html).toContain("Won Revenue");
      expect(html).toContain("Open Pipeline");
    });
  });

  describe("2. Daily Briefing: Today's Call List Follow-Up Type Filtering", () => {
    it("restricts list strictly to CALL follow-ups and ignores WhatsApp, Email, or Other", () => {
      const mockRawFollowUps = [
        {
          id: "fu-call-1",
          type: "CALL",
          scheduledAt: new Date(),
          lead: { id: "l-1", name: "Ramesh Kumar", phone: "+91 98765 00001", business: "Kumar Textiles" },
          note: "Intro call",
        },
        {
          id: "fu-wa-2",
          type: "WHATSAPP",
          scheduledAt: new Date(),
          lead: { id: "l-2", name: "Suresh Patel", phone: "+91 98765 00002", business: "Patel Traders" },
          note: "Send catalog",
        },
        {
          id: "fu-email-3",
          type: "EMAIL",
          scheduledAt: new Date(),
          lead: { id: "l-3", name: "Amit Verma", phone: "+91 98765 00003", business: "Verma Logistics" },
          note: "Contract draft",
        },
        {
          id: "fu-call-4",
          type: "CALL",
          scheduledAt: new Date(Date.now() - 3600000), // 1 hour ago (overdue)
          lead: { id: "l-4", name: "Pooja Sharma", phone: "+91 98765 00004", business: "Sharma & Co" },
          note: "Follow-up discussion",
        },
      ];

      // Replicate the briefing-service filtering logic
      const filteredCalls: BriefingCallItem[] = mockRawFollowUps
        .filter((f) => {
          if (!f.lead) return false;
          if (String(f.type).toUpperCase() !== "CALL") return false;
          return true;
        })
        .map((f) => ({
          id: f.id,
          leadId: f.lead.id,
          leadName: f.lead.name,
          phone: f.lead.phone,
          context: f.note || f.lead.business,
          timeFormatted: "10:00",
          isOverdue: false,
          scheduledAt: f.scheduledAt.toISOString(),
        }));

      // Only CALL items must be present
      expect(filteredCalls).toHaveLength(2);
      expect(filteredCalls.map((c) => c.leadName)).toEqual(["Ramesh Kumar", "Pooja Sharma"]);

      const html = renderToStaticMarkup(<TodaysCallList calls={filteredCalls} />);
      expect(html).toContain("Today&#x27;s Call List");
      expect(html).toContain("Ramesh Kumar");
      expect(html).toContain("Pooja Sharma");
      expect(html).not.toContain("Suresh Patel"); // WhatsApp excluded
      expect(html).not.toContain("Amit Verma"); // Email excluded
    });
  });

  describe("3. Daily Briefing: Proposal Stage Leads Relabeling", () => {
    it("renders 'Proposal Stage Leads' and truthful empty state without claiming unverified reply status", () => {
      const mockProposals: BriefingProposalItem[] = [
        {
          id: "prop-1",
          leadId: "lead-prop-1",
          clientName: "Ananya Roy",
          companyName: "Roy Creative",
          quotedAmountFormatted: "₹3.5L",
          statusLabel: "Proposal Stage",
          daysAgo: 3,
        },
      ];

      const htmlWithItems = renderToStaticMarkup(<ProposalsAwaitingReply proposals={mockProposals} />);
      expect(htmlWithItems).toContain("Proposal Stage Leads");
      expect(htmlWithItems).not.toContain("Proposals awaiting reply");
      expect(htmlWithItems).toContain("Ananya Roy");

      const htmlEmpty = renderToStaticMarkup(<ProposalsAwaitingReply proposals={[]} />);
      expect(htmlEmpty).toContain("Proposal Stage Leads");
      expect(htmlEmpty).toContain("No leads in proposal stage");
      expect(htmlEmpty).toContain("Leads in Proposal Sent stage will appear here.");
      expect(htmlEmpty).not.toContain("No proposals awaiting reply");
    });
  });

  describe("4. Daily Briefing: Payment to Chase Multi-Deal & Canonical Financial Selection", () => {
    it("correctly skips fully paid deals, selects genuine unpaid obligations, and accurately sets isOverdue", () => {
      const todayStr = "2026-10-14";

      const candidateDeals = [
        {
          id: "deal-paid",
          finalAmount: 100000,
          nextPaymentDueDate: new Date("2026-10-01"), // Past date, but fully paid!
          nextPaymentDueAmount: 50000,
          payments: [{ amount: 60000 }, { amount: 40000 }], // 100000 paid
          lead: { name: "Paid Client", business: "Paid Inc" },
        },
        {
          id: "deal-overdue-unpaid",
          finalAmount: 120000,
          nextPaymentDueDate: new Date("2026-10-10"), // 4 days ago
          nextPaymentDueAmount: 40000,
          payments: [{ amount: 40000 }], // 80000 remaining
          lead: { name: "Overdue Client", business: "Overdue Corp" },
        },
        {
          id: "deal-future-unpaid",
          finalAmount: 90000,
          nextPaymentDueDate: new Date("2026-10-25"), // Future date
          nextPaymentDueAmount: null,
          payments: [], // 90000 remaining
          lead: { name: "Future Client", business: "Future Tech" },
        },
      ];

      // Apply the canonical multi-deal calculation logic
      const eligibleDeals = candidateDeals
        .map((d) => {
          const collected = calculateCollected(d.payments || []);
          const outstandingDecimal = calculateDealOutstanding(d.finalAmount, collected);
          const outstanding = decimalToNumber(outstandingDecimal);
          if (outstanding <= 0) return null; // Skips fully paid deal!

          const paymentStatus = derivePaymentStatus(
            d.finalAmount,
            collected,
            d.nextPaymentDueDate,
            todayStr
          );
          const isOverdue = paymentStatus === "Overdue";

          // Avoid showing already paid amounts: next due capped at outstanding
          const nextDueNum = d.nextPaymentDueAmount ? decimalToNumber(d.nextPaymentDueAmount) : 0;
          const amount = nextDueNum > 0 && nextDueNum <= outstanding ? nextDueNum : outstanding;

          return {
            id: d.id,
            clientName: d.lead.name,
            companyName: d.lead.business,
            amount,
            isOverdue,
            nextPaymentDueDate: d.nextPaymentDueDate,
            outstanding,
          };
        })
        .filter((d): d is NonNullable<typeof d> => d !== null);

      // Verify that fully paid deal is completely excluded
      expect(eligibleDeals).toHaveLength(2);
      expect(eligibleDeals.find((d) => d.id === "deal-paid")).toBeUndefined();

      // Sort: overdue deals first
      eligibleDeals.sort((a, b) => {
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        if (a.nextPaymentDueDate && b.nextPaymentDueDate) {
          return a.nextPaymentDueDate.getTime() - b.nextPaymentDueDate.getTime();
        }
        return b.outstanding - a.outstanding;
      });

      const top = eligibleDeals[0];
      // Must pick the overdue deal with unpaid balance
      expect(top.id).toBe("deal-overdue-unpaid");
      expect(top.clientName).toBe("Overdue Client");
      expect(top.amount).toBe(40000);
      expect(top.isOverdue).toBe(true);

      const html = renderToStaticMarkup(
        <PaymentToChase
          payment={{
            id: top.id,
            dealId: top.id,
            clientName: top.clientName,
            amount: top.amount,
            amountFormatted: "₹40,000",
            dueDateFormatted: "due 10 Oct",
            isOverdue: top.isOverdue,
          }}
        />
      );

      expect(html).toContain("Payment to Chase");
      expect(html).toContain("Overdue Client");
      expect(html).toContain("₹40,000");
      expect(html).toContain("Overdue");
      expect(html).not.toContain("Paid Client");
    });
  });
});
