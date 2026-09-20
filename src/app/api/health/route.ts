import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = performance.now();
  try {
    // Perform a minimal read-only check
    const dbStartedAt = performance.now();
    await db.$queryRaw`SELECT 1`;
    const dbLatencyMs = Math.round((performance.now() - dbStartedAt) * 10) / 10;

    return NextResponse.json({
      status: "ok",
      database: "reachable",
      dbLatencyMs,
      appResponseMs: Math.round((performance.now() - startedAt) * 10) / 10,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        database: "unreachable",
        dbLatencyMs: null,
        appResponseMs: Math.round((performance.now() - startedAt) * 10) / 10,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
