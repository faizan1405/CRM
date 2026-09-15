import { NextResponse } from "next/server";
import { batchAnalyzeLeads } from "@/features/ai-attention/services/attention-engine";

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
    const result = await batchAnalyzeLeads({ limit: 25, concurrency: 3 });
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
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
