import type {
  MobileDeviceSubscription,
  MobileSubscriptionInput,
  MobilePlatform,
  MobileAlertItem,
} from "../types/mobile";

// In-memory persistent storage store with deduplication tracking
const subscriptionStore = new Map<string, MobileDeviceSubscription>();
const dispatchedAlertsLog: {
  id: string;
  dedupeKey: string;
  userId?: string;
  leadId?: string;
  category: string;
  title: string;
  body: string;
  dispatchedAt: string;
  success: boolean;
}[] = [];

export class MobileSubscriptionStore {
  static registerSubscription(
    userId: string,
    input: MobileSubscriptionInput
  ): MobileDeviceSubscription {
    if (!input.endpoint || typeof input.endpoint !== "string") {
      throw new Error("Push endpoint is required for mobile subscription.");
    }

    const endpoint = input.endpoint.trim();
    const existing = subscriptionStore.get(endpoint);
    const now = new Date().toISOString();

    if (existing) {
      existing.userId = userId;
      existing.p256dh = input.keys?.p256dh ?? existing.p256dh;
      existing.auth = input.keys?.auth ?? existing.auth;
      existing.platform = input.platform ?? existing.platform;
      existing.userAgent = input.userAgent ?? existing.userAgent;
      existing.isActive = true;
      existing.updatedAt = now;
      subscriptionStore.set(endpoint, existing);
      return existing;
    }

    const newSub: MobileDeviceSubscription = {
      id: `sub-${Math.random().toString(36).slice(2, 10)}`,
      userId,
      endpoint,
      p256dh: input.keys?.p256dh ?? null,
      auth: input.keys?.auth ?? null,
      platform: (input.platform as MobilePlatform) || "web",
      userAgent: input.userAgent ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    subscriptionStore.set(endpoint, newSub);
    return newSub;
  }

  static unregisterSubscription(endpoint: string): boolean {
    const sub = subscriptionStore.get(endpoint.trim());
    if (!sub) return false;
    sub.isActive = false;
    sub.updatedAt = new Date().toISOString();
    return true;
  }

  static getActiveSubscriptions(userId?: string): MobileDeviceSubscription[] {
    const all = Array.from(subscriptionStore.values()).filter((s) => s.isActive);
    if (userId) return all.filter((s) => s.userId === userId);
    return all;
  }

  static isAlreadyDispatched(dedupeKey: string): boolean {
    return dispatchedAlertsLog.some((d) => d.dedupeKey === dedupeKey && d.success);
  }

  static recordDispatch(
    alert: MobileAlertItem,
    userId?: string,
    success: boolean = true
  ) {
    dispatchedAlertsLog.push({
      id: `dispatch-${Math.random().toString(36).slice(2, 10)}`,
      dedupeKey: alert.dedupeKey,
      userId,
      leadId: alert.leadId,
      category: alert.category,
      title: alert.title,
      body: alert.body,
      dispatchedAt: new Date().toISOString(),
      success,
    });
  }

  static getDispatchedAlerts(limit: number = 50) {
    return [...dispatchedAlertsLog].reverse().slice(0, limit);
  }

  static clearForTesting() {
    subscriptionStore.clear();
    dispatchedAlertsLog.length = 0;
  }
}
