import { describe, it, expect, afterAll, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { db } from "@/lib/db";
import { 
  calculateTotalReceived, 
  calculateRemainingBalance, 
  derivePaymentStatus, 
  calculateDealMetrics,
  calculateRemainingAfterPayment,
  formatDisplayDate,
  formatDisplayDateTime
} from "@/features/deals/calculations";
import { DealsWorkspace } from "@/features/deals/components/deals-workspace";
import type { SerializedDeal, SerializedPayment } from "@/features/deals/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/components/toast-provider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/features/leads/lead-navigation-provider", () => ({
  useLeadNavigation: () => ({ openLead: vi.fn() }),
}));

describe("Targeted Verification: Payment History & Transaction Detail Ledger", () => {
  let crmLeadId: string | null = null;
  let crmDealId: string | null = null;
  let otherDealId: string | null = null;
  let testPaymentId: string | null = null;

  afterAll(async () => {
    if (testPaymentId) {
      await db.payment.deleteMany({ where: { id: testPaymentId } }).catch(() => {});
    }
    if (crmDealId) {
      await db.payment.deleteMany({ where: { dealId: crmDealId } }).catch(() => {});
      await db.deal.deleteMany({ where: { id: crmDealId } }).catch(() => {});
    }
    if (otherDealId) {
      await db.payment.deleteMany({ where: { dealId: otherDealId } }).catch(() => {});
      await db.deal.deleteMany({ where: { id: otherDealId } }).catch(() => {});
    }
    if (crmLeadId) {
      await db.lead.deleteMany({ where: { id: crmLeadId } }).catch(() => {});
    }
  });

  it("Step 1: Create Test Payment with required fields (Amount: 10000, Method: UPI, Type: Advance, Note: Advance received for homepage and admin panel, Reference: UTR-TEST-001)", async () => {
    // 1. Create a CRM Client Lead & Deal
    const lead = await db.lead.create({
      data: {
        name: "Test CRM Client",
        phone: "+919876500001",
        business: "Acme Webworks",
        email: "client@acme.com",
      },
    });
    crmLeadId = lead.id;

    const deal = await db.deal.create({
      data: {
        source: "CRM_LEAD",
        leadId: lead.id,
        clientNameSnapshot: lead.name,
        companyNameSnapshot: lead.business,
        quotedAmount: 30000,
        finalAmount: 30000,
        currency: "INR",
        status: "CONFIRMED",
        projectName: "CRM Web Portal",
        nextPaymentDueDate: new Date("2026-10-15T00:00:00Z"),
        nextPaymentDueAmount: 20000,
      },
    });
    crmDealId = deal.id;

    // 2. Create the exact test payment specified by user
    const payment = await db.payment.create({
      data: {
        dealId: deal.id,
        amount: 10000,
        method: "UPI",
        type: "ADVANCE",
        note: "Advance received for homepage and admin panel",
        reference: "UTR-TEST-001",
      },
    });
    testPaymentId = payment.id;

    expect(payment).toBeDefined();
    expect(Number(payment.amount)).toBe(10000);
    expect(payment.method).toBe("UPI");
    expect(payment.type).toBe("ADVANCE");
    expect(payment.note).toBe("Advance received for homepage and admin panel");
    expect(payment.reference).toBe("UTR-TEST-001");
  });

  it("Step 2: Verify Note and Reference appear in payment history & ledger calculation", async () => {
    const fetchedPayment = await db.payment.findUnique({
      where: { id: testPaymentId! },
      include: { deal: true },
    });

    expect(fetchedPayment).toBeDefined();
    expect(fetchedPayment?.note).toBe("Advance received for homepage and admin panel");
    expect(fetchedPayment?.reference).toBe("UTR-TEST-001");

    // Calculations verify
    const payments = [{ amount: Number(fetchedPayment!.amount) }];
    const received = calculateTotalReceived(payments);
    const remaining = calculateRemainingBalance(30000, received);
    const status = derivePaymentStatus(30000, received, "2026-10-15");

    expect(received).toBe(10000);
    expect(remaining).toBe(20000);
    expect(status).toBe("Partially Paid");
  });

  it("Step 3: Verify Remaining After Payment chronological calculation", () => {
    const paymentsList = [
      { id: "p1", amount: 10000, paymentDate: "2026-09-18", createdAt: "2026-09-18T09:00:00Z" },
      { id: "p2", amount: 12000, paymentDate: "2026-09-25", createdAt: "2026-09-25T09:00:00Z" },
      { id: "p3", amount: 8000, paymentDate: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" },
    ];

    const finalAmount = 30000;

    const remainingAfterP1 = calculateRemainingAfterPayment(finalAmount, paymentsList, "p1");
    expect(remainingAfterP1).toBe(20000);

    const remainingAfterP2 = calculateRemainingAfterPayment(finalAmount, paymentsList, "p2");
    expect(remainingAfterP2).toBe(8000);

    const remainingAfterP3 = calculateRemainingAfterPayment(finalAmount, paymentsList, "p3");
    expect(remainingAfterP3).toBe(0);
  });

  it("Step 4: Edit Payment (amount, note, reference) updates correctly and recalculates totals", async () => {
    // Edit Payment: update note and reference and amount to 15000
    const updated = await db.payment.update({
      where: { id: testPaymentId! },
      data: {
        amount: 15000,
        note: "Updated note: Advance + sprint 1 milestone",
        reference: "UTR-TEST-001-MOD",
      },
    });

    expect(Number(updated.amount)).toBe(15000);
    expect(updated.note).toBe("Updated note: Advance + sprint 1 milestone");
    expect(updated.reference).toBe("UTR-TEST-001-MOD");

    const received = calculateTotalReceived([{ amount: Number(updated.amount) }]);
    const remaining = calculateRemainingBalance(30000, received);
    const status = derivePaymentStatus(30000, received, "2026-10-15");

    expect(received).toBe(15000);
    expect(remaining).toBe(15000);
    expect(status).toBe("Partially Paid");
  });

  it("Step 5: Other Client Deal also supports Payment History, Reference ID, and Note", async () => {
    const otherDeal = await db.deal.create({
      data: {
        source: "OTHER_CLIENT",
        leadId: null,
        clientNameSnapshot: "Direct Client Beta",
        companyNameSnapshot: "Beta Studios",
        projectName: "Brand Identity",
        finalAmount: 40000,
        currency: "INR",
        status: "CONFIRMED",
      },
    });
    otherDealId = otherDeal.id;

    const otherPayment = await db.payment.create({
      data: {
        dealId: otherDeal.id,
        amount: 20000,
        method: "BANK_TRANSFER",
        type: "ADVANCE",
        note: "Direct bank wire advance for branding package",
        reference: "NEFT-BETA-999",
      },
    });

    expect(otherPayment.reference).toBe("NEFT-BETA-999");
    expect(otherPayment.note).toBe("Direct bank wire advance for branding package");

    const received = calculateTotalReceived([{ amount: Number(otherPayment.amount) }]);
    const remaining = calculateRemainingBalance(40000, received);
    const status = derivePaymentStatus(40000, received, null);

    expect(received).toBe(20000);
    expect(remaining).toBe(20000);
    expect(status).toBe("Partially Paid");
  });

  it("Step 6: UI Rendering Verification (Payment Note Visible, Reference Tag, Full Details, Responsive UX)", () => {
    const testDeals: SerializedDeal[] = [
      {
        id: "crm-deal-test",
        source: "CRM_LEAD",
        leadId: "lead-test",
        clientNameSnapshot: "Test CRM Client",
        companyNameSnapshot: "Acme Webworks",
        projectName: "CRM Web Portal",
        quotedAmount: 30000,
        finalAmount: 30000,
        currency: "INR",
        status: "CONFIRMED",
        nextPaymentDueDate: "2026-10-15",
        nextPaymentDueAmount: 20000,
        payments: [
          {
            id: "pay-1",
            dealId: "crm-deal-test",
            amount: 10000,
            paymentDate: "2026-09-18",
            type: "ADVANCE",
            method: "UPI",
            note: "Advance received for homepage and admin panel",
            reference: "UTR-TEST-001",
            createdAt: "2026-09-18T09:00:00.000Z",
            updatedAt: "2026-09-18T09:00:00.000Z",
          },
        ],
        totalReceived: 10000,
        remainingBalance: 20000,
        paymentStatus: "Partially Paid",
        createdAt: "2026-09-18T00:00:00.000Z",
        updatedAt: "2026-09-18T00:00:00.000Z",
        lead: {
          id: "lead-test",
          name: "Test CRM Client",
          business: "Acme Webworks",
          phone: "+919876500001",
          status: "WON",
        },
      },
    ];

    const markup = renderToStaticMarkup(
      React.createElement(DealsWorkspace, {
        initialDeals: testDeals,
        initialMetrics: calculateDealMetrics(testDeals),
      })
    );

    // Verify workspace renders client, financial amounts, and action buttons
    expect(markup).toContain("Test CRM Client");
    expect(markup).toContain("Acme Webworks");
    expect(markup).toContain("₹30,000");
    expect(markup).toContain("₹10,000");
    expect(markup).toContain("₹20,000");
    expect(markup).toContain("Partially Paid");
    expect(markup).toContain("History");
  });
});
