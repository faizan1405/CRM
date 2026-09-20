import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { getLead, updateLead, checkLeadDuplicate } from "@/app/actions/leads";
import { getSession } from "@/lib/auth";
import { ActivityType, Prisma } from "@prisma/client";

const TEST_USER_ID = "test-edit-lead-details-user";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/components/whatsapp-context", () => ({
  useWhatsApp: () => ({
    openWhatsApp: vi.fn(),
    isComposerOpen: false,
    openComposer: vi.fn(),
    closeComposer: vi.fn(),
  }),
}));

vi.mock("@/components/call-context", () => ({
  useCall: () => ({
    openCallModal: vi.fn(),
    closeCallModal: vi.fn(),
    isCallModalOpen: false,
  }),
}));

describe("Edit Lead Details Functionality Inside Lead Detail", () => {
  const createdLeadIds: string[] = [];
  const createdDealIds: string[] = [];

  beforeAll(async () => {
    await db.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        name: "Edit Lead Tester",
        email: "edit-lead-tester@example.com",
        passwordHash: "dummyhash",
        role: "ADMIN",
      },
    });

    vi.mocked(getSession).mockResolvedValue({
      id: TEST_USER_ID,
      email: "edit-lead-tester@example.com",
      role: "ADMIN",
    });
  });

  afterAll(async () => {
    if (createdDealIds.length > 0) {
      await db.payment.deleteMany({ where: { dealId: { in: createdDealIds } } });
      await db.deal.deleteMany({ where: { id: { in: createdDealIds } } });
    }
    if (createdLeadIds.length > 0) {
      await db.payment.deleteMany({ where: { deal: { leadId: { in: createdLeadIds } } } });
      await db.deal.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.followUp.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadActivity.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadAIInsight.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
    }
    await db.user.delete({ where: { id: TEST_USER_ID } }).catch(() => {});
  });

  async function createInitialBasicLead() {
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const lead = await db.lead.create({
      data: {
        name: "Test Prospect",
        phone: `+91 98765 ${randomSuffix}`,
        email: null,
        business: null,
        industry: null,
        quotedAmount: null,
        status: "NEW",
      },
    });
    createdLeadIds.push(lead.id);
    return lead;
  }

  it("1. Updates existing lead with additional information without creating duplicate", async () => {
    const lead = await createInitialBasicLead();

    const form = new FormData();
    form.set("name", lead.name);
    form.set("phone", lead.phone);
    form.set("email", "test@example.com");
    form.set("business", "Test Interiors");
    form.set("industry", "Interior Design");
    form.set("source", "Website");
    form.set("quotedAmount", "35000");

    const result = await updateLead(lead.id, form);

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Verify same Lead ID remains
    expect(result.data.id).toBe(lead.id);
    expect(result.data.email).toBe("test@example.com");
    expect(result.data.business).toBe("Test Interiors");
    expect(result.data.industry).toBe("Interior Design");
    expect(result.data.source).toBe("Website");
    expect(result.data.quotedAmount).toBe(35000);

    // Verify database record
    const inDb = await db.lead.findUnique({ where: { id: lead.id } });
    expect(inDb?.id).toBe(lead.id);
    expect(inDb?.name).toBe("Test Prospect");
    expect(inDb?.business).toBe("Test Interiors");
    expect(inDb?.industry).toBe("Interior Design");
    expect(inDb?.quotedAmount ? Number(inDb.quotedAmount) : 0).toBe(35000);

    // Verify no duplicates created
    const count = await db.lead.count({ where: { phone: lead.phone } });
    expect(count).toBe(1);
  });

  it("2. Editing again updates the same record correctly", async () => {
    const lead = await createInitialBasicLead();

    // First update
    const form1 = new FormData();
    form1.set("name", lead.name);
    form1.set("phone", lead.phone);
    form1.set("email", "test@example.com");
    form1.set("business", "Test Interiors");
    form1.set("industry", "Interior Design");
    form1.set("quotedAmount", "35000");

    const res1 = await updateLead(lead.id, form1);
    expect(res1.success).toBe(true);

    // Second update: Test Interiors -> Test Studio, 35000 -> 40000
    const form2 = new FormData();
    form2.set("name", lead.name);
    form2.set("phone", lead.phone);
    form2.set("email", "test@example.com");
    form2.set("business", "Test Studio");
    form2.set("industry", "Interior Design");
    form2.set("quotedAmount", "40000");

    const res2 = await updateLead(lead.id, form2);
    expect(res2.success).toBe(true);
    if (!res2.success) return;

    expect(res2.data.id).toBe(lead.id);
    expect(res2.data.business).toBe("Test Studio");
    expect(res2.data.quotedAmount).toBe(40000);

    const inDb = await db.lead.findUnique({ where: { id: lead.id } });
    expect(inDb?.business).toBe("Test Studio");
    expect(inDb?.quotedAmount ? Number(inDb.quotedAmount) : 0).toBe(40000);
  });

  it("3. Quoted Amount vs Deal Value separation and Deal snapshot safety", async () => {
    const lead = await createInitialBasicLead();

    // Create a Deal attached to this Lead with finalAmount = 75000 and payments
    const deal = await db.deal.create({
      data: {
        leadId: lead.id,
        finalAmount: new Prisma.Decimal(75000),
        quotedAmount: new Prisma.Decimal(70000),
        clientNameSnapshot: lead.name,
        companyNameSnapshot: "Original Company",
        currency: "INR",
        status: "CONFIRMED",
      },
    });
    createdDealIds.push(deal.id);

    const payment = await db.payment.create({
      data: {
        dealId: deal.id,
        amount: new Prisma.Decimal(25000),
        type: "ADVANCE",
        method: "UPI",
      },
    });

    // Update Lead quotedAmount and business/name
    const form = new FormData();
    form.set("name", "Updated Prospect Name");
    form.set("phone", lead.phone);
    form.set("business", "Updated Company Name");
    form.set("quotedAmount", "90000"); // Proposed quote changed to 90000

    const result = await updateLead(lead.id, form);
    expect(result.success).toBe(true);

    // Verify Deal.finalAmount remains 75000 (NOT changed to 90000)
    const dealInDb = await db.deal.findUnique({
      where: { id: deal.id },
      include: { payments: true },
    });

    expect(Number(dealInDb?.finalAmount)).toBe(75000);
    expect(Number(dealInDb?.quotedAmount)).toBe(70000); // Deal quoted amount untouched
    expect(dealInDb?.leadId).toBe(lead.id); // Deal not detached
    expect(dealInDb?.payments.length).toBe(1);
    expect(Number(dealInDb?.payments[0].amount)).toBe(25000); // Payment intact

    // Verify Deal snapshots were synced safely
    expect(dealInDb?.clientNameSnapshot).toBe("Updated Prospect Name");
    expect(dealInDb?.companyNameSnapshot).toBe("Updated Company Name");
  });

  it("4. Preserves untouched fields like status, notes, and budget when only details are edited", async () => {
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const lead = await db.lead.create({
      data: {
        name: "Status Preservation Lead",
        phone: `+91 98765 ${randomSuffix}`,
        status: "QUALIFIED",
        notes: "Crucial existing client notes that must not be erased.",
        budget: new Prisma.Decimal(50000),
      },
    });
    createdLeadIds.push(lead.id);

    // Submit form with only contact/sales details (no status, no notes, no budget)
    const form = new FormData();
    form.set("name", "Status Preservation Lead");
    form.set("phone", lead.phone);
    form.set("business", "Safe Business");
    form.set("quotedAmount", "30000");

    const result = await updateLead(lead.id, form);
    expect(result.success).toBe(true);
    if (!result.success) return;

    // Verify status was NOT reset to "NEW"
    expect(result.data.status).toBe("Qualified");
    // Verify notes were NOT erased
    expect(result.data.notes).toBe("Crucial existing client notes that must not be erased.");
    // Verify budget was NOT erased
    expect(result.data.budget).toBe(50000);

    const inDb = await db.lead.findUnique({ where: { id: lead.id } });
    expect(inDb?.status).toBe("QUALIFIED");
    expect(inDb?.notes).toBe("Crucial existing client notes that must not be erased.");
    expect(Number(inDb?.budget)).toBe(50000);
  });

  it("5. Activity logging records LEAD_UPDATED with concise changed fields", async () => {
    const lead = await createInitialBasicLead();

    const form = new FormData();
    form.set("name", lead.name);
    form.set("phone", lead.phone);
    form.set("business", "Unique Decor Studio");
    form.set("quotedAmount", "45000");

    const result = await updateLead(lead.id, form);
    expect(result.success).toBe(true);

    const activities = await db.leadActivity.findMany({
      where: { leadId: lead.id, type: ActivityType.LEAD_UPDATED },
      orderBy: { createdAt: "desc" },
    });

    expect(activities.length).toBeGreaterThanOrEqual(1);
    const latest = activities[0];
    expect(latest.message).toContain("business");
    expect(latest.message).toContain("quoted amount");
    const meta = latest.metadata as { changes?: string[] } | null;
    expect(meta?.changes).toContain("business");
    expect(meta?.changes).toContain("quoted amount");
  });

  it("6. Validation rules: name required, invalid email rejected, negative quote rejected", async () => {
    const lead = await createInitialBasicLead();

    // Empty name
    const formEmptyName = new FormData();
    formEmptyName.set("name", "");
    formEmptyName.set("phone", lead.phone);
    const resEmptyName = await updateLead(lead.id, formEmptyName);
    expect(resEmptyName.success).toBe(false);
    if (!resEmptyName.success) {
      expect(resEmptyName.error).toContain("Name is required");
    }

    // Invalid email
    const formInvalidEmail = new FormData();
    formInvalidEmail.set("name", lead.name);
    formInvalidEmail.set("phone", lead.phone);
    formInvalidEmail.set("email", "invalid-email-address");
    const resInvalidEmail = await updateLead(lead.id, formInvalidEmail);
    expect(resInvalidEmail.success).toBe(false);
    if (!resInvalidEmail.success) {
      expect(resInvalidEmail.error).toContain("valid email address");
    }

    // Negative quoted amount
    const formNegativeQuote = new FormData();
    formNegativeQuote.set("name", lead.name);
    formNegativeQuote.set("phone", lead.phone);
    formNegativeQuote.set("quotedAmount", "-500");
    const resNegativeQuote = await updateLead(lead.id, formNegativeQuote);
    expect(resNegativeQuote.success).toBe(false);
    if (!resNegativeQuote.success) {
      expect(resNegativeQuote.error).toContain("between 0 and");
    }
  });

  it("7. Duplicate contact awareness helper identifies conflicts on other leads", async () => {
    const leadA = await createInitialBasicLead();
    const leadB = await createInitialBasicLead();

    // Check duplicate for leadB using leadA's phone
    const duplicate = await checkLeadDuplicate(leadB.id, leadA.phone, null);
    expect(duplicate).not.toBeNull();
    expect(duplicate?.id).toBe(leadA.id);

    // Self check does not flag itself as a duplicate
    const selfDuplicate = await checkLeadDuplicate(leadA.id, leadA.phone, null);
    expect(selfDuplicate).toBeNull();
  });

  it("8. LeadDetailPanel renders Edit Details button in header and Contact & Sales Details is closed by default", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { LeadDetailPanel } = await import("@/features/leads/lead-detail-panel");
    const testLead = {
      id: "test-uuid-detail-panel",
      name: "Test Prospect",
      phone: "+91 98765 43210",
      email: "",
      business: "",
      industry: "",
      source: "",
      budget: null,
      status: "New" as const,
      quotedAmount: null,
      lastContactDate: null,
      nextFollowUpDate: null,
      notes: "",
      createdAt: "2026-09-18",
      updatedAt: "2026-09-18T10:00:00.000Z",
    };

    const React = await import("react");
    const html = renderToStaticMarkup(
      React.createElement(LeadDetailPanel, {
        lead: testLead,
        saving: false,
        onClose: () => {},
        onEdit: () => {},
        onStatusChange: async () => {},
        onDelete: async () => {},
      })
    );

    // 1. Edit Details button added in header
    expect(html).toContain("Edit Details");
    expect(html).toContain("Contact &amp; Sales Details");

    // 2. The accordion is closed by default (does not have 'open' attribute on Contact & Sales Details details tag)
    // Find the details tag enclosing Contact & Sales Details
    const detailsRegex = /<details[^>]*>[\s\S]*?Contact &amp; Sales Details[\s\S]*?<\/details>/;
    const match = html.match(detailsRegex);
    expect(match).not.toBeNull();
    if (match) {
      // It should NOT have open attribute
      expect(match[0].startsWith("<details open") || match[0].startsWith('<details class="group rounded-xl border border-[var(--border)] bg-white overflow-hidden [&_summary::-webkit-details-marker]:hidden" open')).toBe(false);
    }
  });

  it("9. EditLeadDetailsModal prefills values, shows placeholders for empty fields, and provides Cancel / Save Changes buttons", async () => {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { EditLeadDetailsModal } = await import("@/features/leads/edit-lead-details-modal");
    const testLeadWithEmptyFields = {
      id: "test-uuid-empty-fields",
      name: "Empty Prospect",
      phone: "+91 98765 11111",
      email: "",
      business: "",
      industry: "",
      source: "",
      budget: null,
      status: "New" as const,
      quotedAmount: null,
      lastContactDate: null,
      nextFollowUpDate: null,
      notes: "",
      createdAt: "2026-09-18",
      updatedAt: "2026-09-18T10:00:00.000Z",
    };

    const html = renderToStaticMarkup(
      React.createElement(EditLeadDetailsModal, {
        isOpen: true,
        lead: testLeadWithEmptyFields,
        onClose: () => {},
        onSaved: () => {},
      })
    );

    // Title
    expect(html).toContain("Edit Contact &amp; Sales Details");
    // Buttons
    expect(html).toContain("Cancel");
    expect(html).toContain("Save Changes");
    // Placeholders for empty fields
    expect(html).toContain('placeholder="client@example.com"');
    expect(html).toContain('placeholder="ABC Interiors"');
    expect(html).toContain('placeholder="Interior Design"');
    expect(html).toContain('placeholder="₹35,000"');
    // Prefilled name and phone
    expect(html).toContain('value="Empty Prospect"');
    expect(html).toContain('value="+91 98765 11111"');
    // Quoted amount vs Deal value disclaimer
    expect(html).toContain("Initial proposed quote. Kept separate from finalized Deal Value");
  });
});
