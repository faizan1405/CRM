import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * A complete CRM backup contains the entire business dataset, so it is restricted to
 * authenticated administrators. The check reuses the existing CRM session (JWT cookie)
 * and re-validates the role against the database on every request.
 */
export class BackupAuthorizationError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BackupAuthorizationError";
    this.status = status;
  }
}

export interface BackupActor {
  id: string;
  name: string;
  email: string;
  role: string;
}

export async function requireBackupAdmin(): Promise<BackupActor> {
  const session = await getSession();
  if (!session) {
    throw new BackupAuthorizationError("You must be signed in to download a complete CRM backup.", 401);
  }

  const userId =
    typeof session.id === "string" ? session.id : typeof session.userId === "string" ? session.userId : null;
  const email = typeof session.email === "string" && session.email ? session.email : null;

  if (!userId && !email) {
    throw new BackupAuthorizationError("You must be signed in to download a complete CRM backup.", 401);
  }

  const user = userId
    ? await db.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true },
      })
    : await db.user.findUnique({
        where: { email: email as string },
        select: { id: true, name: true, email: true, role: true },
      });

  if (!user) {
    throw new BackupAuthorizationError(
      "Your session is invalid or the user account no longer exists. Please log in again.",
      401
    );
  }

  if (user.role !== "ADMIN") {
    throw new BackupAuthorizationError("Only administrators can download a complete CRM backup.", 403);
  }

  return user;
}

/**
 * Messages returned to the browser. Never echoes database/driver internals or secrets.
 */
export function toBackupErrorMessage(error: unknown): { message: string; status: number } {
  if (error instanceof BackupAuthorizationError) {
    return { message: error.message, status: error.status };
  }
  if (error instanceof Error && error.message) {
    return { message: error.message, status: 500 };
  }
  return { message: "Backup generation failed. Please try again.", status: 500 };
}