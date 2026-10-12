import { NextResponse } from "next/server";
import { requireBackupAdmin, toBackupErrorMessage } from "@/lib/backup/auth";
import { getJob, jobToSnapshot, sweepExpiredJobs } from "@/lib/backup/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

/**
 * Progress endpoint. Only the administrator who started the job can read it; any other user (or
 * unknown id) receives 404 so job ids cannot be probed.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const actor = await requireBackupAdmin();
    sweepExpiredJobs();
    const { jobId } = await params;
    const job = getJob(jobId);

    if (!job || job.userId !== actor.id) {
      return NextResponse.json(
        { success: false, error: "Backup job not found." },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json({ success: true, job: jobToSnapshot(job) }, { status: 200, headers: NO_STORE_HEADERS });
  } catch (error) {
    const { message, status } = toBackupErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status, headers: NO_STORE_HEADERS });
  }
}