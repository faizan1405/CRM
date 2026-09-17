import { NextResponse } from "next/server";
import { evaluateMobileAlerts } from "@/features/notifications/services/mobile-alert-engine";
import { MobileSubscriptionStore } from "@/features/notifications/services/mobile-subscription-store";
import { sendRealPushNotification } from "@/lib/webpush";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60s max execution

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;
  const headerSecret = request.headers.get("x-cron-secret")?.trim();
  const providedToken = bearerToken || headerSecret;

  if (cronSecret && (!providedToken || providedToken !== cronSecret)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Invalid or missing CRON_SECRET." },
      { status: 401 }
    );
  }

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

      // Deliver Web Push to all active devices
      for (const sub of activeSubs) {
        try {
          const res = await sendRealPushNotification(sub, alert.payload);
          if (res.success) pushDeliveries++;
        } catch (pushErr) {
          console.warn(`[CronMobileAlerts] Push delivery error for ${sub.endpoint}:`, pushErr);
        }
      }

      await MobileSubscriptionStore.recordDispatch(alert, undefined, true);
      dispatched++;
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      activeSubscriptions: activeSubs.length,
      evaluated: alerts.length,
      dispatched,
      skippedDuplicate,
      pushDeliveries,
    });
  } catch (error: unknown) {
    console.error("[CronMobileAlerts] Execution error:", error);
    const message = error instanceof Error ? error.message : "Failed to execute mobile alerts cron.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
