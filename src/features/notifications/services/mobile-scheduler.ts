import { evaluateMobileAlerts } from "./mobile-alert-engine";
import { MobileSubscriptionStore } from "./mobile-subscription-store";
import { sendRealPushNotification } from "@/lib/webpush";

export async function runDueFollowUpCheck(): Promise<{
  evaluated: number;
  dispatched: number;
  skippedDuplicate: number;
  pushDeliveries: number;
}> {
  try {
    const alerts = await evaluateMobileAlerts({ reminderWindowMinutes: 60 });
    const activeSubs = await MobileSubscriptionStore.getActiveSubscriptions();

    let dispatched = 0;
    let skippedDuplicate = 0;
    let pushDeliveries = 0;

    for (const alert of alerts) {
      const alreadySent = await MobileSubscriptionStore.isAlreadyDispatched(alert.dedupeKey);
      if (alreadySent) {
        skippedDuplicate++;
        continue;
      }

      if (activeSubs.length > 0) {
        for (const sub of activeSubs) {
          try {
            const res = await sendRealPushNotification(sub, alert.payload);
            if (res.success) {
              pushDeliveries++;
            }
          } catch (pushErr) {
            console.warn(`[Scheduler] Error sending push to ${sub.endpoint}:`, pushErr);
          }
        }
      }

      await MobileSubscriptionStore.recordDispatch(alert, undefined, true);
      dispatched++;
    }

    return {
      evaluated: alerts.length,
      dispatched,
      skippedDuplicate,
      pushDeliveries,
    };
  } catch (error) {
    console.error("[Scheduler] Error in runDueFollowUpCheck:", error);
    return { evaluated: 0, dispatched: 0, skippedDuplicate: 0, pushDeliveries: 0 };
  }
}
