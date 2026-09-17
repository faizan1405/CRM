"use server";

import { getSession } from "@/lib/auth";
import {
  evaluateMobileAlerts,
  buildMobilePushPayload,
  type AlertEngineOptions,
} from "@/features/notifications/services/mobile-alert-engine";
import { MobileSubscriptionStore } from "@/features/notifications/services/mobile-subscription-store";
import type {
  MobileAlertCategory,
  MobileAlertItem,
  MobileDeviceSubscription,
  MobileSubscriptionInput,
} from "@/features/notifications/types/mobile";

export type MobileActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

async function requireSession() {
  const session = await getSession();
  if (!session?.id) {
    throw new Error("You must be logged in to manage mobile notifications.");
  }
  return session;
}

/**
 * Registers a mobile browser / PWA push subscription for the logged-in user
 */
export async function registerMobileSubscription(
  input: MobileSubscriptionInput
): Promise<MobileActionResult<MobileDeviceSubscription>> {
  try {
    const session = await requireSession();
    if (!input.endpoint) {
      return { success: false, error: "Missing subscription endpoint." };
    }

    const sub = MobileSubscriptionStore.registerSubscription(session.id, input);
    return { success: true, data: sub };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to register subscription." };
  }
}

/**
 * Unregisters a mobile push subscription
 */
export async function unregisterMobileSubscription(
  endpoint: string
): Promise<MobileActionResult<{ unregistered: boolean }>> {
  try {
    await requireSession();
    const unregistered = MobileSubscriptionStore.unregisterSubscription(endpoint);
    return { success: true, data: { unregistered } };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to unregister." };
  }
}

/**
 * Evaluates pending follow-ups and urgent leads, and dispatches mobile push alerts
 */
export async function dispatchMobileAlerts(
  options: AlertEngineOptions = {}
): Promise<
  MobileActionResult<{
    evaluated: number;
    dispatched: number;
    skippedDuplicate: number;
    alerts: MobileAlertItem[];
  }>
> {
  try {
    const session = await requireSession();
    const alerts = await evaluateMobileAlerts(options);

    let dispatched = 0;
    let skippedDuplicate = 0;
    const sentAlerts: MobileAlertItem[] = [];

    for (const alert of alerts) {
      if (MobileSubscriptionStore.isAlreadyDispatched(alert.dedupeKey)) {
        skippedDuplicate++;
        continue;
      }

      // Record dispatch for the active user subscriptions
      MobileSubscriptionStore.recordDispatch(alert, session.id, true);
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
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to dispatch mobile alerts." };
  }
}

/**
 * Returns dispatched mobile alert history
 */
export async function getDispatchedMobileAlerts(limit: number = 20) {
  try {
    await requireSession();
    const history = MobileSubscriptionStore.getDispatchedAlerts(limit);
    return { success: true, data: history };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to load history." };
  }
}

/**
 * Triggers a simulated test mobile alert
 */
export async function triggerTestMobileAlert(
  category: MobileAlertCategory = "FOLLOWUP_REMINDER"
): Promise<MobileActionResult<MobileAlertItem>> {
  try {
    const session = await requireSession();
    const title =
      category === "OVERDUE_FOLLOWUP"
        ? "⚠️ Test Overdue Follow-up"
        : category === "URGENT_LEAD"
        ? "🔥 Test Urgent Lead Alert"
        : "⏰ Test Follow-up Reminder";

    const body = "This is a mobile notification test delivery from ScaleFlow CRM.";
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

    MobileSubscriptionStore.recordDispatch(alert, session.id, true);
    return { success: true, data: alert };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to send test alert." };
  }
}
