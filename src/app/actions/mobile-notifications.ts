"use server";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { cookies } from "next/headers";
import {
  evaluateMobileAlerts,
  buildMobilePushPayload,
  type AlertEngineOptions,
} from "@/features/notifications/services/mobile-alert-engine";
import { MobileSubscriptionStore } from "@/features/notifications/services/mobile-subscription-store";
import { sendRealPushNotification, getVapidPublicKey } from "@/lib/webpush";
import type {
  MobileAlertCategory,
  MobileAlertItem,
  MobileDeviceSubscription,
  MobileSubscriptionInput,
  MobileActionResult,
  DispatchedAlertRecord,
} from "@/features/notifications/types/mobile";

export type { MobileActionResult } from "@/features/notifications/types/mobile";

class UserFacingError extends Error {}

function cleanErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof Error) {
    const msg = error.message;
    // Strictly prevent any raw database or Prisma errors from leaking
    if (
      msg.includes("prisma") ||
      msg.includes("Prisma") ||
      msg.includes("Foreign key") ||
      msg.includes("Unique constraint") ||
      msg.includes("constraint violated") ||
      msg.includes("invocation") ||
      msg.includes("fkey")
    ) {
      return fallback;
    }
  }
  return fallback;
}

export async function requireAuthenticatedUser(): Promise<{ id: string; email?: string; role?: string; [key: string]: unknown }> {
  const session = await getSession();
  const sessionUserId = typeof session?.id === "string" ? session.id : typeof session?.userId === "string" ? session.userId : null;
  const sessionEmail = typeof session?.email === "string" ? session.email : null;

  if (!session || (!sessionUserId && !sessionEmail)) {
    throw new UserFacingError("You must be logged in to manage mobile notifications.");
  }

  // 1. Verify if sessionUserId exists in the database
  let dbUser = null;
  if (sessionUserId) {
    dbUser = await db.user.findUnique({
      where: { id: sessionUserId },
      select: { id: true, email: true, role: true },
    });
  }

  // 2. If ID changed (e.g. database reseed / recreation) but email matches the authenticated token, resolve by email
  if (!dbUser && sessionEmail) {
    dbUser = await db.user.findUnique({
      where: { email: sessionEmail },
      select: { id: true, email: true, role: true },
    });
  }

  // 3. If user does not exist in DB at all, fail safely and require re-authentication
  if (!dbUser) {
    try {
      const cookieStore = await cookies();
      cookieStore.set("session", "", {
        httpOnly: true,
        expires: new Date(0),
        path: "/",
      });
    } catch {
      // safe fallback if called outside cookie mutation context
    }
    throw new UserFacingError("Your session is invalid or your account was not found. Please log in again.");
  }

  return {
    ...session,
    id: dbUser.id,
    email: dbUser.email,
    role: dbUser.role,
  };
}

/**
 * Returns the public VAPID key needed for mobile browser push subscription
 */
export async function getMobileVapidPublicKey(): Promise<MobileActionResult<string>> {
  try {
    await requireAuthenticatedUser();
    return { success: true, data: getVapidPublicKey() };
  } catch (error) {
    console.error("[MobileVAPID Action Error]:", error);
    return { success: false, error: cleanErrorMessage(error, "Failed to get VAPID key.") };
  }
}

/**
 * Registers a mobile browser / PWA push subscription for the logged-in user in DB
 */
export async function registerMobileSubscription(
  input: MobileSubscriptionInput
): Promise<MobileActionResult<MobileDeviceSubscription>> {
  try {
    const currentUser = await requireAuthenticatedUser();
    if (!input.endpoint || typeof input.endpoint !== "string") {
      return { success: false, error: "Missing subscription endpoint." };
    }

    const sub = await MobileSubscriptionStore.registerSubscription(currentUser.id, input);
    return { success: true, data: sub };
  } catch (error) {
    console.error("[MobilePush Registration Error]:", error);
    return {
      success: false,
      error: cleanErrorMessage(error, "Couldn’t enable notifications. Please try again."),
    };
  }
}

/**
 * Unregisters a mobile push subscription in DB
 */
export async function unregisterMobileSubscription(
  endpoint: string
): Promise<MobileActionResult<{ unregistered: boolean }>> {
  try {
    await requireAuthenticatedUser();
    const unregistered = await MobileSubscriptionStore.unregisterSubscription(endpoint);
    return { success: true, data: { unregistered } };
  } catch (error) {
    console.error("[MobileUnregister Action Error]:", error);
    return { success: false, error: cleanErrorMessage(error, "Failed to unregister.") };
  }
}

/**
 * Syncs and reactivates an existing device subscription in the DB for the logged-in user
 */
export async function syncDeviceSubscription(
  input: MobileSubscriptionInput
): Promise<MobileActionResult<MobileDeviceSubscription>> {
  try {
    const currentUser = await requireAuthenticatedUser();
    if (!input.endpoint || typeof input.endpoint !== "string") {
      return { success: false, error: "Missing subscription endpoint." };
    }

    const sub = await MobileSubscriptionStore.registerSubscription(currentUser.id, input);
    return { success: true, data: sub };
  } catch (error) {
    console.error("[MobilePush Sync Error]:", error);
    return {
      success: false,
      error: cleanErrorMessage(error, "Failed to sync device subscription."),
    };
  }
}

/**
 * Checks if a specific device subscription endpoint exists and is active for the current user
 */
export async function getDeviceSubscriptionStatus(
  endpoint: string
): Promise<MobileActionResult<{ isActive: boolean; exists: boolean }>> {
  try {
    const currentUser = await requireAuthenticatedUser();
    const record = await db.mobilePushSubscription.findUnique({
      where: { endpoint: endpoint.trim() },
      select: { userId: true, isActive: true },
    });

    if (!record || record.userId !== currentUser.id) {
      return { success: true, data: { isActive: false, exists: false } };
    }

    return { success: true, data: { isActive: record.isActive, exists: true } };
  } catch (error) {
    console.error("[GetDeviceSubscriptionStatus Error]:", error);
    return { success: false, error: cleanErrorMessage(error, "Failed to check subscription.") };
  }
}

/**
 * Evaluates pending follow-ups and urgent leads, and dispatches real mobile push alerts
 */
export async function dispatchMobileAlerts(
  options: AlertEngineOptions = {}
): Promise<
  MobileActionResult<{
    evaluated: number;
    dispatched: number;
    skippedDuplicate: number;
    alerts: MobileAlertItem[];
    pushDeliveries: number;
  }>
> {
  try {
    const currentUser = await requireAuthenticatedUser();
    const alerts = await evaluateMobileAlerts(options);

    let dispatched = 0;
    let skippedDuplicate = 0;
    let pushDeliveries = 0;
    const sentAlerts: MobileAlertItem[] = [];

    // Get active subscriptions to push to
    const activeSubs = await MobileSubscriptionStore.getActiveSubscriptions(currentUser.id);

    for (const alert of alerts) {
      const alreadyDispatched = await MobileSubscriptionStore.isAlreadyDispatched(alert.dedupeKey);
      if (alreadyDispatched) {
        skippedDuplicate++;
        continue;
      }

      // Send real push notifications to registered devices
      if (activeSubs.length > 0) {
        for (const sub of activeSubs) {
          try {
            const pushResult = await sendRealPushNotification(sub, alert.payload);
            if (pushResult.success) {
              pushDeliveries++;
            }
          } catch (pushErr) {
            console.warn(`[MobilePush] Failed to deliver alert to ${sub.endpoint}:`, pushErr);
          }
        }
      }

      // Record dispatch in DB
      await MobileSubscriptionStore.recordDispatch(alert, currentUser.id, true);
      sentAlerts.push(alert);
      dispatched++;
    }

    return {
      success: true,
      data: {
        evaluated: alerts.length,
        dispatched,
        skippedDuplicate,
        alerts: sentAlerts,
        pushDeliveries,
      },
    };
  } catch (error) {
    console.error("[DispatchMobileAlerts Error]:", error);
    return { success: false, error: cleanErrorMessage(error, "Failed to dispatch mobile alerts.") };
  }
}

/**
 * Returns dispatched mobile alert history from DB
 */
export async function getDispatchedMobileAlerts(
  limit: number = 20
): Promise<MobileActionResult<DispatchedAlertRecord[]>> {
  try {
    await requireAuthenticatedUser();
    const history = await MobileSubscriptionStore.getDispatchedAlerts(limit);
    return { success: true, data: history };
  } catch (error) {
    console.error("[GetDispatchedMobileAlerts Error]:", error);
    return { success: false, error: cleanErrorMessage(error, "Failed to load history.") };
  }
}

/**
 * Triggers a real test mobile push notification to all active devices of the logged-in user
 */
export async function triggerTestMobileAlert(
  category: MobileAlertCategory = "FOLLOWUP_REMINDER"
): Promise<MobileActionResult<MobileAlertItem & { pushSent: number; activeSubscriptions: number }>> {
  try {
    const currentUser = await requireAuthenticatedUser();
    const title =
      category === "OVERDUE_FOLLOWUP"
        ? "⚠️ Test Overdue Follow-up"
        : category === "URGENT_LEAD"
        ? "🔥 Test Urgent Lead Alert"
        : "⏰ Test Follow-up Reminder";

    const body = "This is a real Web Push test delivery to your mobile device from ScaleFlow CRM.";
    const dedupeKey = `test_${category}_${Date.now()}`;

    const payload = buildMobilePushPayload({
      category,
      title,
      body,
      tag: dedupeKey,
      leadId: "test-lead-id",
      leadName: "Test Lead",
      phone: "+91 99999 88888",
    });

    const alert: MobileAlertItem = {
      id: `alert-test-${Date.now()}`,
      category,
      priority: category === "OVERDUE_FOLLOWUP" ? "CRITICAL" : "HIGH",
      title,
      body,
      leadId: "test-lead-id",
      leadName: "Test Lead",
      phone: "+91 99999 88888",
      payload,
      dedupeKey,
      createdAt: new Date().toISOString(),
    };

    // Find all active subscriptions for the user
    const activeSubs = await MobileSubscriptionStore.getActiveSubscriptions(currentUser.id);

    if (activeSubs.length === 0) {
      return {
        success: false,
        error: "No active device subscription found. Please enable notifications again.",
      };
    }

    let pushSent = 0;
    let hasExpiredSubscription = false;

    for (const sub of activeSubs) {
      try {
        const res = await sendRealPushNotification(sub, payload);
        if (res.success) {
          pushSent++;
        } else if (res.statusCode === 410 || res.statusCode === 404) {
          hasExpiredSubscription = true;
        }
      } catch (err) {
        console.error(`[TestAlert] Error sending to ${sub.endpoint}:`, err);
      }
    }

    if (pushSent === 0) {
      if (hasExpiredSubscription) {
        return {
          success: false,
          error: "Your push subscription has expired or was revoked. Please enable notifications again.",
        };
      }
      return {
        success: false,
        error: "Push provider was unable to deliver the alert. Please re-enable notifications.",
      };
    }

    await MobileSubscriptionStore.recordDispatch(alert, currentUser.id, true);

    return {
      success: true,
      data: {
        ...alert,
        pushSent,
        activeSubscriptions: activeSubs.length,
      },
    };
  } catch (error) {
    console.error("[TriggerTestMobileAlert Error]:", error);
    return { success: false, error: cleanErrorMessage(error, "Failed to send test alert.") };
  }
}
