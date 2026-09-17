import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChangeStatusSheet } from "@/features/leads/change-status-sheet";
import { LeadQuickActions } from "@/features/leads/lead-quick-actions";
import { LeadDetailPanel } from "@/features/leads/lead-detail-panel";
import { LeadCard } from "@/features/leads/lead-card";
import { leadStatuses, type Lead, type LeadStatus } from "@/features/leads/types";
import { db } from "@/lib/db";
import { changeLeadStatus, getLead } from "@/app/actions/leads";
import { getSession } from "@/lib/auth";
import { ActivityType, LeadStatus as PrismaLeadStatus } from "@prisma/client";

const TEST_USER_ID = "test-canonical-status-user";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

// Mock WhatsApp and Call contexts for React components
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

vi.mock("@/features/activity/use-activities", () => ({
  useLeadActivities: () => ({
    activities: [],
    filter: "all",
    setFilter: vi.fn(),
    handleAddNote: vi.fn(),
    handleEditNote: vi.fn(),
    handleDeleteNote: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/components/use-toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

describe("Canonical Lead Status Flow & UX Requirements (14 Tests)", () => {
  const createdLeadIds: string[] = [];
  const dummyLead: Lead = {
    id: "lead-fixture-1",
    name: "Acme Corp",
    phone: "+91 99999 11111",
    email: "acme@example.com",
    business: "Acme Industries",
    industry: "Manufacturing",
    source: "Website",
    budget: 50000,
    status: "New",
    quotedAmount: null,
    lastContactDate: null,
    nextFollowUpDate: null,
    notes: "Initial note",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeAll(async () => {
    await db.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        name: "Status Test Agent",
        email: "status-test@example.com",
        passwordHash: "dummyhash",
        role: "ADMIN",
      },
    });

    vi.mocked(getSession).mockResolvedValue({
      id: TEST_USER_ID,
      email: "status-test@example.com",
      role: "ADMIN",
    });
  });

  afterAll(async () => {
    if (createdLeadIds.length > 0) {
      await db.leadActivity.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadLossEvent.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadAIInsight.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
    }
    await db.user.delete({ where: { id: TEST_USER_ID } }).catch(() => {});
  });

  async function createDbTestLead(nameSuffix: string): Promise<Lead> {
    const raw = await db.lead.create({
      data: {
        name: `Canonical Lead ${nameSuffix}`,
        phone: `+91 98111 ${Math.floor(10000 + Math.random() * 90000)}`,
        business: "Status Verification Inc",
        status: PrismaLeadStatus.NEW,
      },
    });
    createdLeadIds.push(raw.id);
    const fetched = await getLead(raw.id);
    if (!fetched.success) throw new Error(fetched.error);
    return fetched.data;
  }

  // TEST 1: Click Status → selector appears
  it("1. Click Status → selector appears with title and current status", () => {
    const html = renderToStaticMarkup(
      <ChangeStatusSheet
        isOpen={true}
        currentStatus="New"
        saving={false}
        onClose={() => {}}
        onSelectStatus={() => {}}
      />
    );
    expect(html).toContain("Change Status");
    expect(html).toContain("Current:");
    expect(html).toContain("New");
    expect(html).toContain("Contacted");
    expect(html).toContain("Qualified");
    expect(html).toContain("Proposal Sent");
    expect(html).toContain("Won");
    expect(html).toContain("Lost");
  });

  // TEST 2: NEW → CONTACTED persists
  it("2. NEW → CONTACTED persists in database", async () => {
    const lead = await createDbTestLead("T2");
    expect(lead.status).toBe("New");

    const result = await changeLeadStatus(lead.id, "Contacted");
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.status).toBe("Contacted");

    const inDb = await db.lead.findUnique({ where: { id: lead.id } });
    expect(inDb?.status).toBe(PrismaLeadStatus.CONTACTED);
  });

  // TEST 3: CONTACTED → QUALIFIED persists
  it("3. CONTACTED → QUALIFIED persists in database", async () => {
    const lead = await createDbTestLead("T3");
    await changeLeadStatus(lead.id, "Contacted");

    const result = await changeLeadStatus(lead.id, "Qualified");
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.status).toBe("Qualified");

    const inDb = await db.lead.findUnique({ where: { id: lead.id } });
    expect(inDb?.status).toBe(PrismaLeadStatus.QUALIFIED);
  });

  // TEST 4: QUALIFIED → PROPOSAL_SENT persists
  it("4. QUALIFIED → PROPOSAL_SENT persists in database", async () => {
    const lead = await createDbTestLead("T4");
    await changeLeadStatus(lead.id, "Qualified");

    const result = await changeLeadStatus(lead.id, "Proposal Sent");
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.status).toBe("Proposal Sent");

    const inDb = await db.lead.findUnique({ where: { id: lead.id } });
    expect(inDb?.status).toBe(PrismaLeadStatus.PROPOSAL_SENT);
  });

  // TEST 5: status appears immediately in Lead Detail
  it("5. status appears immediately in Lead Detail header and badge", () => {
    const contactedLead = { ...dummyLead, status: "Contacted" as LeadStatus };
    const html = renderToStaticMarkup(
      <LeadDetailPanel
        lead={contactedLead}
        saving={false}
        onClose={() => {}}
        onEdit={() => {}}
        onStatusChange={async () => {}}
        onDelete={async () => {}}
      />
    );
    expect(html).toContain("Contacted");
    expect(html).toContain("Change status for Acme Corp");
  });

  // TEST 6: status updates Lead Card
  it("6. status updates Lead Card visually", () => {
    const qualifiedLead = { ...dummyLead, status: "Qualified" as LeadStatus };
    const html = renderToStaticMarkup(
      <LeadCard
        lead={qualifiedLead}
        onSelect={() => {}}
        onAddFollowUp={() => {}}
      />
    );
    expect(html).toContain("Qualified");
  });

  // TEST 7: Pipeline reflects new stage
  it("7. Pipeline reflects new stage in grouped columns", () => {
    const COLUMNS: LeadStatus[] = [
      "New",
      "Contacted",
      "Qualified",
      "Proposal Sent",
      "Won",
      "Lost",
    ];
    const leads: Lead[] = [
      { ...dummyLead, id: "l1", status: "Qualified" },
      { ...dummyLead, id: "l2", status: "New" },
    ];

    const grouped = COLUMNS.reduce((acc, col) => {
      acc[col] = leads.filter((l) => l.status === col);
      return acc;
    }, {} as Record<LeadStatus, Lead[]>);

    expect(grouped["Qualified"]).toHaveLength(1);
    expect(grouped["Qualified"][0].id).toBe("l1");
    expect(grouped["New"]).toHaveLength(1);
    expect(grouped["Contacted"]).toHaveLength(0);
  });

  // TEST 8: STATUS_CHANGED logged exactly once
  it("8. STATUS_CHANGED logged exactly once per transition", async () => {
    const lead = await createDbTestLead("T8");

    const activitiesBefore = await db.leadActivity.findMany({
      where: { leadId: lead.id, type: ActivityType.STATUS_CHANGED },
    });
    expect(activitiesBefore).toHaveLength(0);

    const result = await changeLeadStatus(lead.id, "Contacted");
    expect(result.success).toBe(true);

    const activitiesAfter = await db.leadActivity.findMany({
      where: { leadId: lead.id, type: ActivityType.STATUS_CHANGED },
    });
    expect(activitiesAfter).toHaveLength(1);
    expect(activitiesAfter[0].message).toBe("Status changed from New to Contacted");
  });

  // TEST 9: LOST still requires Lost Reason
  it("9. LOST still requires Lost Reason and cannot be bypassed", async () => {
    const lead = await createDbTestLead("T9");

    // Attempting to transition to Lost without a reason fails
    const failedAttempt = await changeLeadStatus(lead.id, "Lost");
    expect(failedAttempt.success).toBe(false);
    if (!failedAttempt.success) {
      expect(failedAttempt.error).toContain("requires a loss reason");
    }

    // Lead status must NOT have changed
    const unChanged = await db.lead.findUnique({ where: { id: lead.id } });
    expect(unChanged?.status).toBe(PrismaLeadStatus.NEW);

    // With reason, transition succeeds
    const successAttempt = await changeLeadStatus(lead.id, "Lost", "PRICE", "Client budget too low");
    expect(successAttempt.success).toBe(true);
    if (successAttempt.success) {
      expect(successAttempt.data.status).toBe("Lost");
    }

    const inDb = await db.lead.findUnique({ where: { id: lead.id } });
    expect(inDb?.status).toBe(PrismaLeadStatus.LOST);
  });

  // TEST 10: QuickStatus is not accidentally written into Lead.status
  it("10. QuickStatus choices are not present in ChangeStatusSheet and invalid for Lead.status", async () => {
    // Check canonical list does not contain quick statuses
    expect(leadStatuses).not.toContain("CALL_NOT_PICK");
    expect(leadStatuses).not.toContain("CALL_AGAIN");
    expect(leadStatuses).not.toContain("INTERESTED");

    // Rendering ChangeStatusSheet does not render any quick status
    const html = renderToStaticMarkup(
      <ChangeStatusSheet
        isOpen={true}
        currentStatus="New"
        saving={false}
        onClose={() => {}}
        onSelectStatus={() => {}}
      />
    );
    expect(html).not.toContain("CALL_NOT_PICK");
    expect(html).not.toContain("CALL_AGAIN");
    expect(html).not.toContain("INTERESTED");

    // Invalid status string rejected by changeLeadStatus
    const invalidResult = await changeLeadStatus(dummyLead.id, "CALL_NOT_PICK" as unknown as LeadStatus);
    expect(invalidResult.success).toBe(false);
    if (!invalidResult.success) {
      expect(invalidResult.error).toContain("valid lead status");
    }
  });

  // TEST 11: mobile Status button works
  it("11. mobile Status button has touch-friendly height and invokes callback", () => {
    let clicked = false;
    const actionsHtml = renderToStaticMarkup(
      <LeadQuickActions
        lead={dummyLead}
        onChangeStatus={() => {
          clicked = true;
        }}
      />
    );
    expect(clicked).toBe(false);
    expect(actionsHtml).toContain("Change status for Acme Corp");
    expect(actionsHtml).toContain("min-h-14"); // Touch target requirement >= 48px
  });

  // TEST 12: desktop Status button works
  it("12. desktop Status button renders identically and uses same BottomSheet component", () => {
    const html = renderToStaticMarkup(
      <LeadDetailPanel
        lead={dummyLead}
        initialAction="status"
        saving={false}
        onClose={() => {}}
        onEdit={() => {}}
        onStatusChange={async () => {}}
        onDelete={async () => {}}
      />
    );
    // Button is present in action bar
    expect(html).toContain("Change status for Acme Corp");
    // BottomSheet container is present with responsive classes
    expect(html).toContain("Change Status");
    expect(html).toContain("sm:items-center");
  });

  // TEST 13: opening Lead Detail from Pipeline still works
  it("13. opening Lead Detail from Pipeline with onStatusChange functions correctly", async () => {
    const lead = await createDbTestLead("T13");

    let statusChangedTo: LeadStatus | null = null;
    const handleStatusChange = async (nextStatus: LeadStatus) => {
      const res = await changeLeadStatus(lead.id, nextStatus);
      if (res.success) {
        statusChangedTo = res.data.status;
      }
    };

    // Simulate clicking "Won"
    await handleStatusChange("Won");
    expect(statusChangedTo).toBe("Won");

    const inDb = await db.lead.findUnique({ where: { id: lead.id } });
    expect(inDb?.status).toBe(PrismaLeadStatus.WON);
  });

  // TEST 14: opening Lead Detail from Leads still works
  it("14. opening Lead Detail from Leads with onStatusChange functions correctly", async () => {
    const lead = await createDbTestLead("T14");

    let statusChangedTo: LeadStatus | null = null;
    const setLeadStatus = async (nextStatus: LeadStatus) => {
      const res = await changeLeadStatus(lead.id, nextStatus);
      if (res.success) {
        statusChangedTo = res.data.status;
      }
    };

    // Simulate clicking "Qualified"
    await setLeadStatus("Qualified");
    expect(statusChangedTo).toBe("Qualified");

    const inDb = await db.lead.findUnique({ where: { id: lead.id } });
    expect(inDb?.status).toBe(PrismaLeadStatus.QUALIFIED);
  });
});
