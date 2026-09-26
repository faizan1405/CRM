import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getDashboardData } from "@/app/actions/dashboard";
import { getAnalyticsData } from "@/app/actions/analytics";
import {
  calculateWonDealValue,
  calculateMoneyReceived,
  calculateDealOutstanding,
  calculateTotalOutstanding,
  calculateCollectionRate,
  getOpportunityValue,
  calculateOpenPipelineValue,
  derivePaymentStatus,
  toDecimal,
  decimalToNumber,
} from "@/lib/financial/calculations";
import {
  buildISTMidnight,
  getTodayIST,
  getDateRangeBoundaries,
} from "@/lib/analytics-helpers";

// ─── Safety Guard ─────────────────────────────────────────────────────────────
// Hard fail if TEST_DATABASE_URL is missing or equals DATABASE_URL
if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL must be defined for running tests.");
}
if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
  throw new Error("FATAL SAFETY CHECK: TEST_DATABASE_URL must not equal DATABASE_URL!");
}

// ─── Auth Mock ─────────────────────────────────────────────────────────────────
const TEST_USER_ID = "test-analytics-unification-user";
vi.mock("@/lib/auth", () => ({
  getSession: async () => ({
    id: TEST_USER_ID,
    email: "analytics-unify@example.com",
    role: "ADMIN",
  }),
}));

describe("Scale Flow CRM: Canonical Financial Analytics Unification", () => {
  const createdLeadIds: string[] = [];
  const createdDealIds: string[] = [];
  const createdPaymentIds: string[] = [];

  beforeAll(async () => {
    // Ensure test user exists for any FK relations
    await db.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        name: "Analytics Unification Tester",
        email: "analytics-unify@example.com",
        passwordHash: "dummyhash",
        role: "ADMIN",
      },
    }).catch(() => {});
  });

  afterAll(async () => {
    // Clean up created test data in reverse FK order
    if (createdPaymentIds.length > 0) {
      await db.payment.deleteMany({ where: { id: { in: createdPaymentIds } } }).catch(() => {});
    }
    if (createdDealIds.length > 0) {
      await db.deal.deleteMany({ where: { id: { in: createdDealIds } } }).catch(() => {});
    }
    if (createdLeadIds.length > 0) {
      await db.followUp.deleteMany({ where: { leadId: { in: createdLeadIds } } }).catch(() => {});
      await db.leadActivity.deleteMany({ where: { leadId: { in: createdLeadIds } } }).catch(() => {});
      await db.leadAIInsight.deleteMany({ where: { leadId: { in: createdLeadIds } } }).catch(() => {});
      await db.lead.deleteMany({ where: { id: { in: createdLeadIds } } }).catch(() => {});
    }
  });

  // ----------------------------------------------------------------------------
  // 1. WON Lead with finalAmount 100,000 and payments 30,000
  // ----------------------------------------------------------------------------
  it("Requirement 1: WON Lead with finalAmount 100,000 and payments 30,000 yields Won Deal Value = 100000, Money Received = 30000, Outstanding = 70000", () => {
    const leads = [
      {
        id: "lead-1",
        status: "WON",
        quotedAmount: 120000, // Quote must be ignored
        deal: { finalAmount: 100000 },
      },
    ];
    const payments = [
      { id: "pay-1", dealId: "deal-1", amount: 30000 },
    ];
    const deals = [
      { id: "deal-1", finalAmount: 100000, payments },
    ];

    const wonDealValue = decimalToNumber(calculateWonDealValue(leads));
    const moneyReceived = decimalToNumber(calculateMoneyReceived(payments));
    const outstanding = decimalToNumber(calculateTotalOutstanding(deals));
    const collectionRate = decimalToNumber(calculateCollectionRate(moneyReceived, wonDealValue));

    expect(wonDealValue).toBe(100000);
    expect(moneyReceived).toBe(30000);
    expect(outstanding).toBe(70000);
    expect(collectionRate).toBe(30);
  });

  // ----------------------------------------------------------------------------
  // 2. WON Lead with quote different from finalAmount (quote 50,000, final 80,000)
  // ----------------------------------------------------------------------------
  it("Requirement 2: WON Lead with quotedAmount = 50000 and finalAmount = 80000 yields Won Deal Value = 80000 (NOT 50000)", () => {
    const leads = [
      {
        id: "lead-2",
        status: "WON",
        quotedAmount: 50000,
        deal: { finalAmount: 80000 },
      },
    ];

    const wonDealValue = decimalToNumber(calculateWonDealValue(leads));
    expect(wonDealValue).toBe(80000);
    expect(wonDealValue).not.toBe(50000);
  });

  // ----------------------------------------------------------------------------
  // 3. Active opportunity: quotedAmount = 40,000, no Deal
  // ----------------------------------------------------------------------------
  it("Requirement 3: Active opportunity with quotedAmount = 40000 and no Deal contributes 40000 to Open Pipeline", () => {
    const lead = {
      status: "QUALIFIED",
      quotedAmount: 40000,
      deal: null,
    };

    const contribution = decimalToNumber(getOpportunityValue(lead, null));
    expect(contribution).toBe(40000);
  });

  // ----------------------------------------------------------------------------
  // 4. Active opportunity: quotedAmount = 40,000, Deal.finalAmount = 55,000
  // ----------------------------------------------------------------------------
  it("Requirement 4: Active opportunity with quotedAmount = 40000 and Deal.finalAmount = 55000 contributes 55000 to Open Pipeline (Deal takes precedence)", () => {
    const lead = {
      status: "PROPOSAL_SENT",
      quotedAmount: 40000,
      deal: { finalAmount: 55000 },
    };

    const contribution = decimalToNumber(getOpportunityValue(lead, lead.deal));
    expect(contribution).toBe(55000);
  });

  // ----------------------------------------------------------------------------
  // 5. LOST Lead excluded from Open Pipeline
  // ----------------------------------------------------------------------------
  it("Requirement 5: LOST Lead is excluded from Open Pipeline (contributes 0)", () => {
    const lostLead = {
      status: "LOST",
      quotedAmount: 90000,
      deal: { finalAmount: 85000 },
    };

    const contribution = decimalToNumber(getOpportunityValue(lostLead, lostLead.deal));
    expect(contribution).toBe(0);
  });

  // ----------------------------------------------------------------------------
  // 6. Waste Lead excluded
  // ----------------------------------------------------------------------------
  it("Requirement 6: Waste Lead is excluded from both Won Deal Value and Open Pipeline", () => {
    const wasteWonLead = {
      status: "WON",
      isWaste: true,
      deal: { finalAmount: 100000 },
    };
    const wasteOpenLead = {
      status: "QUALIFIED",
      isWaste: true,
      quotedAmount: 50000,
      deal: { finalAmount: 50000 },
    };

    expect(decimalToNumber(calculateWonDealValue([wasteWonLead]))).toBe(0);
    expect(decimalToNumber(getOpportunityValue(wasteOpenLead, wasteOpenLead.deal))).toBe(0);
  });

  // ----------------------------------------------------------------------------
  // 7. Deleted Lead excluded
  // ----------------------------------------------------------------------------
  it("Requirement 7: Soft-deleted Lead (deletedAt != null) is excluded", () => {
    const deletedLead = {
      status: "QUALIFIED",
      deletedAt: new Date(),
      quotedAmount: 60000,
      deal: { finalAmount: 60000 },
    };

    expect(decimalToNumber(getOpportunityValue(deletedLead, deletedLead.deal))).toBe(0);
  });

  // ----------------------------------------------------------------------------
  // 8. Merged Lead excluded
  // ----------------------------------------------------------------------------
  it("Requirement 8: Merged Lead (mergedIntoLeadId != null) is excluded", () => {
    const mergedLead = {
      status: "PROPOSAL_SENT",
      mergedIntoLeadId: "canonical-lead-id",
      quotedAmount: 75000,
      deal: { finalAmount: 75000 },
    };

    expect(decimalToNumber(getOpportunityValue(mergedLead, mergedLead.deal))).toBe(0);
  });

  // ----------------------------------------------------------------------------
  // 9. Soft-deleted Payment excluded from collected
  // ----------------------------------------------------------------------------
  it("Requirement 9: Soft-deleted Payment (deletedAt != null) is excluded from Money Received", () => {
    const payments = [
      { id: "p1", amount: 25000, deletedAt: null },
      { id: "p2", amount: 15000, deletedAt: new Date() }, // should be ignored
    ];

    const moneyReceived = decimalToNumber(calculateMoneyReceived(payments));
    expect(moneyReceived).toBe(25000);
  });

  // ----------------------------------------------------------------------------
  // 10. Overpayment: finalAmount = 50,000, payments = 60,000 -> Outstanding = 0
  // ----------------------------------------------------------------------------
  it("Requirement 10: Overpayment does not produce negative outstanding (caps at 0)", () => {
    const deals = [
      {
        id: "deal-overpaid",
        finalAmount: 50000,
        payments: [{ id: "p-over", amount: 60000 }],
      },
    ];

    const outstanding = decimalToNumber(calculateTotalOutstanding(deals));
    expect(outstanding).toBe(0);
  });

  // ----------------------------------------------------------------------------
  // 11. Zero contracted amount: Collection Rate = 0
  // ----------------------------------------------------------------------------
  it("Requirement 11: Zero contracted amount returns Collection Rate = 0 (no NaN/Infinity)", () => {
    const rate1 = decimalToNumber(calculateCollectionRate(0, 0));
    const rate2 = decimalToNumber(calculateCollectionRate(10000, 0));
    const rate3 = decimalToNumber(calculateCollectionRate(0, -5000));

    expect(rate1).toBe(0);
    expect(rate2).toBe(0);
    expect(rate3).toBe(0);
    expect(Number.isNaN(rate1)).toBe(false);
    expect(Number.isFinite(rate1)).toBe(true);
  });

  // ----------------------------------------------------------------------------
  // 12. Decimal precision (no floating-point drift)
  // ----------------------------------------------------------------------------
  it("Requirement 12: Decimal precision prevents floating point drift across multiple increments", () => {
    // 0.1 + 0.2 in JS float arithmetic is 0.30000000000000004
    const d1 = toDecimal(0.1);
    const d2 = toDecimal(0.2);
    const sum = d1.add(d2);
    expect(sum.toString()).toBe("0.3");

    // Multiple fractional payments sum cleanly
    const fractionalPayments = [
      { amount: 1000.1 },
      { amount: 2000.2 },
      { amount: 3000.3 },
    ];
    const total = calculateMoneyReceived(fractionalPayments);
    expect(total.toString()).toBe("6000.6");
  });

  // ----------------------------------------------------------------------------
  // 13. Dashboard metric == Analytics metric for same fixture
  // ----------------------------------------------------------------------------
  it("Requirement 13: Dashboard and Analytics calculate identical Won Deal Value and Open Pipeline Value", async () => {
    // Create an isolated WON lead with a confirmed Deal
    const wonLead = await db.lead.create({
      data: {
        name: `Reconciliation Won Lead ${Date.now()}`,
        phone: `+91 91111 ${Math.floor(10000 + Math.random() * 90000)}`,
        status: "WON",
        quotedAmount: 45000, // Quote differs from finalAmount
      },
    });
    createdLeadIds.push(wonLead.id);

    const wonDeal = await db.deal.create({
      data: {
        source: "CRM_LEAD",
        leadId: wonLead.id,
        finalAmount: 75000, // Canonical Won Deal Value
        status: "CONFIRMED",
      },
    });
    createdDealIds.push(wonDeal.id);

    // Create an active NEW lead with quotedAmount
    const openLead = await db.lead.create({
      data: {
        name: `Reconciliation Open Lead ${Date.now()}`,
        phone: `+91 92222 ${Math.floor(10000 + Math.random() * 90000)}`,
        status: "NEW",
        quotedAmount: 35000,
      },
    });
    createdLeadIds.push(openLead.id);

    // Fetch both Dashboard and Analytics data
    const dashboardResult = await getDashboardData();
    const analyticsResult = await getAnalyticsData("all");

    expect(dashboardResult.success).toBe(true);
    expect(analyticsResult.success).toBe(true);

    if (dashboardResult.success && analyticsResult.success && dashboardResult.data) {
      const dbWon = dashboardResult.data.revenue.won;
      const anWon = analyticsResult.data.coreMetrics.wonRevenue;
      expect(dbWon).toBe(anWon);

      const dbOpen = dashboardResult.data.revenue.openPipeline;
      const anOpen = analyticsResult.data.coreMetrics.openPipelineValue;
      expect(dbOpen).toBe(anOpen);
    }
  });

  // ----------------------------------------------------------------------------
  // 14. IST Date Boundary Tests (Asia/Kolkata)
  // ----------------------------------------------------------------------------
  describe("Requirement 14: IST Date Boundary Calculations", () => {
    it("computes midnight IST correctly in UTC without drift", () => {
      // Midnight IST on 2026-09-26 is 2026-09-25 18:30:00 UTC (IST = UTC + 5:30)
      const midnight = buildISTMidnight(2026, 9, 26);
      expect(midnight.toISOString()).toBe("2026-09-25T18:30:00.000Z");

      // Verify that formatting this UTC Date in Asia/Kolkata yields 00:00:00 on Sep 26
      const istHours = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      }).format(midnight);
      expect(["00:00", "24:00"]).toContain(istHours);
    });

    it("ensures date range boundaries use start = 00:00:00 IST and exclusive next-day boundary", () => {
      // Mock reference time: 2026-09-26 at 15:00:00 IST
      const refDate = new Date("2026-09-26T09:30:00.000Z"); // 09:30 UTC = 15:00 IST

      const { start, end } = getDateRangeBoundaries("7d", refDate);
      expect(start).not.toBeNull();
      expect(end).not.toBeNull();

      if (start) {
        // 7 days ending Sep 26 is Sep 20 to Sep 26 inclusive
        // start should be Sep 20 00:00:00 IST = Sep 19 18:30:00 UTC
        expect(start.toISOString()).toBe("2026-09-19T18:30:00.000Z");
      }
    });

    it("correctly identifies payment statuses based on IST today", () => {
      // Today is 2026-09-26
      const today = "2026-09-26";

      // Due yesterday with remaining balance -> Overdue
      const statusOverdue = derivePaymentStatus(10000, 5000, "2026-09-25", today);
      expect(statusOverdue).toBe("Overdue");

      // Due today with remaining balance -> Partially Paid (not overdue yet)
      const statusToday = derivePaymentStatus(10000, 5000, "2026-09-26", today);
      expect(statusToday).toBe("Partially Paid");

      // Fully paid -> Paid
      const statusPaid = derivePaymentStatus(10000, 10000, "2026-09-20", today);
      expect(statusPaid).toBe("Paid");

      // No payments made, not overdue -> Unpaid
      const statusUnpaid = derivePaymentStatus(10000, 0, "2026-09-28", today);
      expect(statusUnpaid).toBe("Unpaid");
    });
  });
});
