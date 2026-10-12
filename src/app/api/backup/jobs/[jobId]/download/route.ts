import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { requireBackupAdmin, toBackupErrorMessage } from "@/lib/backup/auth";
import { completeJobDownload, openJobArtifact } from "@/lib/backup/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streams the finished archive exactly once to the administrator who requested it, then deletes the
 * temporary file. The URL is opaque, session-scoped and never exposed as a public link.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const actor = await requireBackupAdmin();
    const { jobId } = await params;
    const handle = await openJobArtifact(jobId, actor.id);

    if (!handle) {
      return NextResponse.json(
        { success: false, error: "This backup artifact is not available. Please generate it again." },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    // The file is removed as soon as the response finishes (or the client disconnects).
    handle.stream.once("close", () => {
      void completeJobDownload(handle.job);
    });

    const body = Readable.toWeb(handle.stream) as unknown as ReadableStream<Uint8Array>;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${handle.filename}"`,
        "Content-Length": String(handle.sizeBytes),
        "X-Backup-Filename": handle.filename,
        ...(handle.job.checksumSha256 ? { "X-Backup-Sha256": handle.job.checksumSha256 } : {}),
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
      },
    });
  } catch (error) {
    const { message, status } = toBackupErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
  }
}