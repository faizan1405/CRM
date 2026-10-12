import { NextResponse } from "next/server";
import { requireBackupAdmin, toBackupErrorMessage } from "@/lib/backup/auth";
import { activeJobForUser, jobToSnapshot, startBackupJob } from "@/lib/backup/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

/**
 * Starts a complete CRM backup for the authenticated administrator.
 * Authorisation, generation, verification and packaging all happen server-side; the browser only
 * ever receives status metadata here and the archive itself from the owner-scoped download route.
 */
export async function POST() {
  try {
    const actor = await requireBackupAdmin();
    const job = await startBackupJob(actor);
    return NextResponse.json({ success: true, job }, { status: 202, headers: NO_STORE_HEADERS });
  } catch (error) {
    const { message, status } = toBackupErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status, headers: NO_STORE_HEADERS });
  }
}

/** Returns the admin's in-flight or ready job (so a page reload can re-attach to progress). */
export async function GET() {
  try {
    const actor = await requireBackupAdmin();
    const job = activeJobForUser(actor.id);
    return NextResponse.json(
      { success: true, job: job ? jobToSnapshot(job) : null },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    const { message, status } = toBackupErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status, headers: NO_STORE_HEADERS });
  }
}