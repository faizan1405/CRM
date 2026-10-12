import { NextResponse } from "next/server";
import { requireBackupAdmin, toBackupErrorMessage } from "@/lib/backup/auth";
import { generateCompleteBackup } from "@/lib/backup/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * One-shot synchronous backup download.
 *
 * This is the compatibility path for hosts that cannot keep an in-process job registry (stateless
 * serverless functions): the archive is generated, validated and streamed in a single response.
 * Nothing is left behind on disk, so the temporary-artifact lifetime is zero.
 */
export async function POST() {
  try {
    const actor = await requireBackupAdmin();
    const result = await generateCompleteBackup({ actor });

    return new NextResponse(new Uint8Array(result.zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": String(result.bytes),
        "X-Backup-Filename": result.filename,
        "X-Backup-Sha256": result.checksumSha256,
        "X-Backup-Records": String(result.manifest.totals.totalRecords),
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    const { message, status } = toBackupErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}