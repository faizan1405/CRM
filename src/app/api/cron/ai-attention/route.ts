import { NextResponse } from "next/server";
import { batchAnalyzeLeads } from "@/features/ai-attention/services/attention-engine";
import { generateSmartNotifications } from "@/features/notifications/services/notification-generator";
import { getDailySalesBriefingData } from "@/features/daily-briefing/services/briefing-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds max execution

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

  if (!cronSecret || !providedToken || providedToken !== cronSecret) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Invalid or missing CRON_SECRET." },
      { status: 401 }
    );
  }

  try {
    // 1. Batch analyze active leads
    const attentionResult = await batchAnalyzeLeads({ limit: 25, concurrency: 3 });

    // 2. Refresh smart notifications based on updated facts
    let notificationsResult = { created: 0, skipped: 0 };
    try {
      notificationsResult = await generateSmartNotifications();
    } catch (notifErr) {
      console.warn("[Cron] Notification generation warning:", notifErr);
    }

    // 3. Ensure today's daily sales briefing snapshot is ready
    let briefingReady = false;
    try {
      await getDailySalesBriefingData();
      briefingReady = true;
    } catch (briefingErr) {
      console.warn("[Cron] Daily briefing generation warning:", briefingErr);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result: attentionResult,
      notifications: notificationsResult,
      briefingReady,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Background analysis failed",
      },
      { status: 500 }
    );
  }
}

