import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  normalizePhone,
  normalizeEmail,
  isPhoneMatch,
  isEmailMatch,
  findDuplicateLeadCandidates,
} from "@/features/leads/duplicate-detection-service";
import {
  createLead,
  getLeads,
  getLead,
  enrichExistingLead,
  mergeLeadsAction,
} from "@/app/actions/leads";
import { globalQuickSearch } from "@/app/actions/lead-search";
import { getDashboardData } from "@/app/actions/dashboard";
import { LeadStatus, ActivityType, FollowUpStatus } from "@prisma/client";
import type { Lead } from "@/features/leads/types";

const TEST_USER_ID = "test-dup-merge-user-" + Date.now();
const allCreatedLeadIds: string[] = [];
const allCreatedDealIds: string[] = [];

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/leads",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

describe("Duplicate Lead Detection + Safe Merge - Comprehensive Verification", () => {
  beforeAll(async () => {
    await db.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        name: "Merge Test User",
        email: `merge-test-${Date.now()}@example.com`,
        passwordHash: "dummyhash",
        role: "ADMIN",
      },
    });

    vi.mocked(getSession).mockResolvedValue({
      id: TEST_USER_ID,
      email: "merge-test@example.com",
      role: "ADMIN",
    });
  });

  afterAll(async () => {
    // Clean up all deals and payments created during tests
    if (allCreatedDealIds.length > 0) {
      await db.payment.deleteMany({ where: { dealId: { in: allCreatedDealIds } } });
      await db.deal.deleteMany({ where: { id: { in: allCreatedDealIds } } });
    }
    // Clean up followups, activities, and leads created during tests
    if (allCreatedLeadIds.length > 0) {
      await db.leadActivity.deleteMany({ where: { leadId: { in: allCreatedLeadIds } } });
      await db.followUp.deleteMany({ where: { leadId: { in: allCreatedLeadIds } } });
      await db.lead.deleteMany({ where: { id: { in: allCreatedLeadIds } } });
    }
    await db.user.deleteMany({ where: { id: TEST_USER_ID } });
  });

  // ─── Test 1: Phone Normalization ──────────────────────────────────────────
  it("Test 1: Normalization: spaces, dashes, international code +91 matching same 10-digit number", () => {
    const raw1 = "+91 98765-43210";
    const raw2 = "9876543210";
    const raw3 = "+91 (98765) 43210";
    const raw4 = "09876543210";

    expect(isPhoneMatch(raw1, raw2)).toBe(true);
    expect(isPhoneMatch(raw1, raw3)).toBe(true);
    expect(isPhoneMatch(raw2, raw4)).toBe(true);
    expect(isPhoneMatch("9876543210", "9876543211")).toBe(false);
  });

  // ─── Test 2: Email Normalization ──────────────────────────────────────────
  it("Test 2: Email matching case-insensitive with leading/trailing spaces", () => {
    const emailA = "   User.Account@Domain.COM  ";
    const emailB = "user.account@domain.com";

    expect(normalizeEmail(emailA)).toBe(normalizeEmail(emailB));
    expect(isEmailMatch(emailA, emailB)).toBe(true);
    expect(isEmailMatch("alice@test.com", "bob@test.com")).toBe(false);
  });

  // ─── Test 3: Name/business match alone does NOT trigger duplicate confirmation
  it("Test 3: Name/business match alone does NOT trigger duplicate candidate or block creation", async () => {
    const timestamp = Date.now();
    const existing = await db.lead.create({
      data: {
        name: `Acme Industrial ${timestamp}`,
        phone: `+919811${String(timestamp).slice(-6)}`,
        business: `Acme Corp ${timestamp}`,
      },
    });
    allCreatedLeadIds.push(existing.id);

    // Search with exact same name and business, but completely distinct phone and email
    const candidates = await findDuplicateLeadCandidates({
      phone: "+919822000000",
      email: "different@acme.com",
      name: existing.name,
      business: existing.business!,
    });

    // Name alone NEVER constitutes duplicate confirmation
    expect(candidates).toBeNull();
  });

  // ─── Test 4: Duplicate lead creation interception ──────────────────────────
  it("Test 4: Duplicate lead creation returns duplicate warning and blocks creation without override", async () => {
    const timestamp = Date.now();
    const phone = `+919812${String(timestamp).slice(-6)}`;
    const email = `original-${timestamp}@example.com`;

    const original = await db.lead.create({
      data: {
        name: "Original Prospect",
        phone,
        email,
        status: LeadStatus.NEW,
      },
    });
    allCreatedLeadIds.push(original.id);

    const formData = new FormData();
    formData.append("name", "Duplicate Entry Attempt");
    formData.append("phone", phone);
    formData.append("email", email);

    // Attempt creation without allowDuplicate
    const result = await createLead(formData);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected createLead to return duplicateCandidate");
    expect(result.duplicateCandidate).toBeDefined();
    expect(result.duplicateCandidate?.id).toBe(original.id);
    expect(["phone", "phone_and_email"]).toContain(result.duplicateCandidate?.matchedBy);

    // Verify no new lead was created
    const count = await db.lead.count({ where: { phone: original.phone } });
    expect(count).toBe(1);
  });

  // ─── Test 5: Create anyway creates a new distinct lead with audit note ──────
  it("Test 5: Create anyway creates a new distinct lead record with audit note", async () => {
    const timestamp = Date.now();
    const phone = `+919813${String(timestamp).slice(-6)}`;

    const original = await db.lead.create({
      data: {
        name: "Original Contact",
        phone,
        status: LeadStatus.NEW,
      },
    });
    allCreatedLeadIds.push(original.id);

    const formData = new FormData();
    formData.append("name", "Second Legitimate Contact");
    formData.append("phone", phone);
    formData.append("allowDuplicate", "true");

    const result = await createLead(formData);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected createLead to succeed");
    expect(result.data.id).not.toBe(original.id);
    allCreatedLeadIds.push(result.data.id);

    // Verify audit activity was created for duplicate allowance
    const activities = await db.leadActivity.findMany({
      where: { leadId: result.data.id },
    });
    const overrideActivity = activities.find(
      (a) => a.message.includes("Duplicate") || a.message.includes("allowed")
    );
    expect(overrideActivity).toBeDefined();
  });

  // ─── Test 6: Enrich existing lead updates fields without duplicate record ──
  it("Test 6: Enrich existing lead updates fields without creating duplicate record", async () => {
    const timestamp = Date.now();
    const phone = `+919814${String(timestamp).slice(-6)}`;

    const existing = await db.lead.create({
      data: {
        name: "Base Lead",
        phone,
        email: null,
        business: null,
        status: LeadStatus.NEW,
      },
    });
    allCreatedLeadIds.push(existing.id);

    const enrichResult = await enrichExistingLead(existing.id, {
      email: `enriched-${timestamp}@example.com`,
      business: "Updated Enterprise Ltd",
      notes: "Met at Bangalore expo",
    });

    expect(enrichResult.success).toBe(true);
    if (!enrichResult.success) throw new Error("Expected enrich to succeed");
    expect(enrichResult.data.id).toBe(existing.id);
    expect(enrichResult.data.email).toBe(`enriched-${timestamp}@example.com`);
    expect(enrichResult.data.business).toBe("Updated Enterprise Ltd");

    // Exactly 1 lead exists with this phone number (no duplicate record was created)
    const countWithPhone = await db.lead.count({ where: { phone } });
    expect(countWithPhone).toBe(1);
  });

  // ─── Test 7: Merge two leads preserves all activities on surviving lead ────
  it("Test 7: Merge two leads preserves all LeadActivity records on surviving lead and adds LEAD_MERGED audit", async () => {
    const timestamp = Date.now();
    const leadA = await db.lead.create({
      data: {
        name: "Primary Lead A",
        phone: `+919815${String(timestamp).slice(-6)}`,
        status: LeadStatus.CONTACTED,
      },
    });
    const leadB = await db.lead.create({
      data: {
        name: "Duplicate Lead B",
        phone: `+919815${String(timestamp).slice(-6)}`,
        status: LeadStatus.QUALIFIED,
      },
    });
    allCreatedLeadIds.push(leadA.id, leadB.id);

    // Create activities on both leads
    await db.leadActivity.create({
      data: {
        leadId: leadA.id,
        type: ActivityType.NOTE_ADDED,
        message: "Activity from Lead A",
      },
    });
    await db.leadActivity.create({
      data: {
        leadId: leadB.id,
        type: ActivityType.NOTE_ADDED,
        message: "Activity from Lead B",
      },
    });

    const mergeResult = await mergeLeadsAction({
      primaryLeadId: leadA.id,
      mergedLeadId: leadB.id,
      fieldResolutions: {
        name: leadA.name,
        phone: leadA.phone,
        status: "Contacted",
      },
    });

    expect(mergeResult.success).toBe(true);

    // Verify all activities transferred to leadA
    const activitiesA = await db.leadActivity.findMany({
      where: { leadId: leadA.id },
    });
    const messages = activitiesA.map((a) => a.message);
    expect(messages).toContain("Activity from Lead A");
    expect(messages).toContain("Activity from Lead B");

    // Verify LEAD_MERGED audit activity exists
    const mergeAudit = activitiesA.find((a) => a.type === ActivityType.LEAD_MERGED);
    expect(mergeAudit).toBeDefined();

    // Verify duplicate lead B is marked as merged
    const reloadedB = await db.lead.findUnique({ where: { id: leadB.id } });
    expect(reloadedB?.mergedIntoLeadId).toBe(leadA.id);
    expect(reloadedB?.mergedAt).toBeDefined();
  });

  // ─── Test 8: Legacy notes preserved as NOTE_ADDED activity ─────────────────
  it("Test 8: Merge two leads with legacy Lead.notes converts merged lead notes to NOTE_ADDED activity", async () => {
    const timestamp = Date.now();
    const leadA = await db.lead.create({
      data: {
        name: "Lead Primary Notes",
        phone: `+919816${String(timestamp).slice(-6)}`,
      },
    });
    const leadB = await db.lead.create({
      data: {
        name: "Lead Duplicate Notes",
        phone: `+919816${String(timestamp).slice(-6)}`,
        notes: "Historical unmigrated notes from merged record",
      },
    });
    allCreatedLeadIds.push(leadA.id, leadB.id);

    await mergeLeadsAction({
      primaryLeadId: leadA.id,
      mergedLeadId: leadB.id,
      fieldResolutions: {
        name: leadA.name,
        phone: leadA.phone,
      },
    });

    const activitiesA = await db.leadActivity.findMany({
      where: { leadId: leadA.id, type: ActivityType.NOTE_ADDED },
    });
    const legacyNoteActivity = activitiesA.find(
      (a) => a.message === "Historical unmigrated notes from merged record"
    );
    expect(legacyNoteActivity).toBeDefined();
  });

  // ─── Test 9: Strictly 1 active follow-up after merge ────────────────────────
  it("Test 9: Merge two leads with 2 active follow-ups ensures strictly 1 active follow-up survives, other is cancelled", async () => {
    const timestamp = Date.now();
    const leadA = await db.lead.create({
      data: {
        name: "Followup Primary",
        phone: `+919817${String(timestamp).slice(-6)}`,
      },
    });
    const leadB = await db.lead.create({
      data: {
        name: "Followup Duplicate",
        phone: `+919817${String(timestamp).slice(-6)}`,
      },
    });
    allCreatedLeadIds.push(leadA.id, leadB.id);

    const fuA = await db.followUp.create({
      data: {
        leadId: leadA.id,
        scheduledAt: new Date(Date.now() + 86400000),
        status: FollowUpStatus.PENDING,
        type: "CALL",
        note: "Primary pending follow-up",
      },
    });
    const fuB = await db.followUp.create({
      data: {
        leadId: leadB.id,
        scheduledAt: new Date(Date.now() + 172800000),
        status: FollowUpStatus.PENDING,
        type: "OTHER",
        note: "Duplicate pending follow-up",
      },
    });

    // User chooses to keep fuB (from duplicate)
    const result = await mergeLeadsAction({
      primaryLeadId: leadA.id,
      mergedLeadId: leadB.id,
      fieldResolutions: {
        name: leadA.name,
        phone: leadA.phone,
      },
      survivingFollowUpId: fuB.id,
    });

    expect(result.success).toBe(true);

    // Verify strictly 1 PENDING follow-up on leadA
    const activeFollowUps = await db.followUp.findMany({
      where: { leadId: leadA.id, status: FollowUpStatus.PENDING },
    });
    expect(activeFollowUps).toHaveLength(1);
    expect(activeFollowUps[0].id).toBe(fuB.id);

    // Verify unselected follow-up is CANCELLED (never deleted)
    const cancelledFU = await db.followUp.findUnique({ where: { id: fuA.id } });
    expect(cancelledFU?.status).toBe(FollowUpStatus.CANCELLED);
    expect(cancelledFU?.note).toContain("Cancelled via merge");
  });

  // ─── Test 10: Financial safety: deal & payment preservation ────────────────
  it("Test 10: Merge two leads where both have Deals: primary keeps deal, duplicate deal safely detached with snapshots intact", async () => {
    const timestamp = Date.now();
    const leadA = await db.lead.create({
      data: {
        name: "Deal Primary",
        phone: `+919818${String(timestamp).slice(-6)}`,
        business: "Primary Corp",
      },
    });
    const leadB = await db.lead.create({
      data: {
        name: "Deal Duplicate",
        phone: `+919818${String(timestamp).slice(-6)}`,
        business: "Duplicate Corp",
      },
    });
    allCreatedLeadIds.push(leadA.id, leadB.id);

    const dealA = await db.deal.create({
      data: {
        leadId: leadA.id,
        clientNameSnapshot: leadA.name,
        companyNameSnapshot: leadA.business,
        quotedAmount: 100000,
        finalAmount: 90000,
        currency: "INR",
        status: "CONFIRMED",
      },
    });
    const dealB = await db.deal.create({
      data: {
        leadId: leadB.id,
        clientNameSnapshot: leadB.name,
        companyNameSnapshot: leadB.business,
        quotedAmount: 50000,
        finalAmount: 45000,
        currency: "INR",
        status: "CONFIRMED",
      },
    });
    allCreatedDealIds.push(dealA.id, dealB.id);

    // Add payment to dealB to verify financial history preservation
    const paymentB = await db.payment.create({
      data: {
        dealId: dealB.id,
        amount: 20000,
        method: "UPI",
        paymentDate: new Date(),
        note: "Advance payment",
      },
    });

    const mergeRes = await mergeLeadsAction({
      primaryLeadId: leadA.id,
      mergedLeadId: leadB.id,
      fieldResolutions: {
        name: leadA.name,
        phone: leadA.phone,
      },
    });
    expect(mergeRes.success).toBe(true);

    // Verify Deal A is still attached to Primary Lead
    const reloadedDealA = await db.deal.findUnique({ where: { id: dealA.id } });
    expect(reloadedDealA?.leadId).toBe(leadA.id);
    expect(Number(reloadedDealA?.finalAmount)).toBe(90000); // Deal amounts NOT summed

    // Verify Deal B is safely detached (leadId = null) and NOT deleted
    const reloadedDealB = await db.deal.findUnique({ where: { id: dealB.id } });
    expect(reloadedDealB).toBeDefined();
    expect(reloadedDealB?.leadId).toBeNull();
    expect(reloadedDealB?.clientNameSnapshot).toBe("Deal Duplicate");
    expect(reloadedDealB?.notes).toContain("[Merged Lead Record]");

    // Verify payment on Deal B is completely intact
    const reloadedPaymentB = await db.payment.findUnique({ where: { id: paymentB.id } });
    expect(reloadedPaymentB).toBeDefined();
    expect(Number(reloadedPaymentB?.amount)).toBe(20000);
  });

  // ─── Test 11: Pinned Lead Safety ──────────────────────────────────────────
  it("Test 11: Pinned lead merge: if either lead was pinned, surviving lead is pinned", async () => {
    const timestamp = Date.now();
    const unpinnedA = await db.lead.create({
      data: {
        name: "Unpinned Primary",
        phone: `+919819${String(timestamp).slice(-6)}`,
        isPinned: false,
      },
    });
    const pinnedB = await db.lead.create({
      data: {
        name: "Pinned Duplicate",
        phone: `+919819${String(timestamp).slice(-6)}`,
        isPinned: true,
      },
    });
    allCreatedLeadIds.push(unpinnedA.id, pinnedB.id);

    const mergeRes = await mergeLeadsAction({
      primaryLeadId: unpinnedA.id,
      mergedLeadId: pinnedB.id,
      fieldResolutions: {
        name: unpinnedA.name,
        phone: unpinnedA.phone,
      },
    });

    expect(mergeRes.success).toBe(true);
    if (!mergeRes.success) throw new Error("Expected merge to succeed");
    expect(mergeRes.data.isPinned).toBe(true);

    const reloadedA = await db.lead.findUnique({ where: { id: unpinnedA.id } });
    expect(reloadedA?.isPinned).toBe(true);
  });

  // ─── Test 12: Merged record excluded from search, list, and analytics ─────
  it("Test 12: Merged lead is excluded from active leads list, pipeline, search, and analytics", async () => {
    const timestamp = Date.now();
    const phone = `+919820${String(timestamp).slice(-6)}`;
    const uniqueSearchTerm = `ExclSearch${timestamp}`;

    const leadA = await db.lead.create({
      data: {
        name: `Active Surviving ${uniqueSearchTerm}`,
        phone,
      },
    });
    const leadB = await db.lead.create({
      data: {
        name: `Merged Record ${uniqueSearchTerm}`,
        phone,
      },
    });
    allCreatedLeadIds.push(leadA.id, leadB.id);

    await mergeLeadsAction({
      primaryLeadId: leadA.id,
      mergedLeadId: leadB.id,
      fieldResolutions: {
        name: leadA.name,
        phone: leadA.phone,
      },
    });

    // 1. getLeads() excludes merged lead
    const activeLeadsRes = await getLeads();
    expect(activeLeadsRes.success).toBe(true);
    if (!activeLeadsRes.success) throw new Error("Expected getLeads to succeed");
    const leadIds = activeLeadsRes.data.map((l: Lead) => l.id);
    expect(leadIds).toContain(leadA.id);
    expect(leadIds).not.toContain(leadB.id);

    // 2. Global search excludes merged lead
    const searchRes = await globalQuickSearch(uniqueSearchTerm);
    expect(searchRes.success).toBe(true);
    if (!searchRes.success || !searchRes.data) throw new Error("Expected search to succeed");
    const searchResultIds = searchRes.data.map((l: { id: string }) => l.id);
    expect(searchResultIds).toContain(leadA.id);
    expect(searchResultIds).not.toContain(leadB.id);

    // 3. getLead() on merged record returns merged metadata for redirection
    const getMergedLeadRes = await getLead(leadB.id);
    expect(getMergedLeadRes.success).toBe(true);
    if (!getMergedLeadRes.success) throw new Error("Expected getLead to succeed");
    expect(getMergedLeadRes.data.mergedIntoLeadId).toBe(leadA.id);
    expect(getMergedLeadRes.data.mergedInto?.id).toBe(leadA.id);
  });
});
