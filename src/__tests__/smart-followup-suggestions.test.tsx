import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { scheduleLeadFollowUp } from "@/app/actions/follow-ups";
import { logActivity } from "@/app/actions/activities";
import { changeLeadStatus, getLead } from "@/app/actions/leads";
import {
  getFollowUpSuggestion,
  getActiveFutureFollowUp,
  formatFollowUpWarning,
  formatTimeIST,
} from "@/lib/follow-up-suggestions";
import { getPresetDate, DEFAULT_TIME } from "@/lib/date-presets";
import { FollowUpForm } from "@/features/followups/follow-up-form";
import { CallOutcomeModal } from "@/components/call-outcome-modal";
import type { Lead, LeadStatus } from "@/features/leads/types";

const TEST_USER_ID = "test-smart-followup-user";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

// Mock toast provider
vi.mock("@/components/toast-provider", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

describe("Smart Follow-up Suggestions & Duplicate Protection", () => {
  const createdLeadIds: string[] = [];

  beforeAll(async () => {
    await db.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        name: "Smart Followup Tester",
        email: "smart-followup@example.com",
        passwordHash: "dummyhash",
        role: "ADMIN",
      },
    });

    vi.mocked(getSession).mockResolvedValue({
      id: TEST_USER_ID,
      email: "smart-followup@example.com",
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

  async function createTestLead(nameSuffix: string, status: string = "NEW") {
    const lead = await db.lead.create({
      data: {
        name: `Smart Lead ${nameSuffix}`,
        phone: `+91 98765 ${Math.floor(10000 + Math.random() * 90000)}`,
        business: "Smart Business",
        status: status as any,
      },
    });
    createdLeadIds.push(lead.id);
    return lead;
  }

  // 1. Centralized Rules Unit Tests
  describe("1. Centralized Rules in One Utility", () => {
    it("NOT PICKED → suggests Tomorrow (1 day added, preset 'tomorrow')", () => {
      const suggestion = getFollowUpSuggestion("NOT_PICKED");
      expect(suggestion.outcome).toBe("NOT_PICKED");
      expect(suggestion.presetId).toBe("tomorrow");
      expect(suggestion.daysToAdd).toBe(1);
      expect(suggestion.suggestedDate).toBe(getPresetDate(1));
      expect(suggestion.suggestedTime).toBe(DEFAULT_TIME);
      expect(suggestion.displayDateLabel).toBe("Tomorrow");
      expect(suggestion.requiresExactDateTime).toBe(false);
    });

    it("INTERESTED → suggests +2 Days (2 days added, preset '+2')", () => {
      const suggestion = getFollowUpSuggestion("INTERESTED");
      expect(suggestion.outcome).toBe("INTERESTED");
      expect(suggestion.presetId).toBe("+2");
      expect(suggestion.daysToAdd).toBe(2);
      expect(suggestion.suggestedDate).toBe(getPresetDate(2));
      expect(suggestion.suggestedTime).toBe(DEFAULT_TIME);
      expect(suggestion.displayDateLabel).toBe("+2 Days");
      expect(suggestion.requiresExactDateTime).toBe(false);
    });

    it("PROPOSAL SENT → suggests +3 Days (3 days added, preset '+3')", () => {
      const suggestion = getFollowUpSuggestion("PROPOSAL_SENT");
      expect(suggestion.outcome).toBe("PROPOSAL_SENT");
      expect(suggestion.presetId).toBe("+3");
      expect(suggestion.daysToAdd).toBe(3);
      expect(suggestion.suggestedDate).toBe(getPresetDate(3));
      expect(suggestion.suggestedTime).toBe(DEFAULT_TIME);
      expect(suggestion.displayDateLabel).toBe("+3 Days");
      expect(suggestion.requiresExactDateTime).toBe(false);
    });

    it("CALL BACK → requires exact date and time (no silent default)", () => {
      const suggestion = getFollowUpSuggestion("CALL_BACK");
      expect(suggestion.outcome).toBe("CALL_BACK");
      expect(suggestion.presetId).toBeNull();
      expect(suggestion.daysToAdd).toBeNull();
      expect(suggestion.suggestedDate).toBe("");
      expect(suggestion.requiresExactDateTime).toBe(true);
      expect(suggestion.displayDateLabel).toBe("Choose callback date");
    });

    it("Preserves explicitly selected time in IST", () => {
      const suggestion = getFollowUpSuggestion("NOT_PICKED", "14:45");
      expect(suggestion.suggestedTime).toBe("14:45");
      expect(suggestion.displayFullLabel).toContain("2:45 PM");
    });
  });

  // 2. No Auto-Scheduling Without User Confirmation
  describe("2. No Auto-Scheduling Without Confirmation", () => {
    it("Logging NOT_PICKED outcome logs activity but does NOT auto-schedule follow-up", async () => {
      const lead = await createTestLead("NotPickedNoAuto");

      // Verify no follow-up initially
      const countBefore = await db.followUp.count({ where: { leadId: lead.id } });
      expect(countBefore).toBe(0);

      // Log activity for call not picked
      await logActivity(lead.id, "LEAD_UPDATED", "Call not picked");

      // Suggestion generated
      const suggestion = getFollowUpSuggestion("NOT_PICKED");
      expect(suggestion.displayDateLabel).toBe("Tomorrow");

      // Verify still NO follow-up row created until user confirms
      const countAfter = await db.followUp.count({ where: { leadId: lead.id } });
      expect(countAfter).toBe(0);

      // Also verify canonical status is preserved
      const refreshed = await db.lead.findUnique({ where: { id: lead.id } });
      expect(refreshed?.status).toBe("NEW");
    });

    it("INTERESTED remains contextual call outcome and does NOT create canonical pipeline status called Interested", async () => {
      const lead = await createTestLead("InterestedNoStatus", "CONTACTED");

      await logActivity(lead.id, "LEAD_UPDATED", "Call picked - Interested");

      const refreshed = await db.lead.findUnique({ where: { id: lead.id } });
      expect(refreshed?.status).toBe("CONTACTED");

      // Check DB count: no automatic follow-up without confirmation
      const count = await db.followUp.count({ where: { leadId: lead.id } });
      expect(count).toBe(0);
    });

    it("PROPOSAL_SENT status change generates +3 Days suggestion without silently saving follow-up", async () => {
      const lead = await createTestLead("ProposalSentLead");

      const result = await changeLeadStatus(lead.id, "Proposal Sent" as LeadStatus);
      expect(result.success).toBe(true);

      const suggestion = getFollowUpSuggestion("PROPOSAL_SENT");
      expect(suggestion.daysToAdd).toBe(3);

      // Verify no follow-up was automatically saved in the database
      const count = await db.followUp.count({ where: { leadId: lead.id } });
      expect(count).toBe(0);
    });
  });

  // 3. Duplicate Protection & Warning
  describe("3. Duplicate Protection & Warning", () => {
    it("Warns about existing future follow-up and formats date in IST e.g. 'Existing follow-up scheduled for 22 Sep, 3:00 PM.'", () => {
      // 2026-09-22 at 15:00:00 IST (+05:30)
      const scheduledIso = "2026-09-22T15:00:00+05:30";
      const warning = formatFollowUpWarning(scheduledIso);
      expect(warning).toBe("Existing follow-up scheduled for 22 Sep, 3:00 PM.");
    });

    it("Allows Replace/Reschedule without creating duplicate follow-up row", async () => {
      const lead = await createTestLead("ReschedulePoint");

      // 1st follow-up for tomorrow
      const res1 = await scheduleLeadFollowUp({
        leadId: lead.id,
        scheduledAt: `${getPresetDate(1)}T10:00:00+05:30`,
        type: "Call",
        submissionId: "sub-1-unique",
      });
      expect(res1.success).toBe(true);
      const existingId = res1.data?.id;

      // 2nd follow-up using mode: "reschedule" (Replace/Reschedule)
      const res2 = await scheduleLeadFollowUp({
        leadId: lead.id,
        scheduledAt: `${getPresetDate(3)}T15:00:00+05:30`,
        type: "Call",
        id: existingId,
        mode: "reschedule",
        submissionId: "sub-2-unique",
      });
      expect(res2.success).toBe(true);

      // Total count in database MUST still be 1 (replaced, not duplicated)
      const followUps = await db.followUp.findMany({ where: { leadId: lead.id } });
      expect(followUps.length).toBe(1);
      expect(followUps[0].id).toBe(existingId);
      expect(new Date(followUps[0].scheduledAt).toISOString()).toBe(
        new Date(`${getPresetDate(3)}T15:00:00+05:30`).toISOString()
      );
    });

    it("Enforces single active follow-up: new schedule supersedes previous to CANCELLED", async () => {
      const lead = await createTestLead("SingleActiveFollowUp");

      // First follow-up
      const res1 = await scheduleLeadFollowUp({
        leadId: lead.id,
        scheduledAt: `${getPresetDate(1)}T10:00:00+05:30`,
        type: "Call",
        submissionId: "sub-lead-1",
      });
      const firstId = res1.data!.id;

      // Second follow-up
      const res2 = await scheduleLeadFollowUp({
        leadId: lead.id,
        scheduledAt: `${getPresetDate(2)}T14:00:00+05:30`,
        type: "Call",
        mode: "create",
        submissionId: "sub-lead-2",
      });
      expect(res2.success).toBe(true);
      const secondId = res2.data!.id;

      // Database has 2 distinct rows total (audit trail preserved)
      const followUps = await db.followUp.findMany({ where: { leadId: lead.id } });
      expect(followUps.length).toBe(2);

      // But exactly 1 active PENDING follow-up, and the first is CANCELLED
      const pendingFollowUps = await db.followUp.findMany({ where: { leadId: lead.id, status: "PENDING" } });
      expect(pendingFollowUps.length).toBe(1);
      expect(pendingFollowUps[0].id).toBe(secondId);

      const firstRow = await db.followUp.findUnique({ where: { id: firstId } });
      expect(firstRow?.status).toBe("CANCELLED");
    });

    it("Preserves submissionId idempotency (does not duplicate on rapid resubmission)", async () => {
      const lead = await createTestLead("IdempotentLead");
      const submissionId = `idemp-${Date.now()}`;

      const res1 = await scheduleLeadFollowUp({
        leadId: lead.id,
        scheduledAt: `${getPresetDate(1)}T10:00:00+05:30`,
        type: "Call",
        submissionId,
      });
      expect(res1.success).toBe(true);

      // Repeat submission with exact same submissionId
      const res2 = await scheduleLeadFollowUp({
        leadId: lead.id,
        scheduledAt: `${getPresetDate(1)}T10:00:00+05:30`,
        type: "Call",
        submissionId,
      });
      expect(res2.success).toBe(true);
      expect(res2.data?.id).toBe(res1.data?.id);

      const count = await db.followUp.count({ where: { leadId: lead.id } });
      expect(count).toBe(1);
    });
  });

  // 4. Shared FollowUpForm Integration
  describe("4. Shared FollowUpForm Integration & Rendering", () => {
    it("Renders FollowUpForm with suggestion preselection (Tomorrow)", () => {
      const suggestion = getFollowUpSuggestion("NOT_PICKED");
      const dummyLead = { id: "lead-test-1", name: "Alice", phone: "9876543210" } as Lead;

      const html = renderToStaticMarkup(
        <FollowUpForm
          isOpen={true}
          defaultLeadId={dummyLead.id}
          leads={[{ id: dummyLead.id, name: dummyLead.name }]}
          suggestion={suggestion}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />
      );

      expect(html).toContain("Suggested follow-up");
      expect(html).toContain("Tomorrow");
      expect(html).toContain("Schedule");
      expect(html).toContain("Change");
    });

    it("Renders FollowUpForm with duplicate warning when existing follow-up is present", () => {
      const dummyLead = { id: "lead-test-2", name: "Bob", phone: "9876543210" } as Lead;
      const existing = {
        id: "fu-existing-123",
        scheduledAt: "2026-09-22T15:00:00+05:30",
        status: "Pending",
        type: "Call",
      };

      const html = renderToStaticMarkup(
        <FollowUpForm
          isOpen={true}
          defaultLeadId={dummyLead.id}
          leads={[{ id: dummyLead.id, name: dummyLead.name }]}
          existingFollowUp={existing}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />
      );

      expect(html).toContain("Existing follow-up scheduled for 22 Sep, 3:00 PM.");
      expect(html).toContain("Keep Existing");
      expect(html).toContain("Replace/Reschedule");
      expect(html).not.toContain("Add Another");
    });

    it("Renders FollowUpForm for CALL_BACK requiring exact date and time", () => {
      const suggestion = getFollowUpSuggestion("CALL_BACK");
      const dummyLead = { id: "lead-test-3", name: "Charlie", phone: "9876543210" } as Lead;

      const html = renderToStaticMarkup(
        <FollowUpForm
          isOpen={true}
          defaultLeadId={dummyLead.id}
          leads={[{ id: dummyLead.id, name: dummyLead.name }]}
          suggestion={suggestion}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />
      );

      expect(html).toContain("Choose callback date");
      expect(html).toContain("Choose callback time");
      expect(html).toContain("Please choose an exact callback date and time before confirming.");
    });
  });

  // 5. CallOutcomeModal UI & Suggestions
  describe("5. CallOutcomeModal Integration", () => {
    it("Renders CallOutcomeModal with Picked, Not Picked, Call Back, Interested choices", () => {
      const dummyLead = { id: "lead-test-4", name: "Diana", phone: "9876543210" } as Lead;

      const html = renderToStaticMarkup(
        <CallOutcomeModal
          isOpen={true}
          lead={dummyLead}
          onClose={vi.fn()}
        />
      );

      expect(html).toContain("Picked");
      expect(html).toContain("Not Picked");
      expect(html).toContain("Call Back");
      expect(html).toContain("Interested");
    });
  });
});
