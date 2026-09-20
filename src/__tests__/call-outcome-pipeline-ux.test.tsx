import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/app/actions/activities";
import { changeLeadStatus, getLead } from "@/app/actions/leads";
import { getFollowUpSuggestion } from "@/lib/follow-up-suggestions";
import { CallOutcomeModal } from "@/components/call-outcome-modal";
import { ChangeStatusSheet } from "@/features/leads/change-status-sheet";
import { leadStatuses, type Lead, type LeadStatus } from "@/features/leads/types";
import { LeadStatus as PrismaLeadStatus } from "@prisma/client";

const TEST_USER_ID = "test-call-outcome-pipeline-ux-user";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/components/toast-provider", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

describe("Call Outcome + Pipeline Status UX Simplification", () => {
  const createdLeadIds: string[] = [];

  beforeAll(async () => {
    await db.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        name: "Call Outcome Tester",
        email: "call-outcome-ux@example.com",
        passwordHash: "dummyhash",
        role: "ADMIN",
      },
    });

    vi.mocked(getSession).mockResolvedValue({
      id: TEST_USER_ID,
      email: "call-outcome-ux@example.com",
      role: "ADMIN",
    });
  });

  afterAll(async () => {
    if (createdLeadIds.length > 0) {
      await db.followUp.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadActivity.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadAIInsight.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
    }
    await db.user.delete({ where: { id: TEST_USER_ID } }).catch(() => {});
  });

  async function createTestLead(nameSuffix: string, status: PrismaLeadStatus = PrismaLeadStatus.NEW) {
    const lead = await db.lead.create({
      data: {
        name: `Test Lead ${nameSuffix}`,
        phone: `+91 99887 ${Math.floor(10000 + Math.random() * 90000)}`,
        business: "Test Business",
        status,
      },
    });
    createdLeadIds.push(lead.id);
    return lead;
  }

  // TEST 1: Canonical Lead.status has only 6 statuses, not call outcomes
  it("ONE CANONICAL Lead.status: only NEW, CONTACTED, QUALIFIED, PROPOSAL_SENT, WON, LOST", () => {
    expect(leadStatuses).toEqual([
      "New",
      "Contacted",
      "Qualified",
      "Proposal Sent",
      "Won",
      "Lost",
    ]);
    expect(leadStatuses).not.toContain("Picked");
    expect(leadStatuses).not.toContain("Not Picked");
    expect(leadStatuses).not.toContain("Interested");
    expect(leadStatuses).not.toContain("Call Back");
    expect(leadStatuses).not.toContain("NOT_PICKED");
    expect(leadStatuses).not.toContain("CALL_BACK");
    expect(leadStatuses).not.toContain("INTERESTED");
  });

  // TEST 2: Labels implemented (Call Outcome & Pipeline Status)
  it("CALL OUTCOME & PIPELINE STATUS LABELS: Consistent UI terminology", () => {
    const dummyLead: Lead = {
      id: "dummy-lead-labels",
      name: "Acme Corp",
      phone: "+91 99999 00000",
      email: "acme@example.com",
      business: "Acme Inc",
      industry: "Tech",
      source: "Web",
      budget: 10000,
      status: "New",
      quotedAmount: null,
      lastContactDate: null,
      nextFollowUpDate: null,
      notes: "",
      createdAt: "2026-09-20",
      updatedAt: "2026-09-20",
    };

    // CallOutcomeModal renders "Call Outcome"
    const callModalHtml = renderToStaticMarkup(
      <CallOutcomeModal
        isOpen={true}
        lead={dummyLead}
        onClose={vi.fn()}
      />
    );
    expect(callModalHtml).toContain("Call Outcome");

    // ChangeStatusSheet renders "Pipeline Status"
    const changeStatusHtml = renderToStaticMarkup(
      <ChangeStatusSheet
        isOpen={true}
        currentStatus="New"
        onClose={vi.fn()}
        onSelectStatus={vi.fn()}
      />
    );
    expect(changeStatusHtml).toContain("Pipeline Status");
    expect(changeStatusHtml).toContain("Current:");
  });

  // TEST 3: NEW lead → Call → Not Picked
  it("NEW lead → Call → Not Picked: logs call outcome, keeps NEW status, suggests Tomorrow follow-up", async () => {
    const lead = await createTestLead("NotPickedFlow", PrismaLeadStatus.NEW);

    // 1. Log outcome
    await logActivity(lead.id, "LEAD_UPDATED", "Call not picked");

    // 2. Verify lead status remains NEW in database
    const refreshed = await db.lead.findUnique({ where: { id: lead.id } });
    expect(refreshed?.status).toBe(PrismaLeadStatus.NEW);

    // 3. Verify smart follow-up suggests Tomorrow
    const suggestion = getFollowUpSuggestion("NOT_PICKED");
    expect(suggestion.displayDateLabel).toBe("Tomorrow");
    expect(suggestion.presetId).toBe("tomorrow");

    // 4. Verify activity log entry
    const activities = await db.leadActivity.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "desc" },
    });
    expect(activities.some((a) => a.message === "Call not picked")).toBe(true);
  });

  // TEST 4: NEW lead → Call → Picked → Mark Contacted (Optional Flow)
  it("NEW lead → Call → Picked → Mark Contacted: logs outcome and updates status to CONTACTED", async () => {
    const lead = await createTestLead("PickedMarkContacted", PrismaLeadStatus.NEW);

    // 1. Log call outcome
    await logActivity(lead.id, "LEAD_UPDATED", "Call picked");

    // 2. User chooses "Mark Contacted"
    const changeResult = await changeLeadStatus(lead.id, "Contacted");
    expect(changeResult.success).toBe(true);

    // 3. Verify DB status is CONTACTED
    const inDb = await db.lead.findUnique({ where: { id: lead.id } });
    expect(inDb?.status).toBe(PrismaLeadStatus.CONTACTED);

    // 4. Verify separate auditable activities exist
    const activities = await db.leadActivity.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "asc" },
    });
    const messages = activities.map((a) => a.message);
    expect(messages).toContain("Call picked");
    expect(messages.some((m) => m.includes("Status changed from New to Contacted"))).toBe(true);
  });

  // TEST 5: NEW lead → Call → Picked → Keep New (Optional Flow keeps NEW)
  it("NEW lead → Call → Picked → Keep New: logs outcome without altering status", async () => {
    const lead = await createTestLead("PickedKeepNew", PrismaLeadStatus.NEW);

    // Log call outcome
    await logActivity(lead.id, "LEAD_UPDATED", "Call picked");

    // User chooses "Keep New" -> status is NOT changed
    const inDb = await db.lead.findUnique({ where: { id: lead.id } });
    expect(inDb?.status).toBe(PrismaLeadStatus.NEW);
  });

  // TEST 6: CONTACTED → Call → Interested → Mark Qualified
  it("CONTACTED → Call → Interested → Mark Qualified: logs outcome, updates status to QUALIFIED, suggests +2 Days", async () => {
    const lead = await createTestLead("InterestedMarkQualified", PrismaLeadStatus.CONTACTED);

    // 1. Log call outcome
    await logActivity(lead.id, "LEAD_UPDATED", "Call picked — Interested");

    // 2. User chooses "Mark Qualified"
    const changeResult = await changeLeadStatus(lead.id, "Qualified");
    expect(changeResult.success).toBe(true);

    // 3. Verify DB status is QUALIFIED
    const inDb = await db.lead.findUnique({ where: { id: lead.id } });
    expect(inDb?.status).toBe(PrismaLeadStatus.QUALIFIED);

    // 4. Verify follow-up suggestion is +2 Days
    const suggestion = getFollowUpSuggestion("INTERESTED");
    expect(suggestion.displayDateLabel).toBe("+2 Days");
    expect(suggestion.presetId).toBe("+2");

    // 5. Verify separate auditable activities exist
    const activities = await db.leadActivity.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "asc" },
    });
    const messages = activities.map((a) => a.message);
    expect(messages).toContain("Call picked — Interested");
    expect(messages.some((m) => m.includes("Status changed from Contacted to Qualified"))).toBe(true);
  });

  // TEST 7: QUALIFIED → Call Back: requires exact callback date/time & keeps QUALIFIED
  it("QUALIFIED → Call Back: logs Call Back, requires exact date/time, lead remains QUALIFIED", async () => {
    const lead = await createTestLead("CallBackLead", PrismaLeadStatus.QUALIFIED);

    // 1. Log outcome
    await logActivity(lead.id, "LEAD_UPDATED", "Call Back");

    // 2. Verify lead remains QUALIFIED
    const inDb = await db.lead.findUnique({ where: { id: lead.id } });
    expect(inDb?.status).toBe(PrismaLeadStatus.QUALIFIED);

    // 3. Verify suggestion requires exact date/time
    const suggestion = getFollowUpSuggestion("CALL_BACK");
    expect(suggestion.requiresExactDateTime).toBe(true);
    expect(suggestion.displayDateLabel).toBe("Choose callback date");

    // 4. Verify no pipeline status named Call Back can be set
    const invalidResult = await changeLeadStatus(lead.id, "Call Back" as any);
    expect(invalidResult.success).toBe(false);
  });

  // TEST 8: Activity History records separate auditable events
  it("ACTIVITY HISTORY: Preserves separate auditable events for calls and pipeline updates", async () => {
    const lead = await createTestLead("ActivityAuditing", PrismaLeadStatus.NEW);

    // Event 1: Call not picked
    await logActivity(lead.id, "LEAD_UPDATED", "Call not picked");

    // Event 2: Call picked - Interested
    await logActivity(lead.id, "LEAD_UPDATED", "Call picked — Interested");

    // Event 3: Status changed: Contacted -> Qualified
    await changeLeadStatus(lead.id, "Contacted");
    await changeLeadStatus(lead.id, "Qualified");

    const activities = await db.leadActivity.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: "asc" },
    });

    const messages = activities.map((a) => a.message);
    expect(messages).toContain("Call not picked");
    expect(messages).toContain("Call picked — Interested");
    expect(messages.some((m) => m.includes("Status changed from New to Contacted"))).toBe(true);
    expect(messages.some((m) => m.includes("Status changed from Contacted to Qualified"))).toBe(true);
  });
});
