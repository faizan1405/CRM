"use server";

import { getSession } from "@/lib/auth";
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

function cleanErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

async function requireSession(): Promise<{ id: string; [key: string]: unknown }> {
  const session = await getSession();
  const userId = typeof session?.id === "string" ? session.id : typeof session?.userId === "string" ? session.userId : null;
  if (!userId) {
    throw new Error("You must be logged in to manage mobile notifications.");
  }
  return { ...session, id: userId };
}

/**
 * Returns the public VAPID key needed for mobile browser push subscription
 */
export async function getMobileVapidPublicKey(): Promise<MobileActionResult<string>> {
  try {
    await requireSession();
    return { success: true, data: getVapidPublicKey() };
  } catch (error) {
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
    const session = await requireSession();
    if (!input.endpoint) {
      return { success: false, error: "Missing subscription endpoint." };
    }

    const sub = await MobileSubscriptionStore.registerSubscription(session.id, input);
    return { success: true, data: sub };
  } catch (error) {
    return { success: false, error: cleanErrorMessage(error, "Failed to register subscription.") };
  }
}

/**
 * Unregisters a mobile push subscription in DB
 */
export async function unregisterMobileSubscription(
  endpoint: string
): Promise<MobileActionResult<{ unregistered: boolean }>> {
  try {
    await requireSession();
    const unregistered = await MobileSubscriptionStore.unregisterSubscription(endpoint);
    return { success: true, data: { unregistered } };
  } catch (error) {
    return { success: false, error: cleanErrorMessage(error, "Failed to unregister.") };
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
    const session = await requireSession();
    const alerts = await evaluateMobileAlerts(options);

    let dispatched = 0;
    let skippedDuplicate = 0;
    let pushDeliveries = 0;
    const sentAlerts: MobileAlertItem[] = [];

    // Get active subscriptions to push to
    const activeSubs = await MobileSubscriptionStore.getActiveSubscriptions(session.id);

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
      await MobileSubscriptionStore.recordDispatch(alert, session.id, true);
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
    await requireSession();
    const history = await MobileSubscriptionStore.getDispatchedAlerts(limit);
    return { success: true, data: history };
  } catch (error) {
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
    const session = await requireSession();
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
    const activeSubs = await MobileSubscriptionStore.getActiveSubscriptions(session.id);
    let pushSent = 0;

    for (const sub of activeSubs) {
      try {
        const res = await sendRealPushNotification(sub, payload);
        if (res.success) {
          pushSent++;
        }
      } catch (err) {
        console.error(`[TestAlert] Error sending to ${sub.endpoint}:`, err);
      }
    }

    await MobileSubscriptionStore.recordDispatch(alert, session.id, true);

    return {
      success: true,
      data: {
        ...alert,
        pushSent,
        activeSubscriptions: activeSubs.length,
      },
    };
  } catch (error) {
    return { success: false, error: cleanErrorMessage(error, "Failed to send test alert.") };
  }
}
