import { describe, it, expect } from "vitest";
import {
  calculateTotalReceived,
  calculateRemainingBalance,
  derivePaymentStatus,
  calculateDealMetrics,
  isDueDatePassed,
} from "@/features/deals/calculations";
import { crmNavigation } from "@/components/crm-navigation";

describe("CRM Target Verification: Settings Navigation Cleanup", () => {
  it("removes Notifications, Sales Assets, Guide, and Recently Deleted from main CRM navigation", () => {
    const labels = crmNavigation.map((i) => i.label);
    const hrefs = crmNavigation.map((i) => i.href);

    expect(labels).not.toContain("Notifications");
    expect(labels).not.toContain("Sales Assets");
    expect(labels).not.toContain("Guide");
    expect(labels).not.toContain("Recently Deleted");

    expect(hrefs).not.toContain("/notifications");
    expect(hrefs).not.toContain("/sales-assets");
    expect(hrefs).not.toContain("/guide");
    expect(hrefs).not.toContain("/recently-deleted");
  });

  it("includes Deals & Payments in main CRM navigation for daily sales workflow", () => {
    const dealsNav = crmNavigation.find((i) => i.href === "/deals");
    expect(dealsNav).toBeDefined();
    expect(dealsNav?.label).toBe("Deals & Payments");
  });
});

describe("CRM Target Verification: Deal + Payment Tracker", () => {
  it("Scenario 1: Deal Value ₹30,000 with Payment 1 (₹9,000) + Payment 2 (₹10,000)", () => {
    const dealValue = 30000;
    const payments = [{ amount: 9000 }, { amount: 10000 }];

    const received = calculateTotalReceived(payments);
    const remaining = calculateRemainingBalance(dealValue, received);
    const status = derivePaymentStatus(dealValue, received, null);

    expect(received).toBe(19000);
    expect(remaining).toBe(11000);
    expect(status).toBe("Partially Paid");
  });

  it("Scenario 2: Adding final payment ₹11,000 clears remaining and marks Paid", () => {
    const dealValue = 30000;
    const payments = [{ amount: 9000 }, { amount: 10000 }, { amount: 11000 }];

    const received = calculateTotalReceived(payments);
    const remaining = calculateRemainingBalance(dealValue, received);
    const status = derivePaymentStatus(dealValue, received, null);

    expect(received).toBe(30000);
    expect(remaining).toBe(0);
    expect(status).toBe("Paid");
  });

  it("Scenario 3: Editing a payment recalculates totals and remaining balance", () => {
    const dealValue = 30000;
    // Edited payment 1 from 9,000 to 5,000
    const payments = [{ amount: 5000 }, { amount: 10000 }];

    const received = calculateTotalReceived(payments);
    const remaining = calculateRemainingBalance(dealValue, received);
    const status = derivePaymentStatus(dealValue, received, null);

    expect(received).toBe(15000);
    expect(remaining).toBe(15000);
    expect(status).toBe("Partially Paid");
  });

  it("Scenario 4: Deleting a payment recalculates totals and remaining balance", () => {
    const dealValue = 30000;
    // Deleted payment 2 (10,000), leaving only payment 1 (5,000)
    const payments = [{ amount: 5000 }];

    const received = calculateTotalReceived(payments);
    const remaining = calculateRemainingBalance(dealValue, received);
    const status = derivePaymentStatus(dealValue, received, null);

    expect(received).toBe(5000);
    expect(remaining).toBe(25000);
    expect(status).toBe("Partially Paid");
  });

  it("Scenario 5: Overdue status triggers when due date has passed and balance is outstanding", () => {
    const dealValue = 30000;
    const payments = [{ amount: 9000 }];
    const pastDueDate = "2020-01-01"; // definitely in the past

    const received = calculateTotalReceived(payments);
    const status = derivePaymentStatus(dealValue, received, pastDueDate);

    expect(status).toBe("Overdue");
  });

  it("Scenario 6: Overdue status does NOT trigger if deal is already fully paid", () => {
    const dealValue = 30000;
    const payments = [{ amount: 30000 }];
    const pastDueDate = "2020-01-01";

    const received = calculateTotalReceived(payments);
    const status = derivePaymentStatus(dealValue, received, pastDueDate);

    expect(status).toBe("Paid");
  });

  it("Scenario 7: Unpaid status when no payments have been recorded and not overdue", () => {
    const dealValue = 30000;
    const payments: Array<{ amount: number }> = [];
    const futureDueDate = "2099-12-31";

    const received = calculateTotalReceived(payments);
    const status = derivePaymentStatus(dealValue, received, futureDueDate);

    expect(status).toBe("Unpaid");
  });

  it("Scenario 8: Summary metrics correctly sum deal values, received, outstanding, and overdue amounts", () => {
    const deals = [
      {
        finalAmount: 100000,
        totalReceived: 60000,
        remainingBalance: 40000,
        paymentStatus: "Partially Paid" as const,
      },
      {
        finalAmount: 50000,
        totalReceived: 50000,
        remainingBalance: 0,
        paymentStatus: "Paid" as const,
      },
      {
        finalAmount: 40000,
        totalReceived: 10000,
        remainingBalance: 30000,
        paymentStatus: "Overdue" as const,
      },
    ];

    const metrics = calculateDealMetrics(deals);

    expect(metrics.totalDealValue).toBe(190000);
    expect(metrics.totalReceived).toBe(120000);
    expect(metrics.totalOutstanding).toBe(70000);
    expect(metrics.overdueAmount).toBe(30000);
    expect(metrics.totalDealsCount).toBe(3);
  });
});
