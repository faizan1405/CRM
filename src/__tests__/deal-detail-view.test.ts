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
import { DealDetailPanel } from "@/features/deals/components/deal-detail-panel";
import type { SerializedDeal } from "@/features/deals/types";
import { getDealById, upsertLeadDeal, addDealPayment } from "@/app/actions/deals";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/deals",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/components/toast-provider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/features/leads/lead-navigation-provider", () => ({
  useLeadNavigation: () => ({ openLead: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn().mockResolvedValue({ id: "test-user-id", role: "ADMIN" }),
}));

describe("Deal Detail View & Client Information Experience", () => {
  let maxwellDealId: string | null = null;
  let crmLeadId: string | null = null;
  let crmDealId: string | null = null;

  afterAll(async () => {
    // Cleanup created test records
    if (maxwellDealId) {
      await db.payment.deleteMany({ where: { dealId: maxwellDealId } }).catch(() => {});
      await db.deal.deleteMany({ where: { id: maxwellDealId } }).catch(() => {});
    }
    if (crmDealId) {
      await db.payment.deleteMany({ where: { dealId: crmDealId } }).catch(() => {});
      await db.deal.deleteMany({ where: { id: crmDealId } }).catch(() => {});
    }
    if (crmLeadId) {
      await db.lead.deleteMany({ where: { id: crmLeadId } }).catch(() => {});
    }
  });

  // =========================================================================
  // TARGET VERIFICATION: Other Client Deal (Maxwell)
  // =========================================================================
  it("Target Check: Create Other Client deal 'Maxwell' with all metadata and verify complete detail view", async () => {
    // 1. Create Other Client Deal
    const deal = await db.deal.create({
      data: {
        source: "OTHER_CLIENT",
        leadId: null,
        clientNameSnapshot: "Maxwell",
        companyNameSnapshot: "Maxwell Trading",
        clientPhone: "+91 98765 43210",
        clientEmail: "maxwell@example.com",
        projectName: "Packaging Website",
        finalAmount: 50000,
        currency: "INR",
        status: "CONFIRMED",
        notes: "Website + catalog + inquiry system",
      },
    });
    maxwellDealId = deal.id;
    expect(maxwellDealId).toBeDefined();

    // 2. Fetch using action to verify serialized deal structure
    const fetchRes = await getDealById(maxwellDealId!);
    expect(fetchRes.success).toBe(true);
    const serializedDeal = (fetchRes as any).data!;
    expect(serializedDeal).toBeDefined();

    // 3. Verify ALL saved client & deal fields are present
    expect(serializedDeal.clientNameSnapshot).toBe("Maxwell");
    expect(serializedDeal.companyNameSnapshot).toBe("Maxwell Trading");
    expect(serializedDeal.clientPhone).toBe("+91 98765 43210");
    expect(serializedDeal.clientEmail).toBe("maxwell@example.com");
    expect(serializedDeal.projectName).toBe("Packaging Website");
    expect(serializedDeal.finalAmount).toBe(50000);
    expect(serializedDeal.notes).toBe("Website + catalog + inquiry system");
    expect(serializedDeal.source).toBe("OTHER_CLIENT");

    // 4. Render DealDetailPanel and verify EVERY piece of saved info is visible
    const detailMarkup = renderToStaticMarkup(
      React.createElement(DealDetailPanel, {
        deal: serializedDeal,
        onClose: () => {},
        onRecordPayment: () => {},
        onEditDeal: () => {},
      })
    );

    // Client Info Section
    expect(detailMarkup).toContain("Maxwell");
    expect(detailMarkup).toContain("Maxwell Trading");
    expect(detailMarkup).toContain("+91 98765 43210");
    expect(detailMarkup).toContain("maxwell@example.com");
    expect(detailMarkup).toContain("Other Client");

    // Deal Info Section
    expect(detailMarkup).toContain("Packaging Website");
    expect(detailMarkup).toContain("50,000");
    expect(detailMarkup).toContain("Website + catalog + inquiry system");

    // Primary Action Buttons
    expect(detailMarkup).toContain("Record Payment");
    expect(detailMarkup).toContain("Edit Deal / Client");
  });

  it("Target Check: Edit deal notes and verify update succeeds", async () => {
    expect(maxwellDealId).toBeDefined();

    // Update deal notes via upsertLeadDeal
    const updateRes = await upsertLeadDeal({
      dealId: maxwellDealId!,
      notes: "Website + catalog + inquiry system + payment gateway integration",
      finalAmount: 50000,
    });

    expect(updateRes.success).toBe(true);
    if (!updateRes.success) throw new Error(updateRes.error);
    expect(updateRes.data.notes).toBe("Website + catalog + inquiry system + payment gateway integration");

    // Re-render DealDetailPanel with updated deal
    const updatedMarkup = renderToStaticMarkup(
      React.createElement(DealDetailPanel, {
        deal: (updateRes as any).data,
        onClose: () => {},
        onRecordPayment: () => {},
        onEditDeal: () => {},
      })
    );
    expect(updatedMarkup).toContain("Website + catalog + inquiry system + payment gateway integration");
    // Ensure client info was NOT lost
    expect(updatedMarkup).toContain("Maxwell");
    expect(updatedMarkup).toContain("Maxwell Trading");
  });

  it("Target Check: Record payment and verify summary recalculates without losing client/deal info", async () => {
    expect(maxwellDealId).toBeDefined();

    // Record a payment of ₹20,000 with its own distinct note
    const payRes = await addDealPayment({
      dealId: maxwellDealId!,
      amount: 20000,
      type: "ADVANCE",
      method: "UPI",
      note: "Advance payment for design mockups",
    });

    expect(payRes.success).toBe(true);

    // Fetch refreshed deal
    const refreshed = await getDealById(maxwellDealId!);
    expect(refreshed.success).toBe(true);
    const deal = (refreshed as any).data!;

    // Verify recalculations
    expect(deal.totalReceived).toBe(20000);
    expect(deal.remainingBalance).toBe(30000);
    expect(deal.paymentStatus).toBe("Partially Paid");
    expect(deal.payments.length).toBe(1);

    // Render DealDetailPanel
    const detailMarkup = renderToStaticMarkup(
      React.createElement(DealDetailPanel, {
        deal,
        onClose: () => {},
        onRecordPayment: () => {},
        onEditDeal: () => {},
      })
    );

    // Verify Payment Summary
    expect(detailMarkup).toContain("20,000");
    expect(detailMarkup).toContain("30,000");
    expect(detailMarkup).toContain("Partially Paid");
    expect(detailMarkup).toContain("40%"); // Collection Percentage = 20k / 50k = 40%

    // Verify Payment History item
    expect(detailMarkup).toContain("Advance payment for design mockups");

    // CRITICAL: Visual separation of Deal Notes vs Payment Notes
    expect(detailMarkup).toContain("Website + catalog + inquiry system + payment gateway integration");
    expect(detailMarkup).toContain("Advance payment for design mockups");

    // CRITICAL: Client info preserved
    expect(detailMarkup).toContain("Maxwell");
    expect(detailMarkup).toContain("Maxwell Trading");
    expect(detailMarkup).toContain("+91 98765 43210");
    expect(detailMarkup).toContain("maxwell@example.com");
    expect(detailMarkup).toContain("Packaging Website");
  });

  it("Target Check: Search finds deal by 'Packaging Website', 'maxwell@example.com', and 'inquiry system'", async () => {
    const fetched = await getDealById(maxwellDealId!);
    const deal = (fetched as any).data!;

    // Test Search query filter matching logic (identical to deals-workspace filter)
    const testSearchMatch = (q: string, d: SerializedDeal): boolean => {
      const query = q.toLowerCase().trim();
      const names = [d.lead?.name, d.clientNameSnapshot].filter(Boolean).join(" ").toLowerCase();
      const businesses = [d.lead?.business, d.companyNameSnapshot].filter(Boolean).join(" ").toLowerCase();
      const phones = [d.lead?.phone, d.clientPhone].filter(Boolean).join(" ").toLowerCase();
      const emails = [d.lead?.email, d.clientEmail].filter(Boolean).join(" ").toLowerCase();
      const project = (d.projectName || "").toLowerCase();
      const notes = (d.notes || "").toLowerCase();
      return (
        names.includes(query) ||
        businesses.includes(query) ||
        project.includes(query) ||
        phones.includes(query) ||
        emails.includes(query) ||
        notes.includes(query)
      );
    };

    // 1. By Project Name
    expect(testSearchMatch("Packaging Website", deal)).toBe(true);

    // 2. By Email
    expect(testSearchMatch("maxwell@example.com", deal)).toBe(true);

    // 3. By Deal Note
    expect(testSearchMatch("inquiry system", deal)).toBe(true);

    // 4. By Client Name & Business
    expect(testSearchMatch("Maxwell", deal)).toBe(true);
    expect(testSearchMatch("Maxwell Trading", deal)).toBe(true);

    // 5. By Phone
    expect(testSearchMatch("98765", deal)).toBe(true);

    // 6. Negative match
    expect(testSearchMatch("UnrelatedQueryXYZ", deal)).toBe(false);
  });

  // =========================================================================
  // CRM CLIENT DETAIL VIEW & LIVE LEAD INTEGRATION
  // =========================================================================
  it("CRM Client Detail: Displays live CRM Lead info, lead status, deal details, and live link", async () => {
    // 1. Create live CRM Lead
    const lead = await db.lead.create({
      data: {
        name: "Sarah Connor",
        business: "Cyberdyne Systems",
        phone: "+91 99887 76655",
        email: "sarah@cyberdyne.com",
        status: "WON",
      },
    });
    crmLeadId = lead.id;

    // 2. Create CRM Deal
    const deal = await db.deal.create({
      data: {
        source: "CRM_LEAD",
        leadId: lead.id,
        clientNameSnapshot: lead.name,
        companyNameSnapshot: lead.business,
        clientPhone: lead.phone,
        clientEmail: lead.email,
        projectName: "Defense Grid Upgrade",
        quotedAmount: 120000,
        finalAmount: 100000,
        currency: "INR",
        status: "CONFIRMED",
        notes: "Defense network automation and security protocols",
      },
    });
    crmDealId = deal.id;

    // 3. Fetch deal
    const res = await getDealById(crmDealId!);
    expect(res.success).toBe(true);
    const serialized = (res as any).data!;

    // 4. Verify CRM Lead integration
    expect(serialized.lead).toBeDefined();
    expect(serialized.lead?.name).toBe("Sarah Connor");
    expect(serialized.lead?.business).toBe("Cyberdyne Systems");
    expect(serialized.lead?.phone).toBe("+91 99887 76655");
    expect(serialized.lead?.email).toBe("sarah@cyberdyne.com");
    expect(serialized.lead?.status).toBe("WON");

    // 5. Render Detail Panel
    const markup = renderToStaticMarkup(
      React.createElement(DealDetailPanel, {
        deal: serialized,
        onClose: () => {},
        onRecordPayment: () => {},
        onEditDeal: () => {},
        onOpenLead: () => {},
      })
    );

    expect(markup).toContain("Sarah Connor");
    expect(markup).toContain("Cyberdyne Systems");
    expect(markup).toContain("+91 99887 76655");
    expect(markup).toContain("sarah@cyberdyne.com");
    expect(markup).toContain("CRM Client");
    expect(markup).toContain("Live Lead Connected");
    expect(markup).toContain("Open CRM Lead Details");
    expect(markup).toContain("Defense Grid Upgrade");
    expect(markup).toContain("1,00,000"); // Final value
    expect(markup).toContain("1,20,000"); // Quoted value
    expect(markup).toContain("Defense network automation and security protocols");
  });

  // =========================================================================
  // DELETED CRM LEAD PRESERVATION
  // =========================================================================
  it("Preserved Deal: Lead deleted permanently -> deal survives with snapshots & 'Lead deleted' badge", async () => {
    expect(crmLeadId).toBeDefined();
    expect(crmDealId).toBeDefined();

    // 1. Permanently delete the CRM Lead
    await db.lead.delete({
      where: { id: crmLeadId! },
    });
    crmLeadId = null; // Marked deleted so afterAll won't fail

    // 2. Fetch preserved deal
    const res = await getDealById(crmDealId!);
    expect(res.success).toBe(true);
    const preservedDeal = (res as any).data!;

    // Deal survives with CRM_LEAD source and null lead relation
    expect(preservedDeal.id).toBe(crmDealId);
    expect(preservedDeal.source).toBe("CRM_LEAD");
    expect(preservedDeal.leadId).toBeNull();
    expect(preservedDeal.lead).toBeNull();

    // Snapshots remain intact
    expect(preservedDeal.clientNameSnapshot).toBe("Sarah Connor");
    expect(preservedDeal.companyNameSnapshot).toBe("Cyberdyne Systems");
    expect(preservedDeal.clientPhone).toBe("+91 99887 76655");
    expect(preservedDeal.clientEmail).toBe("sarah@cyberdyne.com");
    expect(preservedDeal.projectName).toBe("Defense Grid Upgrade");

    // 3. Render Detail Panel for Preserved Deal
    const markup = renderToStaticMarkup(
      React.createElement(DealDetailPanel, {
        deal: preservedDeal,
        onClose: () => {},
        onRecordPayment: () => {},
        onEditDeal: () => {},
      })
    );

    // Badges & Banner
    expect(markup).toContain("Lead deleted");
    expect(markup).toContain("Lead Deleted (Financial Record Preserved)");
    expect(markup).not.toContain("Live Lead Connected");
    expect(markup).not.toContain("Open CRM Lead Details");

    // Historical snapshots are clearly visible
    expect(markup).toContain("Sarah Connor");
    expect(markup).toContain("Cyberdyne Systems");
    expect(markup).toContain("+91 99887 76655");
    expect(markup).toContain("sarah@cyberdyne.com");
    expect(markup).toContain("Defense Grid Upgrade");
  });

  // =========================================================================
  // LOW-CLICK UX & DESKTOP / MOBILE WORKSPACE RENDERING
  // =========================================================================
  it("Workspace UI: Desktop table and Mobile cards render with clickable triggers for detail view", async () => {
    const fetchedMaxwell = await getDealById(maxwellDealId!);
    const fetchedPreserved = await getDealById(crmDealId!);

    const allDeals: SerializedDeal[] = [(fetchedMaxwell as any).data!, (fetchedPreserved as any).data!];
    const metrics = calculateDealMetrics(allDeals);

    const workspaceMarkup = renderToStaticMarkup(
      React.createElement(DealsWorkspace, {
        initialDeals: allDeals,
        initialMetrics: metrics,
      })
    );

    // Desktop and mobile elements
    expect(workspaceMarkup).toContain("Maxwell");
    expect(workspaceMarkup).toContain("Sarah Connor");
    expect(workspaceMarkup).toContain("Details"); // Desktop Details button
    expect(workspaceMarkup).toContain("Packaging Website");
    expect(workspaceMarkup).toContain("Defense Grid Upgrade");

    // Source badges
    expect(workspaceMarkup).toContain("Other Client");
    expect(workspaceMarkup).toContain("Lead deleted");
  });
});
