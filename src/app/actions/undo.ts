"use server";

import { getSession } from "@/lib/auth";
import { executeUndo, UndoConcurrencyError, UndoValidationError } from "@/features/undo/services/undo-engine";
import type { UndoActionResult, PerformUndoResult } from "@/features/undo/types";

class UserFacingError extends Error {}

async function requireAuthenticatedUser() {
  const session = await getSession();
  if (!session || typeof session.id !== "string") {
    throw new UserFacingError("You must be signed in to perform this action.");
  }
  return session;
}

/**
 * Universal Server Action to execute any persisted Undo Action.
 */
export async function performUndo(undoActionId: string): Promise<UndoActionResult<PerformUndoResult>> {
  try {
    const session = await requireAuthenticatedUser();
    const result = await executeUndo(undoActionId, typeof session.id === "string" ? session.id : String(session.id));
    return {
      success: true,
      message: `Undid "${result.description}"`,
      data: result,
      undoId: undoActionId,
    };
  } catch (error) {
    if (error instanceof UndoConcurrencyError) {
      return {
        success: false,
        error: "Unable to undo because this record was changed afterward.",
      };
    }
    if (error instanceof UndoValidationError || error instanceof UserFacingError) {
      return {
        success: false,
        error: error.message,
      };
    }
    if (error instanceof Error) {
      console.error("[Perform Undo Error]:", error.message);
      return {
        success: false,
        error: error.message,
      };
    }
    return {
      success: false,
      error: "Unable to undo at this time. Please try again.",
    };
  }
}
