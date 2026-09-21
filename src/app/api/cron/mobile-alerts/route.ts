import { NextResponse } from "next/server";
import { runDueFollowUpCheck } from "@/features/notifications/services/mobile-scheduler";

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

  if (!cronSecret || !providedToken || providedToken !== cronSecret) {
    return NextResponse.json(
      { success: false, error: "Unauthorized. Invalid or missing CRON_SECRET." },
      { status: 401 }
    );
  }

  try {
    const result = await runDueFollowUpCheck();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
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
