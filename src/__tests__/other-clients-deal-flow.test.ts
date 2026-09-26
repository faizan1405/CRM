import { describe, it, expect, afterAll, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { db } from "@/lib/db";
import { 
  calculateTotalReceived, 
  calculateRemainingBalance, 
  derivePaymentStatus, 
  calculateDealMetrics 
} from "@/features/deals/calculations";
import { DealsWorkspace } from "@/features/deals/components/deals-workspace";
import type { SerializedDeal } from "@/features/deals/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/components/toast-provider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/features/leads/lead-navigation-provider", () => ({
  useLeadNavigation: () => ({ openLead: vi.fn() }),
}));

describe("Targeted Verification: Other Clients Payment Flow & Deal Segregation", () => {
  let clientALeadId: string | null = null;
  let clientADealId: string | null = null;
  let clientBDealId: string | null = null;
  let clientBPayment1Id: string | null = null;
  let clientBPayment2Id: string | null = null;

  afterAll(async () => {
    // Isolated cleanup of test data
    if (clientBDealId) {
      await db.payment.deleteMany({ where: { dealId: clientBDealId } }).catch(() => {});
      await db.deal.deleteMany({ where: { id: clientBDealId } }).catch(() => {});
    }
    if (clientADealId) {
      await db.payment.deleteMany({ where: { dealId: clientADealId } }).catch(() => {});
      await db.deal.deleteMany({ where: { id: clientADealId } }).catch(() => {});
    }
    if (clientALeadId) {
      await db.lead.deleteMany({ where: { id: clientALeadId } }).catch(() => {});
    }
  });

  it("Step 1: Create CRM Deal (Client A - ₹30,000) & Other Client Deal (Client B - ₹50,000)", async () => {
    // 1. Create CRM Lead for Client A
    const leadA = await db.lead.create({
      data: {
        name: "Client A",
        phone: "+919800011111",
        business: "Enterprise Alpha",
        email: "clientA@alpha.com",
      },
    });
    clientALeadId = leadA.id;

    // 2. Create CRM Deal for Client A
    const dealA = await db.deal.create({
      data: {
        source: "CRM_LEAD",
        leadId: leadA.id,
        clientNameSnapshot: leadA.name,
        companyNameSnapshot: leadA.business,
        quotedAmount: 30000,
        finalAmount: 30000,
        currency: "INR",
        status: "CONFIRMED",
      },
    });
    clientADealId = dealA.id;
    expect(dealA.source).toBe("CRM_LEAD");
    expect(dealA.leadId).toBe(leadA.id);
    expect(Number(dealA.finalAmount)).toBe(30000);

    // 3. Create standalone Other Client Deal for Client B (NO CRM Lead)
    const dealB = await db.deal.create({
      data: {
        source: "OTHER_CLIENT",
        leadId: null,
        clientNameSnapshot: "Client B",
        companyNameSnapshot: "Beta Consulting",
        clientPhone: "+919800022222",
        clientEmail: "clientB@beta.com",
        projectName: "Brand Refresh",
        finalAmount: 50000,
        currency: "INR",
        status: "CONFIRMED",
      },
    });
    clientBDealId = dealB.id;
    expect(dealB.source).toBe("OTHER_CLIENT");
    expect(dealB.leadId).toBeNull();
    expect(dealB.clientNameSnapshot).toBe("Client B");
    expect(dealB.companyNameSnapshot).toBe("Beta Consulting");
    expect(dealB.projectName).toBe("Brand Refresh");
    expect(Number(dealB.finalAmount)).toBe(50000);
  });

  it("Step 2: Payments to Client B (₹10,000 + ₹15,000) calculate Received = ₹25,000, Remaining = ₹25,000, Status = Partially Paid", async () => {
    expect(clientBDealId).toBeDefined();

    // Payment 1: ₹10,000
    const p1 = await db.payment.create({
      data: {
        dealId: clientBDealId!,
        amount: 10000,
        type: "ADVANCE",
        method: "UPI",
        note: "Initial retainer",
      },
    });
    clientBPayment1Id = p1.id;

    // Payment 2: ₹15,000
    const p2 = await db.payment.create({
      data: {
        dealId: clientBDealId!,
        amount: 15000,
        type: "PARTIAL",
        method: "BANK_TRANSFER",
        note: "Milestone 1",
      },
    });
    clientBPayment2Id = p2.id;

    const payments = [p1, p2].map((p) => ({ amount: Number(p.amount) }));
    const received = calculateTotalReceived(payments);
    const remaining = calculateRemainingBalance(50000, received);
    const status = derivePaymentStatus(50000, received, null);

    expect(received).toBe(25000);
    expect(remaining).toBe(25000);
    expect(status).toBe("Partially Paid");
  });

  it("Step 3: Tab Segregation — ALL DEALS contains Client A + Client B, CRM CLIENTS contains only Client A, OTHER CLIENTS contains only Client B", async () => {
    const rawDeals = await db.deal.findMany({
      where: {
        id: { in: [clientADealId!, clientBDealId!] },
      },
      include: {
        payments: true,
        lead: true,
      },
    });

    expect(rawDeals.length).toBe(2);

    // ALL DEALS
    const allDeals = rawDeals;
    const allNames = allDeals.map((d) => d.lead?.name || d.clientNameSnapshot);
    expect(allNames).toContain("Client A");
    expect(allNames).toContain("Client B");

    // CRM CLIENTS
    const crmDeals = rawDeals.filter((d) => d.source === "CRM_LEAD");
    const crmNames = crmDeals.map((d) => d.lead?.name || d.clientNameSnapshot);
    expect(crmNames).toContain("Client A");
    expect(crmNames).not.toContain("Client B");

    // OTHER CLIENTS
    const otherDeals = rawDeals.filter((d) => d.source === "OTHER_CLIENT");
    const otherNames = otherDeals.map((d) => d.clientNameSnapshot);
    expect(otherNames).toContain("Client B");
    expect(otherNames).not.toContain("Client A");
  });

  it("Step 4: Permanently delete Client A's CRM Lead -> Deal survives, source stays CRM_LEAD, remains in CRM Clients, does NOT leak into Other Clients", async () => {
    // 1. Permanently delete Client A's lead
    await db.lead.delete({
      where: { id: clientALeadId! },
    });

    // 2. Fetch surviving deal
    const survivingDealA = await db.deal.findUnique({
      where: { id: clientADealId! },
      include: { lead: true },
    });

    expect(survivingDealA).toBeDefined();
    expect(survivingDealA?.leadId).toBeNull();
    expect(survivingDealA?.lead).toBeNull();
    expect(survivingDealA?.source).toBe("CRM_LEAD"); // Must remain CRM_LEAD even when lead is permanently deleted!
    expect(survivingDealA?.clientNameSnapshot).toBe("Client A");
    expect(survivingDealA?.companyNameSnapshot).toBe("Enterprise Alpha");

    // 3. Verify classification against tabs
    const allDeals = await db.deal.findMany({
      where: { id: { in: [clientADealId!, clientBDealId!] } },
      include: { lead: true },
    });

    const crmDeals = allDeals.filter((d) => d.source === "CRM_LEAD");
    const otherDeals = allDeals.filter((d) => d.source === "OTHER_CLIENT");

    // CRM Clients tab still contains Client A (as a preserved lead-deleted record)
    expect(crmDeals.map((d) => d.clientNameSnapshot)).toContain("Client A");
    expect(crmDeals.map((d) => d.clientNameSnapshot)).not.toContain("Client B");

    // Other Clients tab contains ONLY Client B, NEVER Client A
    expect(otherDeals.map((d) => d.clientNameSnapshot)).toContain("Client B");
    expect(otherDeals.map((d) => d.clientNameSnapshot)).not.toContain("Client A");
  });

  it("Step 5: Payment totals recalculate on payment edit and delete", async () => {
    // 1. Edit Payment 1 from ₹10,000 to ₹12,000
    await db.payment.update({
      where: { id: clientBPayment1Id! },
      data: { amount: 12000 },
    });

    let payments = await db.payment.findMany({ where: { dealId: clientBDealId! } });
    let received = calculateTotalReceived(payments.map((p) => ({ amount: Number(p.amount) })));
    let remaining = calculateRemainingBalance(50000, received);
    let status = derivePaymentStatus(50000, received, null);

    expect(received).toBe(27000);
    expect(remaining).toBe(23000);
    expect(status).toBe("Partially Paid");

    // 2. Delete Payment 2 (₹15,000)
    await db.payment.delete({
      where: { id: clientBPayment2Id! },
    });

    payments = await db.payment.findMany({ where: { dealId: clientBDealId! } });
    received = calculateTotalReceived(payments.map((p) => ({ amount: Number(p.amount) })));
    remaining = calculateRemainingBalance(50000, received);
    status = derivePaymentStatus(50000, received, null);

    expect(received).toBe(12000);
    expect(remaining).toBe(38000);
    expect(status).toBe("Partially Paid");

    // 3. Clear remaining balance with ₹38,000 payment -> Paid
    const finalPay = await db.payment.create({
      data: {
        dealId: clientBDealId!,
        amount: 38000,
        type: "FINAL",
        method: "BANK_TRANSFER",
      },
    });

    payments = await db.payment.findMany({ where: { dealId: clientBDealId! } });
    received = calculateTotalReceived(payments.map((p) => ({ amount: Number(p.amount) })));
    remaining = calculateRemainingBalance(50000, received);
    status = derivePaymentStatus(50000, received, null);

    expect(received).toBe(50000);
    expect(remaining).toBe(0);
    expect(status).toBe("Paid");

    // Clean up extra payment
    await db.payment.delete({ where: { id: finalPay.id } });
  });

  it("Step 6: Tab-Scoped KPI Metrics correctly recalculate per tab", () => {
    const dealsList: SerializedDeal[] = [
      {
        id: "crm-deal-1",
        source: "CRM_LEAD",
        leadId: "lead-1",
        quotedAmount: 30000,
        finalAmount: 30000,
        currency: "INR",
        status: "CONFIRMED",
        nextPaymentDueDate: null,
        nextPaymentDueAmount: null,
        payments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalReceived: 10000,
        remainingBalance: 20000,
        paymentStatus: "Partially Paid",
        clientNameSnapshot: "Client A",
        lead: { id: "lead-1", name: "Client A", business: "Alpha Corp", phone: "+9199999", status: "WON" },
      },
      {
        id: "other-deal-1",
        source: "OTHER_CLIENT",
        leadId: null,
        quotedAmount: null,
        finalAmount: 50000,
        currency: "INR",
        status: "CONFIRMED",
        nextPaymentDueDate: "2020-01-01",
        nextPaymentDueAmount: 25000,
        payments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalReceived: 25000,
        remainingBalance: 25000,
        paymentStatus: "Overdue",
        clientNameSnapshot: "Client B",
        companyNameSnapshot: "Beta Consulting",
        projectName: "Brand Redesign",
        lead: null,
      },
    ];

    // ALL DEALS KPI metrics
    const allMetrics = calculateDealMetrics(dealsList);
    expect(allMetrics.totalDealValue).toBe(80000);
    expect(allMetrics.totalReceived).toBe(35000);
    expect(allMetrics.totalOutstanding).toBe(45000);
    expect(allMetrics.overdueAmount).toBe(25000);
    expect(allMetrics.totalDealsCount).toBe(2);

    // CRM CLIENTS KPI metrics
    const crmScoped = dealsList.filter((d) => d.source === "CRM_LEAD");
    const crmMetrics = calculateDealMetrics(crmScoped);
    expect(crmMetrics.totalDealValue).toBe(30000);
    expect(crmMetrics.totalReceived).toBe(10000);
    expect(crmMetrics.totalOutstanding).toBe(20000);
    expect(crmMetrics.overdueAmount).toBe(0);
    expect(crmMetrics.totalDealsCount).toBe(1);

    // OTHER CLIENTS KPI metrics
    const otherScoped = dealsList.filter((d) => d.source === "OTHER_CLIENT");
    const otherMetrics = calculateDealMetrics(otherScoped);
    expect(otherMetrics.totalDealValue).toBe(50000);
    expect(otherMetrics.totalReceived).toBe(25000);
    expect(otherMetrics.totalOutstanding).toBe(25000);
    expect(otherMetrics.overdueAmount).toBe(25000);
    expect(otherMetrics.totalDealsCount).toBe(1);
  });

  it("Step 7: Desktop & Mobile UI rendering passes with tabs, source badges, and actions", () => {
    const mockDeals: SerializedDeal[] = [
      {
        id: "deal-crm",
        source: "CRM_LEAD",
        leadId: "lead-live",
        clientNameSnapshot: "Live Client",
        companyNameSnapshot: "Live Corp",
        quotedAmount: 30000,
        finalAmount: 30000,
        currency: "INR",
        status: "CONFIRMED",
        nextPaymentDueDate: null,
        nextPaymentDueAmount: null,
        payments: [],
        totalReceived: 10000,
        remainingBalance: 20000,
        paymentStatus: "Partially Paid",
        lead: { id: "lead-live", name: "Live Client", business: "Live Corp", phone: "12345", status: "WON" },
        createdAt: "2026-09-18T00:00:00.000Z",
        updatedAt: "2026-09-18T00:00:00.000Z",
      },
      {
        id: "deal-deleted-lead",
        source: "CRM_LEAD",
        leadId: null,
        clientNameSnapshot: "Preserved Client",
        companyNameSnapshot: "Old Corp",
        quotedAmount: 40000,
        finalAmount: 40000,
        currency: "INR",
        status: "CONFIRMED",
        nextPaymentDueDate: null,
        nextPaymentDueAmount: null,
        payments: [],
        totalReceived: 40000,
        remainingBalance: 0,
        paymentStatus: "Paid",
        lead: null,
        createdAt: "2026-09-18T00:00:00.000Z",
        updatedAt: "2026-09-18T00:00:00.000Z",
      },
      {
        id: "deal-other",
        source: "OTHER_CLIENT",
        leadId: null,
        clientNameSnapshot: "Other Client Standalone",
        companyNameSnapshot: "Direct Corp",
        projectName: "Logo Design",
        clientPhone: "+919876543210",
        clientEmail: "direct@corp.com",
        quotedAmount: null,
        finalAmount: 50000,
        currency: "INR",
        status: "CONFIRMED",
        nextPaymentDueDate: null,
        nextPaymentDueAmount: null,
        payments: [],
        totalReceived: 25000,
        remainingBalance: 25000,
        paymentStatus: "Partially Paid",
        lead: null,
        createdAt: "2026-09-18T00:00:00.000Z",
        updatedAt: "2026-09-18T00:00:00.000Z",
      },
    ];

    const markup = renderToStaticMarkup(
      React.createElement(DealsWorkspace, {
        initialDeals: mockDeals,
        initialMetrics: calculateDealMetrics(mockDeals),
      })
    );

    // Top Tabs
    expect(markup).toContain("All Deals");
    expect(markup).toContain("CRM Clients");
    expect(markup).toContain("Other Clients");
    expect(markup).toContain("Add Deal");

    // Source Badges in All Deals view
    expect(markup).toContain("CRM Client");
    expect(markup).toContain("Lead deleted");
    expect(markup).toContain("Other Client");

    // Client and project details
    expect(markup).toContain("Live Client");
    expect(markup).toContain("Preserved Client");
    expect(markup).toContain("Other Client Standalone");
    expect(markup).toContain("Logo Design");
  });
});
