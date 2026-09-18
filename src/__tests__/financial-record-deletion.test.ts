import { describe, it, expect, afterAll, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { db } from "@/lib/db";
import { calculateTotalReceived, calculateRemainingBalance, derivePaymentStatus } from "@/features/deals/calculations";
import { DealsWorkspace } from "@/features/deals/components/deals-workspace";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/components/toast-provider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/features/leads/lead-navigation-provider", () => ({
  useLeadNavigation: () => ({ openLead: vi.fn() }),
}));

describe("Financial Record Safety: Lead -> Deal & Payments", () => {
  let testLeadId: string;
  let testDealId: string;
  let payment1Id: string;
  let payment2Id: string;

  afterAll(async () => {
    // Clean up only isolated test data
    if (testDealId) {
      await db.payment.deleteMany({ where: { dealId: testDealId } });
      await db.deal.deleteMany({ where: { id: testDealId } });
    }
    if (testLeadId) {
      await db.lead.deleteMany({ where: { id: testLeadId } });
    }
  });

  it("Step 1: Creates Lead 'Financial Safety Test', Deal ₹30,000, and 2 Payments (₹10,000, ₹5,000)", async () => {
    // 1. Create Lead
    const lead = await db.lead.create({
      data: {
        name: "Financial Safety Test",
        phone: "+919999988888",
        business: "Safety Corp",
        email: "safety@test.com",
      },
    });
    testLeadId = lead.id;
    expect(testLeadId).toBeDefined();

    // 2. Create Deal with snapshots
    const deal = await db.deal.create({
      data: {
        leadId: lead.id,
        clientNameSnapshot: lead.name,
        companyNameSnapshot: lead.business,
        quotedAmount: 30000,
        finalAmount: 30000,
        currency: "INR",
        status: "CONFIRMED",
      },
    });
    testDealId = deal.id;
    expect(testDealId).toBeDefined();
    expect(deal.clientNameSnapshot).toBe("Financial Safety Test");
    expect(deal.companyNameSnapshot).toBe("Safety Corp");
    expect(deal.leadId).toBe(lead.id);

    // 3. Add Payments
    const p1 = await db.payment.create({
      data: {
        dealId: deal.id,
        amount: 10000,
        type: "ADVANCE",
        method: "UPI",
      },
    });
    payment1Id = p1.id;

    const p2 = await db.payment.create({
      data: {
        dealId: deal.id,
        amount: 5000,
        type: "PARTIAL",
        method: "BANK_TRANSFER",
      },
    });
    payment2Id = p2.id;

    // 4. Verify totals before deletion
    const payments = [p1, p2].map(p => ({ amount: Number(p.amount) }));
    const received = calculateTotalReceived(payments);
    const remaining = calculateRemainingBalance(Number(deal.finalAmount), received);
    const status = derivePaymentStatus(Number(deal.finalAmount), received, null);

    expect(received).toBe(15000);
    expect(remaining).toBe(15000);
    expect(status).toBe("Partially Paid");
  });

  it("Step 2: Soft deleting a Lead does NOT detach the Deal", async () => {
    // Soft delete lead
    await db.lead.update({
      where: { id: testLeadId },
      data: { deletedAt: new Date() },
    });

    // Verify deal is still attached to lead
    const deal = await db.deal.findUnique({
      where: { id: testDealId },
      include: { payments: true, lead: true },
    });

    expect(deal).toBeDefined();
    expect(deal?.leadId).toBe(testLeadId);
    expect(deal?.lead?.deletedAt).not.toBeNull();
    expect(deal?.payments.length).toBe(2);
  });

  it("Step 3: Restoring a soft-deleted Lead keeps the same Deal intact", async () => {
    // Restore lead
    await db.lead.update({
      where: { id: testLeadId },
      data: { deletedAt: null },
    });

    // Verify deal is still attached to lead
    const deal = await db.deal.findUnique({
      where: { id: testDealId },
      include: { payments: true, lead: true },
    });

    expect(deal).toBeDefined();
    expect(deal?.leadId).toBe(testLeadId);
    expect(deal?.lead?.deletedAt).toBeNull();
    expect(deal?.payments.length).toBe(2);
  });

  it("Step 4: Permanently deleting Lead preserves Deal and Payments with ON DELETE SET NULL", async () => {
    // Soft delete first (standard flow before permanent deletion)
    await db.lead.update({
      where: { id: testLeadId },
      data: { deletedAt: new Date() },
    });

    // Ensure snapshot fields on Deal before deletion
    const lead = await db.lead.findUnique({ where: { id: testLeadId } });
    if (lead) {
      await db.deal.updateMany({
        where: { leadId: testLeadId },
        data: {
          clientNameSnapshot: lead.name,
          companyNameSnapshot: lead.business,
        },
      });
    }

    // Permanently delete the lead
    await db.lead.delete({
      where: { id: testLeadId },
    });

    // Verify lead is deleted
    const deletedLead = await db.lead.findUnique({ where: { id: testLeadId } });
    expect(deletedLead).toBeNull();

    // Verify Deal SURVIVES
    const survivingDeal = await db.deal.findUnique({
      where: { id: testDealId },
      include: { payments: true, lead: true },
    });

    expect(survivingDeal).toBeDefined();
    expect(survivingDeal?.leadId).toBeNull();
    expect(survivingDeal?.lead).toBeNull();
    expect(survivingDeal?.clientNameSnapshot).toBe("Financial Safety Test");
    expect(survivingDeal?.companyNameSnapshot).toBe("Safety Corp");

    // Verify Payments SURVIVE
    expect(survivingDeal?.payments.length).toBe(2);
    const payments = (survivingDeal?.payments || []).map(p => ({ amount: Number(p.amount) }));
    const received = calculateTotalReceived(payments);
    const remaining = calculateRemainingBalance(Number(survivingDeal?.finalAmount), received);

    expect(received).toBe(15000);
    expect(remaining).toBe(15000);
  });

  it("Step 5: Deals list query returns surviving deal with null lead and snapshots", async () => {
    const rawDeals = await db.deal.findMany({
      where: { id: testDealId },
      include: {
        payments: true,
        lead: {
          select: {
            id: true,
            name: true,
            business: true,
            phone: true,
            status: true,
          },
        },
      },
    });

    expect(rawDeals.length).toBe(1);
    const d = rawDeals[0];
    expect(d.leadId).toBeNull();
    expect(d.lead).toBeNull();
    expect(d.clientNameSnapshot).toBe("Financial Safety Test");
    expect(d.companyNameSnapshot).toBe("Safety Corp");

    // Calculation checks
    const payments = d.payments.map(p => ({ amount: Number(p.amount) }));
    const received = calculateTotalReceived(payments);
    const remaining = calculateRemainingBalance(Number(d.finalAmount), received);
    expect(received).toBe(15000);
    expect(remaining).toBe(15000);
  });

  it("Step 6: DealsWorkspace UI gracefully renders surviving deal when deal.lead === null", () => {
    const markup = renderToStaticMarkup(
      React.createElement(DealsWorkspace, {
        initialDeals: [
          {
            id: "deal-null-lead-1",
            source: "CRM_LEAD",
            leadId: null,
            clientNameSnapshot: "Financial Safety Test",
            companyNameSnapshot: "Safety Corp",
            quotedAmount: 30000,
            finalAmount: 30000,
            currency: "INR",
            status: "CONFIRMED",
            nextPaymentDueDate: null,
            nextPaymentDueAmount: null,
            payments: [
              {
                id: "pay-1",
                dealId: "deal-null-lead-1",
                amount: 10000,
                paymentDate: "2026-09-18",
                type: "ADVANCE",
                method: "UPI",
                createdAt: "2026-09-18T00:00:00.000Z",
                updatedAt: "2026-09-18T00:00:00.000Z",
              },
              {
                id: "pay-2",
                dealId: "deal-null-lead-1",
                amount: 5000,
                paymentDate: "2026-09-18",
                type: "PARTIAL",
                method: "BANK_TRANSFER",
                createdAt: "2026-09-18T00:00:00.000Z",
                updatedAt: "2026-09-18T00:00:00.000Z",
              },
            ],
            totalReceived: 15000,
            remainingBalance: 15000,
            paymentStatus: "Partially Paid",
            lead: null,
            createdAt: "2026-09-18T00:00:00.000Z",
            updatedAt: "2026-09-18T00:00:00.000Z",
          },
        ],
        initialMetrics: {
          totalDealValue: 30000,
          totalReceived: 15000,
          totalOutstanding: 15000,
          overdueAmount: 0,
          totalDealsCount: 1,
        },
      })
    );

    expect(markup).toContain("Financial Safety Test");
    expect(markup).toContain("Lead deleted");
    expect(markup).toContain("Safety Corp");
    expect(markup).toContain("15,000");
  });
});