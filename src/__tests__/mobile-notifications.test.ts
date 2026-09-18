import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  evaluateMobileAlerts,
} from "@/features/notifications/services/mobile-alert-engine";
import { MobileSubscriptionStore } from "@/features/notifications/services/mobile-subscription-store";
import {
  registerMobileSubscription,
  unregisterMobileSubscription,
  syncDeviceSubscription,
  dispatchMobileAlerts,
  getDispatchedMobileAlerts,
  triggerTestMobileAlert,
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

  beforeEach(async () => {
    await MobileSubscriptionStore.clearForTesting();
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

  async function createTestLead(nameSuffix: string, extraData: Partial<import("@prisma/client").Prisma.LeadCreateInput> = {}) {
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

    it("generates an urgent FOLLOWUP_DUE notification when follow-up reaches scheduledAt", async () => {
      const lead = await createTestLead("Due Target");
      const dueTime = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago (reached scheduled time)

      const followUp = await db.followUp.create({
        data: {
          leadId: lead.id,
          scheduledAt: dueTime,
          type: "CALL",
          status: "PENDING",
          note: "Urgent contract review call",
        },
      });

      const alerts = await evaluateMobileAlerts();
      const dueAlert = alerts.find((a) => a.leadId === lead.id && a.category === "FOLLOWUP_DUE");

      expect(dueAlert).toBeDefined();
      expect(dueAlert!.priority).toBe("CRITICAL");
      expect(dueAlert!.title).toContain("Follow-up due now");
      expect(dueAlert!.title).toContain(lead.name);
      expect(dueAlert!.body).toContain("Follow-up due now");
      expect(dueAlert!.body).toContain(lead.name);
      expect(dueAlert!.body).toContain("Urgent contract review call");
      expect(dueAlert!.dedupeKey).toBe(`mobile_due_${followUp.id}_${dueTime.getTime()}`);
      expect(dueAlert!.payload.requireInteraction).toBe(true);
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
      expect(regResult.data!.endpoint).toBe(endpoint);
      expect(regResult.data!.platform).toBe("android");
      expect(regResult.data!.isActive).toBe(true);

      // Re-register with updated platform
      const updateResult = await registerMobileSubscription({
        endpoint,
        platform: "ios",
      });
      expect(updateResult.success).toBe(true);
      expect(updateResult.data!.platform).toBe("ios");

      // Verify active subscriptions
      const active = await MobileSubscriptionStore.getActiveSubscriptions(TEST_USER_ID);
      expect(active.length).toBe(1);

      // Unregister
      const unregResult = await unregisterMobileSubscription(endpoint);
      expect(unregResult.success).toBe(true);
      expect((await MobileSubscriptionStore.getActiveSubscriptions(TEST_USER_ID)).length).toBe(0);
    });

    it("supports multiple active devices (laptop + phone) simultaneously without overwriting or deactivating existing subscriptions", async () => {
      const laptopEndpoint = "mock://laptop-endpoint-token";
      const phoneEndpoint = "mock://phone-apple-endpoint-token";

      // 1. Register laptop device
      const laptopRes = await registerMobileSubscription({
        endpoint: laptopEndpoint,
        keys: { p256dh: "laptop-p256dh", auth: "laptop-auth" },
        platform: "web",
        userAgent: "Mozilla/5.0 Windows Chrome",
      });
      expect(laptopRes.success).toBe(true);
      expect(laptopRes.data!.isActive).toBe(true);
      expect(laptopRes.data!.platform).toBe("web");

      // 2. Register mobile phone device for the SAME user
      const phoneRes = await registerMobileSubscription({
        endpoint: phoneEndpoint,
        keys: { p256dh: "phone-p256dh", auth: "phone-auth" },
        platform: "ios",
        userAgent: "Mozilla/5.0 iPhone Safari",
      });
      expect(phoneRes.success).toBe(true);
      expect(phoneRes.data!.isActive).toBe(true);
      expect(phoneRes.data!.platform).toBe("ios");

      // 3. Both devices must be active and have unique endpoints
      const activeSubs = await MobileSubscriptionStore.getActiveSubscriptions(TEST_USER_ID);
      expect(activeSubs.length).toBe(2);

      const laptopSub = activeSubs.find((s) => s.endpoint === laptopEndpoint);
      const phoneSub = activeSubs.find((s) => s.endpoint === phoneEndpoint);

      expect(laptopSub).toBeDefined();
      expect(laptopSub!.isActive).toBe(true);
      expect(laptopSub!.platform).toBe("web");

      expect(phoneSub).toBeDefined();
      expect(phoneSub!.isActive).toBe(true);
      expect(phoneSub!.platform).toBe("ios");

      // 4. Test push dispatches to BOTH active devices
      const testPushRes = await triggerTestMobileAlert("FOLLOWUP_REMINDER");
      expect(testPushRes.success).toBe(true);
      expect(testPushRes.data!.activeSubscriptions).toBe(2);
      expect(testPushRes.data!.pushSent).toBe(2);

      // 5. Deactivating one device (e.g. phone) leaves laptop active
      const unregPhone = await unregisterMobileSubscription(phoneEndpoint);
      expect(unregPhone.success).toBe(true);

      const remainingSubs = await MobileSubscriptionStore.getActiveSubscriptions(TEST_USER_ID);
      expect(remainingSubs.length).toBe(1);
      expect(remainingSubs[0].endpoint).toBe(laptopEndpoint);
      expect(remainingSubs[0].isActive).toBe(true);
    });

    it("safely syncs and re-activates an existing phone subscription without affecting laptop", async () => {
      const laptopEndpoint = "https://fcm.googleapis.com/fcm/send/laptop-sync-test";
      const phoneEndpoint = "https://web.push.apple.com/phone-sync-test";

      // Register laptop
      await registerMobileSubscription({
        endpoint: laptopEndpoint,
        keys: { p256dh: "lk", auth: "la" },
        platform: "web",
      });

      // Register phone then simulate it becoming inactive (e.g. from prior network error)
      await registerMobileSubscription({
        endpoint: phoneEndpoint,
        keys: { p256dh: "pk", auth: "pa" },
        platform: "ios",
      });
      await db.mobilePushSubscription.update({
        where: { endpoint: phoneEndpoint },
        data: { isActive: false },
      });

      // Laptop is active, phone is inactive
      let active = await MobileSubscriptionStore.getActiveSubscriptions(TEST_USER_ID);
      expect(active.length).toBe(1);
      expect(active[0].endpoint).toBe(laptopEndpoint);

      // Sync phone subscription
      const syncRes = await syncDeviceSubscription({
        endpoint: phoneEndpoint,
        keys: { p256dh: "pk", auth: "pa" },
        platform: "ios",
      });
      expect(syncRes.success).toBe(true);
      expect(syncRes.data!.isActive).toBe(true);

      // Both are now active
      active = await MobileSubscriptionStore.getActiveSubscriptions(TEST_USER_ID);
      expect(active.length).toBe(2);
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
      expect(cycle1.data!.dispatched).toBeGreaterThan(0);

      // 2nd dispatch cycle immediately after
      const cycle2 = await dispatchMobileAlerts();
      expect(cycle2.success).toBe(true);
      // Alerts matching previous dedupe keys should be skipped
      expect(cycle2.data!.skippedDuplicate).toBeGreaterThan(0);

      // Verify dispatch history
      const history = await getDispatchedMobileAlerts(10);
      expect(history.success).toBe(true);
      expect(history.data!.length).toBeGreaterThan(0);
    });
  });

  describe("6. Root Cause Investigation & Referential Integrity Protection", () => {
    const testEndpoint1 = "https://fcm.googleapis.com/fcm/send/device-endpoint-root-cause-1";
    const testEndpoint2 = "https://fcm.googleapis.com/fcm/send/device-endpoint-root-cause-2";

    it("1. Valid authenticated user → subscription created", async () => {
      vi.mocked(getSession).mockResolvedValueOnce({
        id: TEST_USER_ID,
        email: "mobile-tester@example.com",
        role: "ADMIN",
      });

      const res = await registerMobileSubscription({
        endpoint: testEndpoint1,
        keys: { p256dh: "key-1", auth: "auth-1" },
        platform: "android",
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data!.endpoint).toBe(testEndpoint1);
      expect(res.data!.isActive).toBe(true);
    });

    it("2. Same device registers again → existing subscription updated, no duplicate", async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: TEST_USER_ID,
        email: "mobile-tester@example.com",
        role: "ADMIN",
      });

      // Initial registration
      await registerMobileSubscription({
        endpoint: testEndpoint2,
        keys: { p256dh: "key-2a", auth: "auth-2a" },
        platform: "web",
      });

      // Re-register same device with updated platform & keys
      const res = await registerMobileSubscription({
        endpoint: testEndpoint2,
        keys: { p256dh: "key-2b", auth: "auth-2b" },
        platform: "ios",
      });

      expect(res.success).toBe(true);
      expect(res.data!.platform).toBe("ios");

      // Verify only 1 record exists for this endpoint
      const records = await db.mobilePushSubscription.findMany({
        where: { endpoint: testEndpoint2 },
      });
      expect(records.length).toBe(1);
      expect(records[0].platform).toBe("ios");
    });

    it("3. userId stored in MobilePushSubscription matches real User.id", async () => {
      vi.mocked(getSession).mockResolvedValueOnce({
        id: TEST_USER_ID,
        email: "mobile-tester@example.com",
        role: "ADMIN",
      });

      const res = await registerMobileSubscription({
        endpoint: testEndpoint1,
        keys: { p256dh: "key-1", auth: "auth-1" },
        platform: "android",
      });
      expect(res.success).toBe(true);

      const dbSub = await db.mobilePushSubscription.findUnique({
        where: { endpoint: testEndpoint1 },
      });

      expect(dbSub).not.toBeNull();
      expect(dbSub!.userId).toBe(TEST_USER_ID);

      const dbUser = await db.user.findUnique({
        where: { id: dbSub!.userId },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser!.id).toBe(TEST_USER_ID);
    });

    it("4. invalid/stale session user → no DB write", async () => {
      const staleEndpoint = "https://fcm.googleapis.com/fcm/send/stale-user-device";

      // Mock a stale session whose user ID and email do not exist in DB
      vi.mocked(getSession).mockResolvedValueOnce({
        id: "totally-non-existent-user-uuid",
        email: "deleted-user@example.com",
        role: "USER",
      });

      const res = await registerMobileSubscription({
        endpoint: staleEndpoint,
        keys: { p256dh: "key-stale", auth: "auth-stale" },
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();

      // Verify no DB record was written
      const record = await db.mobilePushSubscription.findUnique({
        where: { endpoint: staleEndpoint },
      });
      expect(record).toBeNull();
    });

    it("5. anonymous user → rejected", async () => {
      const anonEndpoint = "https://fcm.googleapis.com/fcm/send/anon-device";

      vi.mocked(getSession).mockResolvedValueOnce(null);

      const res = await registerMobileSubscription({
        endpoint: anonEndpoint,
        keys: { p256dh: "key-anon", auth: "auth-anon" },
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("logged in");

      const record = await db.mobilePushSubscription.findUnique({
        where: { endpoint: anonEndpoint },
      });
      expect(record).toBeNull();
    });

    it("6. raw Prisma error never reaches UI or response", async () => {
      vi.mocked(getSession).mockResolvedValueOnce({
        id: TEST_USER_ID,
        email: "mobile-tester@example.com",
        role: "ADMIN",
      });

      // Force a raw Prisma constraint error to simulate low-level DB driver failure
      const spy = vi
        .spyOn(MobileSubscriptionStore, "registerSubscription")
        .mockRejectedValueOnce(
          new Error(
            "Invalid `prisma.mobilePushSubscription.upsert()` invocation: Foreign key constraint violated: `MobilePushSubscription_userId_fkey (index)`"
          )
        );

      const res = await registerMobileSubscription({
        endpoint: "https://fcm.googleapis.com/fcm/send/error-test-endpoint",
      });

      spy.mockRestore();

      expect(res.success).toBe(false);
      expect(res.error).toBe("Couldn’t enable notifications. Please try again.");
      // Must never contain raw Prisma or DB internals
      expect(res.error).not.toContain("prisma");
      expect(res.error).not.toContain("Prisma");
      expect(res.error).not.toContain("Foreign key");
      expect(res.error).not.toContain("MobilePushSubscription_userId_fkey");
      expect(res.error).not.toContain("invocation");
    });

    it("7. notification can be disabled/unregistered", async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: TEST_USER_ID,
        email: "mobile-tester@example.com",
        role: "ADMIN",
      });

      await registerMobileSubscription({
        endpoint: testEndpoint1,
        keys: { p256dh: "key-1", auth: "auth-1" },
        platform: "android",
      });

      const unreg = await unregisterMobileSubscription(testEndpoint1);
      expect(unreg.success).toBe(true);
      expect(unreg.data?.unregistered).toBe(true);

      const subRecord = await db.mobilePushSubscription.findUnique({
        where: { endpoint: testEndpoint1 },
      });
      expect(subRecord).not.toBeNull();
      expect(subRecord!.isActive).toBe(false);
    });

    it("8. recovers gracefully when session has stale ID but valid authenticated email", async () => {
      const reseededEndpoint = "https://fcm.googleapis.com/fcm/send/reseeded-db-token";

      // Simulate a DB re-seed where session holds an old ID, but email matches the existing DB user
      vi.mocked(getSession).mockResolvedValueOnce({
        id: "old-stale-id-from-prior-seed",
        email: "mobile-tester@example.com",
        role: "ADMIN",
      });

      const res = await registerMobileSubscription({
        endpoint: reseededEndpoint,
        keys: { p256dh: "k", auth: "a" },
        platform: "web",
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data!.userId).toBe(TEST_USER_ID);

      const record = await db.mobilePushSubscription.findUnique({
        where: { endpoint: reseededEndpoint },
      });
      expect(record).not.toBeNull();
      expect(record!.userId).toBe(TEST_USER_ID);
    });
  });

  describe("7. Test Push Delivery Flow", () => {
    it("1. returns friendly error when no active subscription exists", async () => {
      vi.mocked(getSession).mockResolvedValueOnce({
        id: TEST_USER_ID,
        email: "mobile-tester@example.com",
        role: "ADMIN",
      });

      const res = await triggerTestMobileAlert("FOLLOWUP_REMINDER");
      expect(res.success).toBe(false);
      expect(res.error).toBe("No active device subscription found. Please enable notifications again.");
    });

    it("2. dispatches test alert successfully to active subscription with expected shape", async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: TEST_USER_ID,
        email: "mobile-tester@example.com",
        role: "ADMIN",
      });

      const endpoint = "mock://device-test-push-success";
      await registerMobileSubscription({
        endpoint,
        keys: { p256dh: "key-success", auth: "auth-success" },
        platform: "android",
      });

      const res = await triggerTestMobileAlert("FOLLOWUP_REMINDER");
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data!.pushSent).toBe(1);
      expect(res.data!.activeSubscriptions).toBe(1);
      expect(res.data!.title).toContain("Test Follow-up Reminder");
      expect(res.data!.payload).toBeDefined();
      expect(res.data!.payload.data.category).toBe("FOLLOWUP_REMINDER");

      // Verify audit record in DB
      const history = await MobileSubscriptionStore.getDispatchedAlerts(5);
      expect(history.some((h) => h.dedupeKey === res.data!.dedupeKey && h.success)).toBe(true);
    });

    it("3. handles expired/unsubscribed subscription (410) by deactivating it and returning clean error", async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: TEST_USER_ID,
        email: "mobile-tester@example.com",
        role: "ADMIN",
      });

      const endpoint = "https://fcm.googleapis.com/fcm/send/expired-device-token";
      await registerMobileSubscription({
        endpoint,
        keys: { p256dh: "key-exp", auth: "auth-exp" },
        platform: "web",
      });

      // Spy on sendRealPushNotification to simulate 410 Gone from push provider
      const webpush = await import("@/lib/webpush");
      const spy = vi.spyOn(webpush, "sendRealPushNotification").mockImplementationOnce(async (recipient) => {
        await db.mobilePushSubscription.updateMany({
          where: { endpoint: recipient.endpoint },
          data: { isActive: false },
        });
        return {
          endpoint: recipient.endpoint,
          success: false,
          statusCode: 410,
          error: "Received unexpected response code",
        };
      });

      const res = await triggerTestMobileAlert("FOLLOWUP_REMINDER");
      spy.mockRestore();

      expect(res.success).toBe(false);
      expect(res.error).toBe("Your push subscription has expired or was revoked. Please enable notifications again.");

      // Verify subscription was safely deactivated in DB
      const subRecord = await db.mobilePushSubscription.findUnique({
        where: { endpoint },
      });
      expect(subRecord).not.toBeNull();
      expect(subRecord!.isActive).toBe(false);
    });

    it("4. handles push provider rejection cleanly without exposing raw server/VAPID errors", async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: TEST_USER_ID,
        email: "mobile-tester@example.com",
        role: "ADMIN",
      });

      const endpoint = "https://fcm.googleapis.com/fcm/send/rejected-device-token";
      await registerMobileSubscription({
        endpoint,
        keys: { p256dh: "key-rej", auth: "auth-rej" },
        platform: "ios",
      });

      const webpush = await import("@/lib/webpush");
      const spy = vi.spyOn(webpush, "sendRealPushNotification").mockResolvedValueOnce({
        endpoint,
        success: false,
        statusCode: 400,
        error: "WebPushError: Received unexpected response code",
      });

      const res = await triggerTestMobileAlert("FOLLOWUP_REMINDER");
      spy.mockRestore();

      expect(res.success).toBe(false);
      expect(res.error).toBe("Push provider was unable to deliver the alert. Please re-enable notifications.");
      expect(res.error).not.toContain("WebPushError");
      expect(res.error).not.toContain("unexpected response");
      expect(res.error).not.toContain("statusCode");
    });
  });
});
