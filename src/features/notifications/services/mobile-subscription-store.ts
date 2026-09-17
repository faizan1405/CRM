import { db } from "@/lib/db";
import type {
  MobileDeviceSubscription,
  MobileSubscriptionInput,
  MobilePlatform,
  MobileAlertItem,
} from "../types/mobile";

export class MobileSubscriptionStore {
  /**
   * Persists / upserts a push subscription to PostgreSQL database
   */
  static async registerSubscription(
    userId: string,
    input: MobileSubscriptionInput
  ): Promise<MobileDeviceSubscription> {
    if (!input.endpoint || typeof input.endpoint !== "string") {
      throw new Error("Push endpoint is required for mobile subscription.");
    }

    const endpoint = input.endpoint.trim();
    const platform = (input.platform as MobilePlatform) || "web";

    // Verify the user exists in database to guarantee FK integrity and avoid orphan subscriptions
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new Error(`Cannot register mobile push subscription: user '${userId}' does not exist.`);
    }

    const record = await db.mobilePushSubscription.upsert({
      where: { endpoint },
      update: {
        userId,
        p256dh: input.keys?.p256dh ?? undefined,
        auth: input.keys?.auth ?? undefined,
        platform,
        userAgent: input.userAgent ?? undefined,
        isActive: true,
      },
      create: {
        userId,
        endpoint,
        p256dh: input.keys?.p256dh ?? null,
        auth: input.keys?.auth ?? null,
        platform,
        userAgent: input.userAgent ?? null,
        isActive: true,
      },
    });

    return {
      id: record.id,
      userId: record.userId,
      endpoint: record.endpoint,
      p256dh: record.p256dh,
      auth: record.auth,
      platform: (record.platform as MobilePlatform) || "web",
      userAgent: record.userAgent,
      isActive: record.isActive,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  /**
   * Deactivates a push subscription in DB
   */
  static async unregisterSubscription(endpoint: string): Promise<boolean> {
    const trimmed = endpoint.trim();
    const result = await db.mobilePushSubscription.updateMany({
      where: { endpoint: trimmed },
      data: { isActive: false },
    });
    return result.count > 0;
  }

  /**
   * Loads all active subscriptions from DB (for a user or all users)
   */
  static async getActiveSubscriptions(userId?: string): Promise<MobileDeviceSubscription[]> {
    const records = await db.mobilePushSubscription.findMany({
      where: {
        isActive: true,
        ...(userId ? { userId } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    return records.map((r) => ({
      id: r.id,
      userId: r.userId,
      endpoint: r.endpoint,
      p256dh: r.p256dh,
      auth: r.auth,
      platform: (r.platform as MobilePlatform) || "web",
      userAgent: r.userAgent,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  /**
   * Checks if an alert with dedupeKey was already successfully dispatched
   */
  static async isAlreadyDispatched(dedupeKey: string): Promise<boolean> {
    const existing = await db.dispatchedMobileAlert.findUnique({
      where: { dedupeKey },
    });
    return Boolean(existing && existing.success);
  }

  /**
   * Records a dispatched alert in PostgreSQL DB for persistent audit & deduplication
   */
  static async recordDispatch(
    alert: MobileAlertItem,
    userId?: string,
    success: boolean = true
  ) {
    await db.dispatchedMobileAlert.upsert({
      where: { dedupeKey: alert.dedupeKey },
      update: {
        userId: userId ?? undefined,
        leadId: alert.leadId,
        category: alert.category,
        title: alert.title,
        body: alert.body,
        dispatchedAt: new Date(),
        success,
      },
      create: {
        dedupeKey: alert.dedupeKey,
        userId: userId ?? null,
        leadId: alert.leadId,
        category: alert.category,
        title: alert.title,
        body: alert.body,
        dispatchedAt: new Date(),
        success,
      },
    });
  }

  /**
   * Retrieves recent dispatched alert history from DB
   */
  static async getDispatchedAlerts(limit: number = 50) {
    const records = await db.dispatchedMobileAlert.findMany({
      orderBy: { dispatchedAt: "desc" },
      take: limit,
    });

    return records.map((r) => ({
      id: r.id,
      dedupeKey: r.dedupeKey,
      userId: r.userId || undefined,
      leadId: r.leadId || undefined,
      category: r.category,
      title: r.title,
      body: r.body,
      dispatchedAt: r.dispatchedAt.toISOString(),
      success: r.success,
    }));
  }

  /**
   * Clean test data
   */
  static async clearForTesting() {
    await db.dispatchedMobileAlert.deleteMany({});
    await db.mobilePushSubscription.deleteMany({});
  }
}
