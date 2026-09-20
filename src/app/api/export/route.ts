import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  exportLeads,
  exportDeals,
  exportPayments,
  exportOutstandingBalances,
  exportFollowUps,
  exportBusinessSummary,
  type ExportFormat,
  type ExportTarget,
  type ExportResult,
} from "@/lib/export";
import {
  fetchLeadsForExport,
  fetchDealsForExport,
  fetchPaymentsForExport,
  fetchOutstandingBalancesForExport,
  fetchFollowUpsForExport,
  fetchBusinessSummary,
} from "@/app/actions/export";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || typeof session.id !== "string") {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized: Please log in to download exports." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const { searchParams } = new URL(request.url);
    const target = (searchParams.get("type") as ExportTarget) || "leads";
    const rawFormat = (searchParams.get("format") || "xlsx").toLowerCase();
    const format: ExportFormat = rawFormat === "csv" ? "csv" : "xlsx";
    const period = searchParams.get("period") === "this_month" ? "this_month" : "all_time";

    let result: ExportResult;

    switch (target) {
      case "leads": {
        const rows = await fetchLeadsForExport();
        result = await exportLeads(rows, format);
        break;
      }
      case "deals": {
        const rows = await fetchDealsForExport();
        result = await exportDeals(rows, format);
        break;
      }
      case "payments": {
        const rows = await fetchPaymentsForExport();
        result = await exportPayments(rows, format);
        break;
      }
      case "outstanding": {
        const rows = await fetchOutstandingBalancesForExport();
        result = await exportOutstandingBalances(rows, format);
        break;
      }
      case "followups": {
        const rows = await fetchFollowUpsForExport();
        result = await exportFollowUps(rows, format);
        break;
      }
      case "business-summary": {
        const summary = await fetchBusinessSummary(period);
        result = await exportBusinessSummary(summary, format);
        break;
      }
      default:
        return new NextResponse(
          JSON.stringify({ error: `Invalid export target: ${target}` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": String(result.buffer.length),
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (error) {
    console.error("[Export API Error]:", error);
    const message = error instanceof Error ? error.message : "Failed to generate export.";
    return new NextResponse(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
