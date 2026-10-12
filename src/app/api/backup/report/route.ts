import { NextResponse } from "next/server";
import { requireBackupAdmin, toBackupErrorMessage } from "@/lib/backup/auth";
import { REPORT_DEFINITIONS } from "@/lib/backup/constants";
import { generateSingleReport } from "@/lib/backup/pipeline";
import type { ReportKey } from "@/lib/backup/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Downloads one PDF report on its own (for example just the Finance Report). The report is rendered
 * from the same all-time read-only snapshot as the complete backup, so the figures always agree.
 */
export async function GET(request: Request) {
  try {
    const actor = await requireBackupAdmin();
    const { searchParams } = new URL(request.url);
    const requested = (searchParams.get("type") ?? "overview") as ReportKey;
    const definition = REPORT_DEFINITIONS.find((entry) => entry.key === requested);

    if (!definition) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown report type. Available reports: ${REPORT_DEFINITIONS.map((entry) => entry.key).join(", ")}.`,
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const report = await generateSingleReport({ actor, reportKey: definition.key });

    return new NextResponse(new Uint8Array(report.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${report.filename}"`,
        "Content-Length": String(report.buffer.length),
        "X-Report-Pages": String(report.pages),
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    const { message, status } = toBackupErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}