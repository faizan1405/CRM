import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  evaluateMobileAlerts,
  buildMobilePushPayload,
} from "@/features/notifications/services/mobile-alert-engine";
import { MobileSubscriptionStore } from "@/features/notifications/services/mobile-subscription-store";
import {
  registerMobileSubscription,
  unregisterMobileSubscription,
  dispatchMobileAlerts,
  getDispatchedMobileAlerts,
} from "@/app/actions/mobile-notifications";

const TEST_USER_ID = "test-mobile-notification-user";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

describe("Agent B — Mobile Notification System Integration", () => {
  const createdLeadIds: string[] = [];

  beforeAll(async () => {
    await db.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        name: "Mobile Notification Tester",
        email: "mobile-tester@example.com",
        passwordHash: "dummyhash",
        role: "ADMIN",
      },
    });

    vi.mocked(getSession).mockResolvedValue({
      id: TEST_USER_ID,
      email: "mobile-tester@example.com",
      role: "ADMIN",
    });
  });

  beforeEach(() => {
    MobileSubscriptionStore.clearForTesting();
  });

  afterAll(async () => {
    if (createdLeadIds.length > 0) {
      await db.followUp.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadAIInsight.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadActivity.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
    }
    await db.user.delete({ where: { id: TEST_USER_ID } }).catch(() => {});
  });

  async function createTestLead(nameSuffix: string, extraData: any = {}) {
    const lead = await db.lead.create({
      data: {
        name: `Mobile Test ${nameSuffix}`,
        phone: `+91 91234 ${Math.floor(10000 + Math.random() * 90000)}`,
        business: "Mobile Corp",
        status: "NEW",
        ...extraData,
      },
    });
    createdLeadIds.push(lead.id);
    return lead;
  }

  describe("1. Follow-up Reminders", () => {
    it("generates a high-priority mobile reminder for follow-up scheduled in the near window", async () => {
      const lead = await createTestLead("Reminder Target");
      const reminderDate = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes in future

      await db.followUp.create({
        data: {
          leadId: lead.id,
          scheduledAt: reminderDate,
          type: "CALL",
          status: "PENDING",
        },
      });

      const alerts = await evaluateMobileAlerts({ reminderWindowMinutes: 60 });
      const reminder = alerts.find((a) => a.leadId === lead.id && a.category === "FOLLOWUP_REMINDER");

      expect(reminder).toBeDefined();
      expect(reminder!.priority).toBe("HIGH");
      expect(reminder!.title).toContain("Follow-up Reminder");
      expect(reminder!.payload.data.url).toBe(`/leads/${lead.id}`);
      expect(reminder!.payload.actions).toBeDefined();
      expect(reminder!.payload.actions!.some((act) => act.action === "call")).toBe(true);
    });
  });

  describe("2. Overdue Follow-ups", () => {
    it("generates a critical-priority alert with action buttons for overdue follow-ups", async () => {
      const lead = await createTestLead("Overdue Target");
      const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

      await db.followUp.create({
        data: {
          leadId: lead.id,
          scheduledAt: pastDate,
          type: "WHATSAPP",
          status: "PENDING",
        },
      });

      const alerts = await evaluateMobileAlerts();
      const overdueAlert = alerts.find((a) => a.leadId === lead.id && a.category === "OVERDUE_FOLLOWUP");

      expect(overdueAlert).toBeDefined();
      expect(overdueAlert!.priority).toBe("CRITICAL");
      expect(overdueAlert!.title).toContain("Overdue Follow-up");
      expect(overdueAlert!.payload.requireInteraction).toBe(true);
      expect(overdueAlert!.payload.actions?.some((act) => act.action === "reschedule")).toBe(true);
    });
  });

  describe("3. Urgent / High-Priority Leads", () => {
    it("detects high-value uncontacted leads and formats urgent mobile payload", async () => {
      const lead = await createTestLead("High Value Target", {
        quotedAmount: 150000,
        status: "NEW",
        lastContactDate: null,
      });

      const alerts = await evaluateMobileAlerts();
      const urgentAlert = alerts.find((a) => a.leadId === lead.id && a.category === "URGENT_LEAD");

      expect(urgentAlert).toBeDefined();
      expect(urgentAlert!.priority).toBe("CRITICAL");
      expect(urgentAlert!.title).toContain("Priority Lead");
      expect(urgentAlert!.body).toContain("High-value opportunity");
      expect(urgentAlert!.payload.data.leadId).toBe(lead.id);
    });

    it("detects AI attention urgent leads", async () => {
      const lead = await createTestLead("AI Attention Urgent", { status: "QUALIFIED" });
      await db.leadAIInsight.create({
        data: {
          leadId: lead.id,
          score: 90,
          priority: "CRITICAL",
          scoreReason: "Client requested closing quote today",
          recommendedAction: "Call immediately",
        },
      });

      const alerts = await evaluateMobileAlerts();
      const urgentAlert = alerts.find((a) => a.leadId === lead.id && a.category === "URGENT_LEAD");

      expect(urgentAlert).toBeDefined();
      expect(urgentAlert!.body).toContain("AI Attention flagged as Urgent");
    });
  });

  describe("4. Mobile Device Subscriptions", () => {
    it("registers and idempotently updates mobile device push subscriptions", async () => {
      const endpoint = "https://fcm.googleapis.com/fcm/send/test-device-token-123";
      const regResult = await registerMobileSubscription({
        endpoint,
        keys: { p256dh: "dummy-p256dh", auth: "dummy-auth" },
        platform: "android",
      });

      expect(regResult.success).toBe(true);
      expect(regResult.data.endpoint).toBe(endpoint);
      expect(regResult.data.platform).toBe("android");
      expect(regResult.data.isActive).toBe(true);

      // Re-register with updated platform
      const updateResult = await registerMobileSubscription({
        endpoint,
        platform: "ios",
      });
      expect(updateResult.success).toBe(true);
      expect(updateResult.data.platform).toBe("ios");

      // Verify active subscriptions
      const active = MobileSubscriptionStore.getActiveSubscriptions(TEST_USER_ID);
      expect(active.length).toBe(1);

      // Unregister
      const unregResult = await unregisterMobileSubscription(endpoint);
      expect(unregResult.success).toBe(true);
      expect(MobileSubscriptionStore.getActiveSubscriptions(TEST_USER_ID).length).toBe(0);
    });
  });

  describe("5. Dispatch and Deduplication", () => {
    it("dispatches alerts and prevents duplicate notifications within same cycle", async () => {
      const lead = await createTestLead("Dispatch Dedupe Target");
      await db.followUp.create({
        data: {
          leadId: lead.id,
          scheduledAt: new Date(Date.now() - 3600 * 1000), // overdue
          type: "CALL",
          status: "PENDING",
        },
      });

      // 1st dispatch cycle
      const cycle1 = await dispatchMobileAlerts();
      expect(cycle1.success).toBe(true);
      expect(cycle1.data.dispatched).toBeGreaterThan(0);

      // 2nd dispatch cycle immediately after
      const cycle2 = await dispatchMobileAlerts();
      expect(cycle2.success).toBe(true);
      // Alerts matching previous dedupe keys should be skipped
      expect(cycle2.data.skippedDuplicate).toBeGreaterThan(0);

      // Verify dispatch history
      const history = await getDispatchedMobileAlerts(10);
      expect(history.success).toBe(true);
      expect(history.data.length).toBeGreaterThan(0);
    });
  });
});
