import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "@/lib/db";
import {
  validateTemplatePlaceholders,
  renderWhatsAppMessage,
} from "@/features/whatsapp-templates/placeholders";
import {
  getWhatsAppTemplates,
  createWhatsAppTemplate,
  toggleWhatsAppTemplateActive,
  duplicateWhatsAppTemplate,
  deleteWhatsAppTemplate,
  personalizeWhatsAppMessage,
} from "@/app/actions/whatsapp-templates";
import {
  parseDeterministicFallback,
  formatStructuredNoteToReadableText,
} from "@/features/ai-conversation-notes/services/notes-parser";
import {
  structureCallNotes,
  applyCallNotes,
  getSuggestedFollowUp,
} from "@/app/actions/conversation-notes";
import {
  markLeadLost,
  getLeadLossHistory,
  getLostReasonsAnalytics,
} from "@/app/actions/lost-reasons";
import { changeLeadStatus, markLeadWaste, restoreWasteLead } from "@/app/actions/leads";
import {
  generateSmartNotifications,
} from "@/features/notifications/services/notification-generator";
import {
  getNotifications,
  markNotificationRead,
  markNotificationResolved,
  dismissNotification,
} from "@/app/actions/notifications";
import {
  getDailySalesBriefingData,
  getIndiaDateKey,
} from "@/features/daily-briefing/services/briefing-service";
import { getDailyBriefing } from "@/app/actions/daily-briefing";
import { LeadStatus } from "@prisma/client";

// Mock user session
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn().mockResolvedValue({
    id: "test-sales-intelligence-user",
    email: "tester@example.com",
    role: "ADMIN",
  }),
}));

describe("Phase 9: Sales Communication + Follow-up Intelligence", () => {
  const createdLeadIds: string[] = [];
  const createdTemplateIds: string[] = [];

  beforeAll(async () => {
    // Ensure test user exists for foreign key references
    await db.user.upsert({
      where: { id: "test-sales-intelligence-user" },
      update: {},
      create: {
        id: "test-sales-intelligence-user",
        name: "Test Sales User",
        email: "tester@example.com",
        passwordHash: "dummyhash",
        role: "ADMIN",
      },
    });
  });

  afterAll(async () => {
    // Cleanup created test records
    if (createdLeadIds.length > 0) {
      await db.salesNotification.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadLossEvent.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.followUp.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadActivity.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadAIInsight.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
    }

    if (createdTemplateIds.length > 0) {
      await db.whatsAppTemplate.deleteMany({ where: { id: { in: createdTemplateIds } } });
    }

    const todayDate = getIndiaDateKey();
    await db.dailySalesBriefing.deleteMany({
      where: { userId: "test-sales-intelligence-user", briefingDate: todayDate },
    });
  });

  describe("1. WhatsApp Message Templates & Personalization", () => {
    it("validates supported placeholders and rejects unknown placeholders", () => {
      const validText = "Hi {name}, following up regarding {requirement} for {business} with budget {budget} on {followUpDate} at {followUpTime}.";
      expect(validateTemplatePlaceholders(validText)).toBeNull();

      const invalidText = "Hi {name}, here is your {discount} and contact {phone}!";
      const err = validateTemplatePlaceholders(invalidText);
      expect(err).toContain("Unsupported placeholder(s)");
      expect(err).toContain("{discount}");
      expect(err).toContain("{phone}");
    });

    it("renders placeholders with clean natural degradation for missing data", () => {
      // Complete lead
      const completeLead = {
        id: "lead-1",
        name: "Aman Gupta",
        business: "boAt Lifestyle",
        requirement: "Omnichannel CRM",
        budget: 150000,
        followUpDate: "Tomorrow",
        followUpTime: "3:00 PM",
        phone: "+919876543210",
      };

      const template = "Hi {name}, regarding your budget of {budget} for {requirement} at {business}. Let's talk on {followUpDate} at {followUpTime}.";
      const rendered = renderWhatsAppMessage(template, completeLead);
      expect(rendered).toContain("Aman Gupta");
      expect(rendered).toContain("₹1,50,000");
      expect(rendered).toContain("Omnichannel CRM");
      expect(rendered).toContain("boAt Lifestyle");
      expect(rendered).toContain("Tomorrow at 3:00 PM");

      // Incomplete lead with missing budget and business
      const partialLead = {
        id: "lead-2",
        name: "Priya",
        phone: "+919876543211",
      };

      const partialTemplate = "Hi {name}, for your budget of {budget} for {business}. When can we speak?";
      const degraded = renderWhatsAppMessage(partialTemplate, partialLead);
      expect(degraded).not.toContain("{budget}");
      expect(degraded).not.toContain("{business}");
      expect(degraded).not.toContain("budget of");
      expect(degraded).toContain("Priya");
    });

    it("supports authenticated template CRUD actions", async () => {
      // Create
      const created = await createWhatsAppTemplate({
        title: "Test Unit Template",
        category: "follow_up",
        message: "Hi {name}, following up regarding {requirement}. Let us connect on {followUpDate}.",
        isActive: true,
      });
      expect(created.success).toBe(true);
      expect(created.data?.id).toBeDefined();
      createdTemplateIds.push(created.data!.id);

      // List
      const list = await getWhatsAppTemplates({ category: "follow_up" });
      expect(list.success).toBe(true);
      expect(list.data?.some((t) => t.id === created.data!.id)).toBe(true);

      // Toggle active
      const toggled = await toggleWhatsAppTemplateActive(created.data!.id, false);
      expect(toggled.success).toBe(true);
      expect(toggled.data?.active).toBe(false);

      // Duplicate
      const dup = await duplicateWhatsAppTemplate(created.data!.id);
      expect(dup.success).toBe(true);
      expect(dup.data?.title).toContain("(Copy)");
      createdTemplateIds.push(dup.data!.id);

      // Delete duplicate
      const del = await deleteWhatsAppTemplate(dup.data!.id);
      expect(del.success).toBe(true);
    });

    it("falls back gracefully during AI personalization without inventing unauthorized facts", async () => {
      const testLead = await db.lead.create({
        data: {
          name: "Suresh Raina",
          phone: "+919811122233",
          business: "Raina Sports Academy",
          notes: "Cricket academy management software",
          status: LeadStatus.CONTACTED,
        },
      });
      createdLeadIds.push(testLead.id);

      const res = await personalizeWhatsAppMessage({
        leadId: testLead.id,
        templateMessage: "Hi {name}, following up regarding {requirement} for {business}.",
      });

      expect(res.success).toBe(true);
      expect(res.data?.originalMessage).toContain("Suresh Raina");
      expect(res.data?.personalizedMessage).toBeDefined();
      // Should not contain invented discounts
      expect(res.data?.personalizedMessage.toLowerCase()).not.toContain("50% discount");
    });
  });

  describe("2. AI Conversation / Call Notes & Follow-up Extraction", () => {
    it("parses rough conversational notes and extracts budget and relative follow-up", async () => {
      const raw = "interested ecommerce 25k budget talk with partner follow up friday 4pm";
      const parsed = parseDeterministicFallback(raw);

      expect(parsed.rawNote).toBe(raw);
      expect(parsed.budget).toBe("₹25,000");
      expect(parsed.interestLevel).toBe("MEDIUM");
      expect(parsed.tags).toContain("Follow-up Required");
      expect(parsed.tags).toContain("Budget Discussed");
      expect(parsed.tags).toContain("Decision Maker");

      // Verify human-readable formatting
      const readable = formatStructuredNoteToReadableText(parsed);
      expect(readable).toContain("Budget: ₹25,000");
      expect(readable).toContain("Interest Level: MEDIUM");
    });

    it("structures notes without automatically saving to database", async () => {
      const lead = await db.lead.create({
        data: {
          name: "Ananya Roy",
          phone: "+919822233344",
          status: LeadStatus.NEW,
        },
      });
      createdLeadIds.push(lead.id);

      const beforeActivitiesCount = await db.leadActivity.count({ where: { leadId: lead.id } });
      const structuredResult = await structureCallNotes("interested in custom crm quote 45k call tomorrow", lead.id);

      expect(structuredResult.success).toBe(true);
      expect(structuredResult.data?.rawNote).toContain("45k");

      const afterActivitiesCount = await db.leadActivity.count({ where: { leadId: lead.id } });
      // Structuring does not save to DB
      expect(afterActivitiesCount).toBe(beforeActivitiesCount);
    });

    it("applies structured note into Phase 5 Activity timeline (NOTE_ADDED) upon explicit user confirmation", async () => {
      const lead = await db.lead.create({
        data: {
          name: "Deepak Chopra",
          phone: "+919833344455",
          status: LeadStatus.CONTACTED,
        },
      });
      createdLeadIds.push(lead.id);

      const applyRes = await applyCallNotes({
        leadId: lead.id,
        rawNote: "client wants inventory module 80k budget",
        structuredData: {
          requirement: "Inventory Management Module",
          budget: "₹80,000",
          interestLevel: "HIGH",
          nextAction: "Send technical spec",
          tags: ["Inventory", "High Value"],
        },
      });

      expect(applyRes.success).toBe(true);
      expect(applyRes.data?.activityId).toBeDefined();

      const activity = await db.leadActivity.findUnique({
        where: { id: applyRes.data!.activityId },
      });
      expect(activity?.type).toBe("NOTE_ADDED");
      expect(activity?.message).toContain("Inventory Management Module");
      expect(activity?.message).toContain("₹80,000");
      expect(activity?.metadata).toMatchObject({
        source: "ai_conversation_notes",
        appliedType: "structured",
      });
    });

    it("suggests next follow-up with Asia/Kolkata date calculations without writing automatically", async () => {
      const lead = await db.lead.create({
        data: {
          name: "Karan Patel",
          phone: "+919844455566",
          status: LeadStatus.PROPOSAL_SENT,
        },
      });
      createdLeadIds.push(lead.id);

      const suggestion = await getSuggestedFollowUp(lead.id);
      expect(suggestion.success).toBe(true);
      expect(suggestion.data?.suggestedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(suggestion.data?.suggestedTime).toMatch(/^\d{2}:\d{2}$/);
      expect(suggestion.data?.suggestedType).toBe("CALL");
      expect(suggestion.data?.hasExistingPendingFollowUp).toBe(false);

      // Confirm no follow-up was created in database
      const count = await db.followUp.count({ where: { leadId: lead.id } });
      expect(count).toBe(0);
    });
  });

  describe("3. Lost Reason Tracking & Analytics", () => {
    it("validates every required lost reason and enforces mandatory note for OTHER", async () => {
      const lead = await db.lead.create({
        data: {
          name: "Vikram Seth",
          phone: "+919855566677",
          status: LeadStatus.QUALIFIED,
        },
      });
      createdLeadIds.push(lead.id);

      // Failing OTHER without note
      const failedOther = await markLeadLost(lead.id, "OTHER", "");
      expect(failedOther.success).toBe(false);
      expect(failedOther.error).toContain("note/explanation is strictly required");

      // Successful OTHER with note
      const successOther = await markLeadLost(lead.id, "OTHER", "Client relocated business to Dubai.");
      expect(successOther.success).toBe(true);
      expect(successOther.data?.lossEvent.reason).toBe("OTHER");
      expect(successOther.data?.lossEvent.note).toContain("Dubai");

      // Verify lead status is now LOST
      const updatedLead = await db.lead.findUnique({ where: { id: lead.id } });
      expect(updatedLead?.status).toBe("LOST");
    });

    it("closes loopholes: prevents changeLeadStatus to LOST without a loss reason", async () => {
      const lead = await db.lead.create({
        data: {
          name: "Rajiv Bajaj",
          phone: "+919866677788",
          status: LeadStatus.CONTACTED,
        },
      });
      createdLeadIds.push(lead.id);

      const bypassAttempt = await changeLeadStatus(lead.id, "Lost");
      expect(bypassAttempt.success).toBe(false);
      if (!bypassAttempt.success) {
        expect(bypassAttempt.error).toContain("requires a loss reason");
      }

      const untouched = await db.lead.findUnique({ where: { id: lead.id } });
      expect(untouched?.status).toBe("CONTACTED");
    });

    it("preserves historical loss records if a lost lead is subsequently reopened", async () => {
      const lead = await db.lead.create({
        data: {
          name: "Mira Nair",
          phone: "+919877788899",
          status: LeadStatus.CONTACTED,
        },
      });
      createdLeadIds.push(lead.id);

      // 1. Mark as Lost (Price)
      const lostRes = await markLeadLost(lead.id, "PRICE", "Quotation was above client budget");
      expect(lostRes.success).toBe(true);

      // 2. Re-open to Contacted
      const reopenRes = await changeLeadStatus(lead.id, "Contacted");
      expect(reopenRes.success).toBe(true);

      // 3. Mark as Lost again later (Timing)
      const secondLost = await markLeadLost(lead.id, "TIMING", "Postponed project to Q3");
      expect(secondLost.success).toBe(true);

      // 4. Verify loss history retains BOTH historical events
      const history = await getLeadLossHistory(lead.id);
      expect(history.success).toBe(true);
      expect(history.data?.length).toBe(2);
      expect(history.data?.map((e) => e.reason)).toEqual(["TIMING", "PRICE"]);
    });

    it("aggregates lost reason analytics with percentages across time filters", async () => {
      const analytics = await getLostReasonsAnalytics("all");
      expect(analytics.success).toBe(true);
      expect(analytics.data?.totalLost).toBeGreaterThanOrEqual(1);
      expect(analytics.data?.breakdown.length).toBe(9);

      // Verify percentage calculations
      const sumCounts = analytics.data?.breakdown.reduce((acc, curr) => acc + curr.count, 0);
      expect(sumCounts).toBe(analytics.data?.totalLost);
      expect(analytics.data?.breakdown.some((b) => b.percentage > 0)).toBe(true);
    });
  });

  describe("4. Smart Notifications Engine", () => {
    it("generates deterministic notifications with stable deduplication", async () => {
      const pastTime = new Date(Date.now() - 3600000); // 1 hour ago
      const lead = await db.lead.create({
        data: {
          name: "Overdue Lead Tester",
          phone: "+919888899900",
          status: LeadStatus.CONTACTED,
          followUps: {
            create: {
              scheduledAt: pastTime,
              type: "CALL",
              status: "PENDING",
              note: "Urgent call regarding agreement",
            },
          },
        },
      });
      createdLeadIds.push(lead.id);

      // 1. First run generates overdue notification
      const run1 = await generateSmartNotifications();
      expect(run1.created).toBeGreaterThanOrEqual(1);

      // 2. Immediate second run deduplicates (0 created, skipped >= 1)
      const run2 = await generateSmartNotifications();
      expect(run2.created).toBe(0);
      expect(run2.skipped).toBeGreaterThanOrEqual(1);

      const notifs = await getNotifications({ filter: "overdue" });
      expect(notifs.success).toBe(true);
      const overdueNotif = notifs.data?.find((n) => n.leadId === lead.id);
      expect(overdueNotif).toBeDefined();
      expect(overdueNotif?.priority).toBe("critical");
      expect(overdueNotif?.rawType).toBe("OVERDUE_FOLLOWUP");
    });

    it("supports notification lifecycle: read, resolved, and dismissed", async () => {
      const lead = await db.lead.create({
        data: {
          name: "Lifecycle Lead",
          phone: "+919899900011",
          status: LeadStatus.NEW,
        },
      });
      createdLeadIds.push(lead.id);

      const notif = await db.salesNotification.create({
        data: {
          leadId: lead.id,
          type: "HOT_LEAD_ATTENTION",
          priority: "CRITICAL",
          title: "Hot Lead Alert",
          reason: "High score 92/100",
          recommendedAction: "Call lead immediately",
          dedupeKey: `unit_test_lifecycle_${lead.id}`,
          status: "UNREAD",
        },
      });

      // Mark read
      const readRes = await markNotificationRead(notif.id);
      expect(readRes.success).toBe(true);
      expect(readRes.data?.status).toBe("read");
      expect(readRes.data?.readAt).toBeDefined();

      // Mark resolved
      const resolvedRes = await markNotificationResolved(notif.id);
      expect(resolvedRes.success).toBe(true);
      expect(resolvedRes.data?.status).toBe("resolved");
      expect(resolvedRes.data?.resolvedAt).toBeDefined();

      // Dismiss
      const dismissRes = await dismissNotification(notif.id);
      expect(dismissRes.success).toBe(true);

      const check = await db.salesNotification.findUnique({ where: { id: notif.id } });
      expect(check?.status).toBe("DISMISSED");
    });
  });

  describe("5. Daily Sales Briefing & Cached Daily AI Summary", () => {
    it("computes accurate daily briefing metrics and priority ordering", async () => {
      const briefing = await getDailySalesBriefingData({ userId: "test-sales-intelligence-user" });

      expect(briefing.briefingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(briefing.summaryStats).toBeDefined();
      expect(typeof briefing.summaryStats.hotLeadsCount).toBe("number");
      expect(typeof briefing.summaryStats.followUpsTodayCount).toBe("number");
      expect(typeof briefing.summaryStats.overdueFollowUpsCount).toBe("number");
      expect(typeof briefing.summaryStats.activeOpportunityValue).toBe("number");
      expect(briefing.summaryStats.activeOpportunityValueFormatted).toContain("₹");

      // Verify priority ordering: Critical items appear first
      if (briefing.priorityActions.length >= 2) {
        const firstIsCritical = briefing.priorityActions[0].priority === "Critical";
        if (briefing.priorityActions.some((p) => p.priority === "Critical") && briefing.priorityActions.some((p) => p.priority !== "Critical")) {
          expect(firstIsCritical).toBe(true);
        }
      }
    });

    it("caches daily AI summary snapshot and does not regenerate repeatedly", async () => {
      const todayDate = getIndiaDateKey();

      // First call generates/retrieves snapshot
      const call1 = await getDailyBriefing();
      expect(call1.success).toBe(true);
      expect(call1.data?.aiBriefing.summary).toBeDefined();

      // Check DB contains record
      const dbBriefing = await db.dailySalesBriefing.findUnique({
        where: {
          userId_briefingDate: {
            userId: "test-sales-intelligence-user",
            briefingDate: todayDate,
          },
        },
      });
      expect(dbBriefing).toBeDefined();
      expect(dbBriefing?.summary).toBe(call1.data?.aiBriefing.summary);

      // Second call returns matching summary from cache
      const call2 = await getDailyBriefing();
      expect(call2.data?.aiBriefing.summary).toBe(call1.data?.aiBriefing.summary);
    });
  });

  describe("6. Waste Status & Pipeline Preservation Semantics", () => {
    it("preserves CONTACTED status when marking as Waste and when restoring", async () => {
      const lead = await db.lead.create({
        data: {
          name: "Test Contacted Waste Lead",
          phone: "+919998887701",
          status: LeadStatus.CONTACTED,
          isWaste: false,
        },
      });
      createdLeadIds.push(lead.id);

      // 1. Mark Waste
      const wasteRes = await markLeadWaste(lead.id);
      expect(wasteRes.success).toBe(true);
      if (wasteRes.success && wasteRes.data) {
        expect(wasteRes.data.status).toBe("Contacted");
        expect(wasteRes.data.isWaste).toBe(true);
      }

      const dbWaste = await db.lead.findUnique({ where: { id: lead.id } });
      expect(dbWaste?.status).toBe(LeadStatus.CONTACTED);
      expect(dbWaste?.isWaste).toBe(true);

      // Verify no LeadLossEvent was created
      const lossEvents = await db.leadLossEvent.findMany({ where: { leadId: lead.id } });
      expect(lossEvents.length).toBe(0);

      // 2. Restore from Waste
      const restoreRes = await restoreWasteLead(lead.id);
      expect(restoreRes.success).toBe(true);
      if (restoreRes.success && restoreRes.data) {
        expect(restoreRes.data.status).toBe("Contacted");
        expect(restoreRes.data.isWaste).toBe(false);
      }

      const dbRestored = await db.lead.findUnique({ where: { id: lead.id } });
      expect(dbRestored?.status).toBe(LeadStatus.CONTACTED);
      expect(dbRestored?.isWaste).toBe(false);
    });

    it("preserves NEW status through mark Waste and restore cycle without creating loss events", async () => {
      const lead = await db.lead.create({
        data: {
          name: "Test New Waste Lead",
          phone: "+919998887702",
          status: LeadStatus.NEW,
          isWaste: false,
        },
      });
      createdLeadIds.push(lead.id);

      // Mark Waste
      const wasteRes = await markLeadWaste(lead.id);
      expect(wasteRes.success).toBe(true);
      if (wasteRes.success) {
        expect(wasteRes.data.status).toBe("New");
        expect(wasteRes.data.isWaste).toBe(true);
      }

      const dbWaste = await db.lead.findUnique({ where: { id: lead.id } });
      expect(dbWaste?.status).toBe(LeadStatus.NEW);
      expect(dbWaste?.isWaste).toBe(true);

      const lossEvents = await db.leadLossEvent.findMany({ where: { leadId: lead.id } });
      expect(lossEvents.length).toBe(0);

      // Restore Waste
      const restoreRes = await restoreWasteLead(lead.id);
      expect(restoreRes.success).toBe(true);
      if (restoreRes.success) {
        expect(restoreRes.data.status).toBe("New");
        expect(restoreRes.data.isWaste).toBe(false);
      }

      const dbRestored = await db.lead.findUnique({ where: { id: lead.id } });
      expect(dbRestored?.status).toBe(LeadStatus.NEW);
      expect(dbRestored?.isWaste).toBe(false);
    });

    it("ensures LOST lead remains LOST independently of Waste feature and retains loss event", async () => {
      const lead = await db.lead.create({
        data: {
          name: "Test Genuine Lost Lead",
          phone: "+919998887703",
          status: LeadStatus.NEW,
          isWaste: false,
        },
      });
      createdLeadIds.push(lead.id);

      // Explicitly mark as LOST
      const lostRes = await markLeadLost(lead.id, "PRICE", "Too expensive for budget");
      expect(lostRes.success).toBe(true);

      const dbLost = await db.lead.findUnique({
        where: { id: lead.id },
        include: { lossEvents: true },
      });
      expect(dbLost?.status).toBe(LeadStatus.LOST);
      expect(dbLost?.isWaste).toBe(false);
      expect(dbLost?.lossEvents.length).toBe(1);
      expect(dbLost?.lossEvents[0].reason).toBe("PRICE");
    });
  });
});
