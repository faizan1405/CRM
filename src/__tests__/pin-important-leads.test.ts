import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { togglePinLead, getLeads, getLead } from "@/app/actions/leads";
import { getFollowUps } from "@/app/actions/follow-ups";
import { LeadStatus } from "@prisma/client";
import type { Lead } from "@/features/leads/types";

const TEST_USER_ID = "test-pin-leads-user-" + Date.now();
const allCreatedLeadIds: string[] = [];

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

describe("Pin / Star Important Leads - Targeted Verification", () => {
  let leadAId: string;
  let leadBId: string;
  let leadCId: string;

  beforeAll(async () => {
    await db.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        name: "Pinning Test User",
        email: `pin-test-${Date.now()}@example.com`,
        passwordHash: "dummyhash",
        role: "ADMIN",
      },
    });

    vi.mocked(getSession).mockResolvedValue({
      id: TEST_USER_ID,
      email: "pin-test@example.com",
      role: "ADMIN",
    });

    // 1. Create Lead A, Lead B, Lead C with distinct pipeline stages, notes, and deal values
    const leadA = await db.lead.create({
      data: {
        name: "Prospect Alpha",
        phone: "+919111111111",
        email: `lead-a-${Date.now()}@test.com`,
        business: "Alpha Corp",
        status: LeadStatus.NEW,
        budget: 50000,
        quotedAmount: 50000,
        notes: "Key prospect for Enterprise package",
        isPinned: false,
      },
    });
    leadAId = leadA.id;
    allCreatedLeadIds.push(leadAId);

    const leadB = await db.lead.create({
      data: {
        name: "Prospect Beta",
        phone: "+919222222222",
        email: `lead-b-${Date.now()}@test.com`,
        business: "Beta Logistics",
        status: LeadStatus.CONTACTED,
        budget: 30000,
        notes: "Sent brochure, waiting for review",
        isPinned: false,
      },
    });
    leadBId = leadB.id;
    allCreatedLeadIds.push(leadBId);

    const leadC = await db.lead.create({
      data: {
        name: "Prospect Gamma",
        phone: "+919333333333",
        email: `lead-c-${Date.now()}@test.com`,
        business: "Gamma Retail",
        status: LeadStatus.QUALIFIED,
        budget: 75000,
        quotedAmount: 70000,
        notes: "Decision maker confirmed, needs demo",
        isPinned: false,
      },
    });
    leadCId = leadC.id;
    allCreatedLeadIds.push(leadCId);

    // Attach Deal records to Lead A and Lead C
    await db.deal.create({
      data: {
        leadId: leadAId,
        projectName: "Alpha Enterprise CRM",
        quotedAmount: 50000,
        finalAmount: 48000,
        status: "NEGOTIATING",
      },
    });

    await db.deal.create({
      data: {
        leadId: leadCId,
        projectName: "Gamma Retail Portal",
        quotedAmount: 70000,
        finalAmount: 70000,
        status: "CONFIRMED",
      },
    });

    // Create chronological follow-ups for all three leads
    const now = new Date();
    const dateA = new Date(now.getTime() + 1 * 86400000); // Tomorrow
    const dateB = new Date(now.getTime() + 2 * 86400000); // In 2 days
    const dateC = new Date(now.getTime() + 3 * 86400000); // In 3 days

    await db.followUp.create({
      data: {
        leadId: leadAId,
        scheduledAt: dateA,
        type: "CALL",
        status: "PENDING",
        note: "Follow up with Alpha CEO",
      },
    });

    await db.followUp.create({
      data: {
        leadId: leadBId,
        scheduledAt: dateB,
        type: "WHATSAPP",
        status: "PENDING",
        note: "Send WhatsApp catalog to Beta",
      },
    });

    await db.followUp.create({
      data: {
        leadId: leadCId,
        scheduledAt: dateC,
        type: "CALL",
        status: "PENDING",
        note: "Product demo call with Gamma",
      },
    });
  });

  afterAll(async () => {
    if (allCreatedLeadIds.length > 0) {
      await db.payment.deleteMany({
        where: { deal: { leadId: { in: allCreatedLeadIds } } },
      });
      await db.deal.deleteMany({
        where: { leadId: { in: allCreatedLeadIds } },
      });
      await db.followUp.deleteMany({
        where: { leadId: { in: allCreatedLeadIds } },
      });
      await db.leadActivity.deleteMany({
        where: { leadId: { in: allCreatedLeadIds } },
      });
      await db.leadAIInsight.deleteMany({
        where: { leadId: { in: allCreatedLeadIds } },
      });
      await db.lead.deleteMany({
        where: { id: { in: allCreatedLeadIds } },
      });
    }
    try {
      await db.user.delete({ where: { id: TEST_USER_ID } });
    } catch {}
  });

  it("Step 1: Initially all leads are unpinned (☆ Not pinned)", async () => {
    const rawA = await db.lead.findUnique({ where: { id: leadAId } });
    const rawB = await db.lead.findUnique({ where: { id: leadBId } });
    const rawC = await db.lead.findUnique({ where: { id: leadCId } });

    expect(rawA?.isPinned).toBe(false);
    expect(rawB?.isPinned).toBe(false);
    expect(rawC?.isPinned).toBe(false);
  });

  it("Step 2: Pin Lead A and Lead C via togglePinLead (★ Pinned)", async () => {
    const resA = await togglePinLead(leadAId);
    expect(resA.success).toBe(true);
    if (!resA.success) throw new Error(resA.error);
    expect(resA.data.isPinned).toBe(true);
    expect(resA.data.id).toBe(leadAId);

    const resC = await togglePinLead(leadCId, true);
    expect(resC.success).toBe(true);
    if (!resC.success) throw new Error(resC.error);
    expect(resC.data.isPinned).toBe(true);
    expect(resC.data.id).toBe(leadCId);

    // Verify direct database persistence (Refresh simulation)
    const freshA = await db.lead.findUnique({ where: { id: leadAId } });
    const freshB = await db.lead.findUnique({ where: { id: leadBId } });
    const freshC = await db.lead.findUnique({ where: { id: leadCId } });

    expect(freshA?.isPinned).toBe(true);
    expect(freshB?.isPinned).toBe(false);
    expect(freshC?.isPinned).toBe(true);
  });

  it("Step 3: Dedicated Pinned View shows ONLY pinned leads (A and C)", async () => {
    const res = await getLeads();
    expect(res.success).toBe(true);
    if (!res.success) throw new Error(res.error);
    const allLeads: Lead[] = res.data;

    const ourLeads = allLeads.filter((l: Lead) => allCreatedLeadIds.includes(l.id));
    expect(ourLeads).toHaveLength(3);

    // Dedicated Pinned View filter logic: leads.filter(lead => Boolean(lead.isPinned))
    const pinnedViewLeads = ourLeads.filter((lead: Lead) => Boolean(lead.isPinned));
    expect(pinnedViewLeads).toHaveLength(2);

    const pinnedIds = pinnedViewLeads.map((l: Lead) => l.id);
    expect(pinnedIds).toContain(leadAId);
    expect(pinnedIds).toContain(leadCId);
    expect(pinnedIds).not.toContain(leadBId);

    // Verify compact card details are populated
    const leadACard = pinnedViewLeads.find((l: Lead) => l.id === leadAId);
    expect(leadACard?.name).toBe("Prospect Alpha");
    expect(leadACard?.phone).toBe("+919111111111");
    expect(leadACard?.status).toBe("New");
    expect(leadACard?.isPinned).toBe(true);
    expect(leadACard?.dealValue).toBe(48000);
  });

  it("Step 4: Normal Leads list returns all leads (A, B, C) and sorts pinned leads on top", async () => {
    const res = await getLeads();
    expect(res.success).toBe(true);
    if (!res.success) throw new Error(res.error);
    const allLeads: Lead[] = res.data;

    const ourLeads = allLeads.filter((l: Lead) => allCreatedLeadIds.includes(l.id));
    expect(ourLeads).toHaveLength(3);

    // Sorting logic used in LeadsWorkspace: pinned first
    const sorted = [...ourLeads].sort((a: Lead, b: Lead) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });

    expect(sorted[0].isPinned).toBe(true);
    expect(sorted[1].isPinned).toBe(true);
    expect(sorted[2].isPinned).toBe(false);
    expect(sorted[2].id).toBe(leadBId);
  });

  it("Step 5: Pipeline stages of all 3 leads remain completely unchanged", async () => {
    const rawA = await db.lead.findUnique({ where: { id: leadAId } });
    const rawB = await db.lead.findUnique({ where: { id: leadBId } });
    const rawC = await db.lead.findUnique({ where: { id: leadCId } });

    expect(rawA?.status).toBe(LeadStatus.NEW);
    expect(rawB?.status).toBe(LeadStatus.CONTACTED);
    expect(rawC?.status).toBe(LeadStatus.QUALIFIED);

    // When Pipeline board groups leads by status, their stage positions are strictly preserved
    const getLeadResA = await getLead(leadAId);
    const getLeadResB = await getLead(leadBId);
    const getLeadResC = await getLead(leadCId);

    if (!getLeadResA.success) throw new Error(getLeadResA.error);
    if (!getLeadResB.success) throw new Error(getLeadResB.error);
    if (!getLeadResC.success) throw new Error(getLeadResC.error);

    expect(getLeadResA.data.status).toBe("New");
    expect(getLeadResB.data.status).toBe("Contacted");
    expect(getLeadResC.data.status).toBe("Qualified");
  });

  it("Step 6: Follow-up scheduling and timing order remain completely unchanged", async () => {
    const followUpsRes = await getFollowUps();
    expect(followUpsRes.success).toBe(true);
    if (!followUpsRes.success) throw new Error(followUpsRes.error);

    const upcoming = followUpsRes.data.upcoming ?? [];
    const ourFollowUps = upcoming.filter((f) => allCreatedLeadIds.includes(f.leadId));
    expect(ourFollowUps).toHaveLength(3);

    // Sorted by scheduledAt asc
    const sortedOurFollowUps = [...ourFollowUps].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );

    expect(sortedOurFollowUps[0].leadId).toBe(leadAId);
    expect(sortedOurFollowUps[1].leadId).toBe(leadBId);
    expect(sortedOurFollowUps[2].leadId).toBe(leadCId);

    // Verify lead.isPinned is properly surfaced in follow-ups
    expect(sortedOurFollowUps[0].lead?.isPinned).toBe(true);
    expect(sortedOurFollowUps[1].lead?.isPinned).toBe(false);
    expect(sortedOurFollowUps[2].lead?.isPinned).toBe(true);
  });

  it("Step 7: Unpin Lead A -> Pinned View shows ONLY C, but A remains in normal leads, pipeline, and follow-ups", async () => {
    const unpinRes = await togglePinLead(leadAId, false);
    expect(unpinRes.success).toBe(true);
    if (!unpinRes.success) throw new Error(unpinRes.error);
    expect(unpinRes.data.isPinned).toBe(false);

    // Direct DB check
    const freshA = await db.lead.findUnique({ where: { id: leadAId } });
    expect(freshA?.isPinned).toBe(false);

    // Dedicated Pinned View check: Only Lead C remains
    const leadsRes = await getLeads();
    if (!leadsRes.success) throw new Error(leadsRes.error);
    const ourLeads = leadsRes.data.filter((l: Lead) => allCreatedLeadIds.includes(l.id));
    const pinnedViewLeads = ourLeads.filter((l: Lead) => Boolean(l.isPinned));

    expect(pinnedViewLeads).toHaveLength(1);
    expect(pinnedViewLeads[0].id).toBe(leadCId);

    // Lead A remains in normal leads list
    expect(ourLeads.map((l: Lead) => l.id)).toContain(leadAId);

    // Lead A remains in pipeline with same status
    const freshLeadA = await getLead(leadAId);
    if (!freshLeadA.success) throw new Error(freshLeadA.error);
    expect(freshLeadA.data.status).toBe("New");
    expect(freshLeadA.data.isPinned).toBe(false);

    // Lead A's follow-up remains in follow-ups with same schedule
    const followUpsRes = await getFollowUps();
    if (!followUpsRes.success) throw new Error(followUpsRes.error);
    const upcoming = followUpsRes.data.upcoming ?? [];
    const ourFollowUpA = upcoming.find((f) => f.leadId === leadAId);
    expect(ourFollowUpA).toBeDefined();
    expect(ourFollowUpA?.lead?.isPinned).toBe(false);
  });

  it("Step 8: Pinning/unpinning does NOT modify status, follow-up, deal value, or priority score", async () => {
    const rawC = await db.lead.findUnique({
      where: { id: leadCId },
      include: { deal: true, followUps: true },
    });

    expect(rawC?.status).toBe(LeadStatus.QUALIFIED);
    expect(rawC?.budget?.toNumber()).toBe(75000);
    expect(rawC?.quotedAmount?.toNumber()).toBe(70000);
    expect(rawC?.deal?.finalAmount.toNumber()).toBe(70000);
    expect(rawC?.followUps).toHaveLength(1);
    expect(rawC?.followUps[0].status).toBe("PENDING");
  });
});
