import { describe, it, expect } from "vitest";
import {
  calculateTotalReceived,
  calculateRemainingBalance,
  calculateCollectionRate,
  derivePaymentStatus,
  calculateDealMetrics,
  calculateDealsAnalytics,
  isDueDatePassed,
  getDaysOverdue,
  getDaysUntilDue,
} from "@/features/deals/calculations";
import type { SerializedDeal } from "@/features/deals/types";

describe("Deals & Payments Analytics: Targeted Specifications", () => {
  // Reference date: 2026-09-18
  const todayIST = "2026-09-18";

  /**
   * Target dataset:
   * Deal A: ₹30,000, Received ₹20,000 (partially paid, not overdue)
   * Deal B: ₹50,000, Received ₹50,000 (fully paid)
   * Deal C: ₹40,000, Received ₹10,000, Overdue ₹30,000 (overdue)
   */
  const dealA: SerializedDeal = {
    id: "deal-a",
    source: "CRM_LEAD",
    leadId: "lead-a",
    quotedAmount: 30000,
    finalAmount: 30000,
    currency: "INR",
    status: "CONFIRMED",
    nextPaymentDueDate: "2026-09-25", // upcoming
    nextPaymentDueAmount: 10000,
    payments: [
      {
        id: "pay-a1",
        dealId: "deal-a",
        amount: 20000,
        paymentDate: "2026-09-10",
        type: "PARTIAL",
        method: "UPI",
        createdAt: "2026-09-10T10:00:00Z",
        updatedAt: "2026-09-10T10:00:00Z",
      },
    ],
    createdAt: "2026-09-01T10:00:00Z",
    updatedAt: "2026-09-10T10:00:00Z",
    totalReceived: 20000,
    remainingBalance: 10000,
    paymentStatus: "Partially Paid",
    lead: {
      id: "lead-a",
      name: "Maxwell",
      business: "Maxwell Corp",
      phone: "+91 9876543210",
      status: "Won",
    },
  };

  const dealB: SerializedDeal = {
    id: "deal-b",
    source: "OTHER_CLIENT",
    leadId: null,
    clientNameSnapshot: "Client B",
    companyNameSnapshot: "Tech Solutions",
    quotedAmount: 50000,
    finalAmount: 50000,
    currency: "INR",
    status: "COMPLETED",
    nextPaymentDueDate: null,
    nextPaymentDueAmount: null,
    payments: [
      {
        id: "pay-b1",
        dealId: "deal-b",
        amount: 50000,
        paymentDate: "2026-09-12",
        type: "FINAL",
        method: "BANK_TRANSFER",
        createdAt: "2026-09-12T11:00:00Z",
        updatedAt: "2026-09-12T11:00:00Z",
      },
    ],
    createdAt: "2026-09-02T10:00:00Z",
    updatedAt: "2026-09-12T11:00:00Z",
    totalReceived: 50000,
    remainingBalance: 0,
    paymentStatus: "Paid",
    lead: null,
  };

  const dealC: SerializedDeal = {
    id: "deal-c",
    source: "CRM_LEAD",
    leadId: "lead-c",
    quotedAmount: 40000,
    finalAmount: 40000,
    currency: "INR",
    status: "CONFIRMED",
    nextPaymentDueDate: "2026-09-15", // 3 days overdue relative to 2026-09-18
    nextPaymentDueAmount: 30000,
    payments: [
      {
        id: "pay-c1",
        dealId: "deal-c",
        amount: 10000,
        paymentDate: "2026-09-05",
        type: "ADVANCE",
        method: "UPI",
        createdAt: "2026-09-05T10:00:00Z",
        updatedAt: "2026-09-05T10:00:00Z",
      },
    ],
    createdAt: "2026-09-03T10:00:00Z",
    updatedAt: "2026-09-05T10:00:00Z",
    totalReceived: 10000,
    remainingBalance: 30000,
    paymentStatus: "Overdue",
    lead: {
      id: "lead-c",
      name: "Client C Enterprise",
      business: "C Enterprise Ltd",
      phone: "+91 9123456780",
      status: "Won",
    },
  };

  const testDeals = [dealA, dealB, dealC];

  it("calculates exact user-requested target financial values", () => {
    const analytics = calculateDealsAnalytics(testDeals, "all_time", todayIST);

    // Expected:
    // Total Deal Value = ₹1,20,000
    // Received = ₹80,000
    // Outstanding = ₹40,000
    // Overdue = ₹30,000
    // Collection Rate = 66.67%
    expect(analytics.totalDealValue).toBe(120000);
    expect(analytics.totalReceived).toBe(80000);
    expect(analytics.totalOutstanding).toBe(40000);
    expect(analytics.overdueAmount).toBe(30000);
    expect(analytics.collectionRate).toBe(66.67);
  });

  it("calculates deal status breakdown accurately", () => {
    const analytics = calculateDealsAnalytics(testDeals, "all_time", todayIST);

    expect(analytics.totalDealsCount).toBe(3);
    expect(analytics.paidDealsCount).toBe(1); // Deal B
    expect(analytics.partiallyPaidDealsCount).toBe(1); // Deal A
    expect(analytics.unpaidDealsCount).toBe(0);
    expect(analytics.overdueDealsCount).toBe(1); // Deal C
  });

  it("calculates outstanding breakdown (Total, Overdue, Upcoming)", () => {
    const analytics = calculateDealsAnalytics(testDeals, "all_time", todayIST);

    // Total = 40,000, Overdue = 30,000, Upcoming = 10,000
    expect(analytics.totalOutstanding).toBe(40000);
    expect(analytics.overdueAmount).toBe(30000);
    expect(analytics.upcomingOutstanding).toBe(10000);
  });

  it("returns upcoming payments sorted by nearest due date", () => {
    const analytics = calculateDealsAnalytics(testDeals, "all_time", todayIST);

    expect(analytics.upcomingPayments.length).toBe(1);
    const upcoming = analytics.upcomingPayments[0];
    expect(upcoming.clientName).toBe("Maxwell");
    expect(upcoming.amountDue).toBe(10000);
    expect(upcoming.dueDate).toBe("2026-09-25");
    expect(upcoming.daysRemaining).toBe(7);
  });

  it("returns overdue payments with days overdue calculation", () => {
    const analytics = calculateDealsAnalytics(testDeals, "all_time", todayIST);

    expect(analytics.overduePayments.length).toBe(1);
    const overdue = analytics.overduePayments[0];
    expect(overdue.clientName).toBe("Client C Enterprise");
    expect(overdue.outstandingAmount).toBe(30000);
    expect(overdue.dueDate).toBe("2026-09-15");
    expect(overdue.daysOverdue).toBe(3); // 2026-09-18 vs 2026-09-15
  });

  it("aggregates payment methods accurately", () => {
    const analytics = calculateDealsAnalytics(testDeals, "all_time", todayIST);

    // UPI: pay-a1 (20,000) + pay-c1 (10,000) = 30,000
    // Bank Transfer: pay-b1 (50,000) = 50,000
    // Total received = 80,000
    expect(analytics.paymentMethodsBreakdown.UPI.amount).toBe(30000);
    expect(analytics.paymentMethodsBreakdown.UPI.percentage).toBe(37.5);
    expect(analytics.paymentMethodsBreakdown.BANK_TRANSFER.amount).toBe(50000);
    expect(analytics.paymentMethodsBreakdown.BANK_TRANSFER.percentage).toBe(62.5);
    expect(analytics.paymentMethodsBreakdown.CASH.amount).toBe(0);
  });

  it("calculates CRM vs Other clients comparison on All Deals", () => {
    const analytics = calculateDealsAnalytics(testDeals, "all_time", todayIST);

    // CRM Deals: Deal A (30k, rec 20k, out 10k) + Deal C (40k, rec 10k, out 30k)
    // CRM Total: Deal Value = 70,000, Received = 30,000, Outstanding = 40,000
    expect(analytics.crmClients.dealValue).toBe(70000);
    expect(analytics.crmClients.received).toBe(30000);
    expect(analytics.crmClients.outstanding).toBe(40000);
    expect(analytics.crmClients.dealsCount).toBe(2);
    expect(analytics.crmClients.collectionRate).toBe(42.86);

    // Other Deals: Deal B (50k, rec 50k, out 0)
    expect(analytics.otherClients.dealValue).toBe(50000);
    expect(analytics.otherClients.received).toBe(50000);
    expect(analytics.otherClients.outstanding).toBe(0);
    expect(analytics.otherClients.dealsCount).toBe(1);
    expect(analytics.otherClients.collectionRate).toBe(100);
  });

  it("ranks top clients accurately by Deal Value, Received, and Outstanding", () => {
    const analytics = calculateDealsAnalytics(testDeals, "all_time", todayIST);

    // By Deal Value: Client B (50k) > Client C (40k) > Maxwell (30k)
    expect(analytics.topByDealValue[0].clientName).toBe("Client B");
    expect(analytics.topByDealValue[0].totalDealValue).toBe(50000);

    // By Received: Client B (50k) > Maxwell (20k) > Client C (10k)
    expect(analytics.topByReceived[0].clientName).toBe("Client B");
    expect(analytics.topByReceived[0].totalReceived).toBe(50000);
    expect(analytics.topByReceived[1].clientName).toBe("Maxwell");
    expect(analytics.topByReceived[1].totalReceived).toBe(20000);

    // By Outstanding: Client C (30k) > Maxwell (10k) > Client B (0)
    expect(analytics.topByOutstanding[0].clientName).toBe("Client C Enterprise");
    expect(analytics.topByOutstanding[0].totalOutstanding).toBe(30000);
  });

  it("produces correct payment trends (daily, weekly, monthly) using real payment dates", () => {
    const analytics = calculateDealsAnalytics(testDeals, "all_time", todayIST);

    // 3 payments: 2026-09-05 (10,000), 2026-09-10 (20,000), 2026-09-12 (50,000)
    expect(analytics.dailyTrend.length).toBe(3);
    expect(analytics.dailyTrend.reduce((sum, d) => sum + d.amount, 0)).toBe(80000);

    // All 3 in Sep 2026
    expect(analytics.monthlyTrend.length).toBe(1);
    expect(analytics.monthlyTrend[0].amount).toBe(80000);
  });

  it("correctly scopes analytics when tab is filtered to CRM Clients or Other Clients", () => {
    // CRM Clients only
    const crmOnly = testDeals.filter((d) => d.source === "CRM_LEAD");
    const crmAnalytics = calculateDealsAnalytics(crmOnly, "all_time", todayIST);

    expect(crmAnalytics.totalDealValue).toBe(70000);
    expect(crmAnalytics.totalReceived).toBe(30000);
    expect(crmAnalytics.totalOutstanding).toBe(40000);
    expect(crmAnalytics.overdueAmount).toBe(30000);
    expect(crmAnalytics.collectionRate).toBe(42.86);

    // Other Clients only
    const otherOnly = testDeals.filter((d) => d.source === "OTHER_CLIENT");
    const otherAnalytics = calculateDealsAnalytics(otherOnly, "all_time", todayIST);

    expect(otherAnalytics.totalDealValue).toBe(50000);
    expect(otherAnalytics.totalReceived).toBe(50000);
    expect(otherAnalytics.totalOutstanding).toBe(0);
    expect(otherAnalytics.overdueAmount).toBe(0);
    expect(otherAnalytics.collectionRate).toBe(100);
  });

  it("handles IST date calculations for overdue and upcoming correctly", () => {
    // Due yesterday: overdue
    expect(isDueDatePassed("2026-09-17", "2026-09-18")).toBe(true);
    expect(getDaysOverdue("2026-09-17", "2026-09-18")).toBe(1);

    // Due today: not overdue yet
    expect(isDueDatePassed("2026-09-18", "2026-09-18")).toBe(false);
    expect(getDaysOverdue("2026-09-18", "2026-09-18")).toBe(0);
    expect(getDaysUntilDue("2026-09-18", "2026-09-18")).toBe(0);

    // Due tomorrow: upcoming
    expect(isDueDatePassed("2026-09-19", "2026-09-18")).toBe(false);
    expect(getDaysOverdue("2026-09-19", "2026-09-18")).toBe(0);
    expect(getDaysUntilDue("2026-09-19", "2026-09-18")).toBe(1);
  });

  it("supports time filters (This Month, Last Month, Last 30 Days, This Year)", () => {
    // "this_month" with reference date 2026-09-18
    const thisMonthAnalytics = calculateDealsAnalytics(testDeals, "this_month", todayIST);
    // All 3 test deals were created in Sep 2026 and payments occurred in Sep 2026
    expect(thisMonthAnalytics.totalReceived).toBe(80000);
    expect(thisMonthAnalytics.totalDealValue).toBe(120000);

    // "last_month" (August 2026) -> no payments were made in August 2026 in this dataset
    const lastMonthAnalytics = calculateDealsAnalytics(testDeals, "last_month", todayIST);
    expect(lastMonthAnalytics.totalReceived).toBe(0);
    expect(lastMonthAnalytics.totalDealValue).toBe(0);
  });
});

