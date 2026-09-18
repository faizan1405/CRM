import { evaluateMobileAlerts } from "./mobile-alert-engine";
import { MobileSubscriptionStore } from "./mobile-subscription-store";
import { sendRealPushNotification } from "@/lib/webpush";

interface SchedulerState {
  isRunning: boolean;
  intervalId: NodeJS.Timeout | null;
  lastRunAt: Date | null;
  totalRuns: number;
}

const globalForScheduler = globalThis as unknown as {
  __mobileSchedulerState?: SchedulerState;
};

const state: SchedulerState = globalForScheduler.__mobileSchedulerState ?? {
  isRunning: false,
  intervalId: null,
  lastRunAt: null,
  totalRuns: 0,
};

globalForScheduler.__mobileSchedulerState = state;

/**
 * Executes a single evaluation and dispatch cycle for all due follow-ups and urgent alerts.
 * Iterates through all active devices (phones and laptops) independently.
 */
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

      // Deliver Web Push to all active devices independently (iPhone, Android, Laptop)
      if (activeSubs.length > 0) {
        for (const sub of activeSubs) {
          try {
            const res = await sendRealPushNotification(sub, alert.payload);
            if (res.success) {
              pushDeliveries++;
              console.log(`[Scheduler] Delivered alert '${alert.title}' to ${sub.platform} (${sub.endpoint.slice(0, 40)}...)`);
            } else {
              console.warn(`[Scheduler] Push delivery failed for ${sub.platform} (${res.statusCode}): ${res.error}`);
            }
          } catch (pushErr) {
            console.warn(`[Scheduler] Error sending push to ${sub.endpoint}:`, pushErr);
          }
        }
      }

      // Record dispatch with durable dedupeKey so server restarts or subsequent runs will never duplicate
      await MobileSubscriptionStore.recordDispatch(alert, undefined, true);
      dispatched++;
    }

    state.lastRunAt = new Date();
    state.totalRuns++;

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

/**
 * Starts the automatic background scheduler running every intervalMs (default: 30 seconds).
 */
export function startMobileScheduler(intervalMs: number = 30000): void {
  if (state.isRunning && state.intervalId) {
    return;
  }

  state.isRunning = true;
  console.log(`[Scheduler] Mobile follow-up scheduler started (interval: ${intervalMs}ms)`);

  // Run initial check after 5 seconds to let server boot cleanly
  setTimeout(() => {
    runDueFollowUpCheck().catch((err) => {
      console.error("[Scheduler] Initial follow-up check failed:", err);
    });
  }, 5000);

  state.intervalId = setInterval(() => {
    runDueFollowUpCheck().catch((err) => {
      console.error("[Scheduler] Interval follow-up check failed:", err);
    });
  }, intervalMs);

  // Do not block process exit
  if (state.intervalId.unref) {
    state.intervalId.unref();
  }
}

/**
 * Stops the background scheduler
 */
export function stopMobileScheduler(): void {
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  state.isRunning = false;
  console.log("[Scheduler] Mobile follow-up scheduler stopped.");
}

export function getSchedulerStatus() {
  return {
    isRunning: state.isRunning,
    lastRunAt: state.lastRunAt?.toISOString() ?? null,
    totalRuns: state.totalRuns,
  };
}
