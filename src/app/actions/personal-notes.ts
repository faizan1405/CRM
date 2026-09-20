"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import type { PersonalNote, PersonalNoteActionResult, AITransformAction } from "@/features/personal-notes/types";
import {
  cleanPersonalNote as cleanService,
  organizePersonalNote as organizeService,
  rewritePersonalNoteClearly as rewriteService,
  summarizePersonalNote as summarizeService,
  transformPersonalNote as transformService,
  improvePersonalNoteService,
} from "@/features/personal-notes/services/notes-ai-transformer";

class UserFacingError extends Error {}

async function requireAuthenticatedUser(): Promise<{ id: string; email: string }> {
  const session = await getSession();
  if (!session || typeof session.id !== "string") {
    throw new UserFacingError("You must be signed in to access personal notes.");
  }
  return session as { id: string; email: string };
}

function cleanError(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred. Please try again.";
}

function serializeNote(dbNote: {
  id: string;
  userId: string;
  title: string | null;
  content: string;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PersonalNote {
  return {
    id: dbNote.id,
    userId: dbNote.userId,
    title: dbNote.title ?? "",
    content: dbNote.content,
    pinned: dbNote.isPinned,
    isPinned: dbNote.isPinned,
    createdAt: dbNote.createdAt.toISOString(),
    updatedAt: dbNote.updatedAt.toISOString(),
  };
}

export async function getPersonalNotes(): Promise<PersonalNoteActionResult<PersonalNote[]>> {
  try {
    const user = await requireAuthenticatedUser();
    const notes = await db.personalNote.findMany({
      where: { userId: user.id },
      orderBy: [
        { isPinned: "desc" },
        { updatedAt: "desc" },
      ],
    });

    return {
      success: true,
      data: notes.map(serializeNote),
    };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function createPersonalNote(input: {
  title?: string;
  content: string;
  pinned?: boolean;
  isPinned?: boolean;
}): Promise<PersonalNoteActionResult<PersonalNote>> {
  try {
    const user = await requireAuthenticatedUser();
    const content = (input.content ?? "").trim();
    if (!content) {
      throw new UserFacingError("Note content cannot be empty.");
    }

    const title = (input.title ?? "").trim();
    const isPinned = Boolean(input.pinned ?? input.isPinned ?? false);

    const note = await db.personalNote.create({
      data: {
        userId: user.id,
        title: title || null,
        content,
        isPinned,
      },
    });

    try {
      revalidatePath("/personal-notes");
    } catch {
      // Safe fallback outside request context
    }

    return {
      success: true,
      data: serializeNote(note),
    };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function updatePersonalNote(
  id: string,
  updates: {
    title?: string;
    content?: string;
    pinned?: boolean;
    isPinned?: boolean;
  }
): Promise<PersonalNoteActionResult<PersonalNote>> {
  try {
    const user = await requireAuthenticatedUser();
    if (!id) throw new UserFacingError("Note ID is required.");

    const existing = await db.personalNote.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== user.id) {
      throw new UserFacingError("Note not found or you do not have permission to edit it.");
    }

    const dataToUpdate: {
      title?: string | null;
      content?: string;
      isPinned?: boolean;
    } = {};

    if (updates.title !== undefined) {
      dataToUpdate.title = updates.title.trim() || null;
    }

    if (updates.content !== undefined) {
      const trimmed = updates.content.trim();
      if (!trimmed) throw new UserFacingError("Note content cannot be empty.");
      dataToUpdate.content = trimmed;
    }

    if (updates.pinned !== undefined || updates.isPinned !== undefined) {
      dataToUpdate.isPinned = Boolean(updates.pinned ?? updates.isPinned);
    }

    const updated = await db.personalNote.update({
      where: { id },
      data: dataToUpdate,
    });

    try {
      revalidatePath("/personal-notes");
    } catch {
      // Safe fallback
    }

    return {
      success: true,
      data: serializeNote(updated),
    };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function deletePersonalNote(id: string): Promise<PersonalNoteActionResult<{ id: string }>> {
  try {
    const user = await requireAuthenticatedUser();
    if (!id) throw new UserFacingError("Note ID is required.");

    const existing = await db.personalNote.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== user.id) {
      throw new UserFacingError("Note not found or you do not have permission to delete it.");
    }

    await db.personalNote.delete({
      where: { id },
    });

    try {
      revalidatePath("/personal-notes");
    } catch {
      // Safe fallback
    }

    return {
      success: true,
      data: { id },
    };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function togglePersonalNotePinned(
  id: string,
  pinned?: boolean
): Promise<PersonalNoteActionResult<PersonalNote>> {
  try {
    const user = await requireAuthenticatedUser();
    if (!id) throw new UserFacingError("Note ID is required.");

    const existing = await db.personalNote.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== user.id) {
      throw new UserFacingError("Note not found or permission denied.");
    }

    const nextPinned = pinned !== undefined ? pinned : !existing.isPinned;

    const updated = await db.personalNote.update({
      where: { id },
      data: { isPinned: nextPinned },
    });

    try {
      revalidatePath("/personal-notes");
    } catch {
      // Safe fallback
    }

    return {
      success: true,
      data: serializeNote(updated),
    };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function searchPersonalNotes(query: string): Promise<PersonalNoteActionResult<PersonalNote[]>> {
  try {
    const user = await requireAuthenticatedUser();
    const q = (query ?? "").trim().toLowerCase();

    if (!q) {
      return getPersonalNotes();
    }

    const notes = await db.personalNote.findMany({
      where: {
        userId: user.id,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { content: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: [
        { isPinned: "desc" },
        { updatedAt: "desc" },
      ],
    });

    return {
      success: true,
      data: notes.map(serializeNote),
    };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

// ==========================================
// Personal Notes AI Actions (Returns Preview)
// ==========================================

export async function cleanPersonalNote(content: string): Promise<PersonalNoteActionResult<string>> {
  try {
    await requireAuthenticatedUser();
    const preview = await cleanService(content);
    return { success: true, data: preview };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function organizePersonalNote(content: string): Promise<PersonalNoteActionResult<string>> {
  try {
    await requireAuthenticatedUser();
    const preview = await organizeService(content);
    return { success: true, data: preview };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function rewritePersonalNoteClearly(content: string): Promise<PersonalNoteActionResult<string>> {
  try {
    await requireAuthenticatedUser();
    const preview = await rewriteService(content);
    return { success: true, data: preview };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function summarizePersonalNote(content: string): Promise<PersonalNoteActionResult<string>> {
  try {
    await requireAuthenticatedUser();
    const preview = await summarizeService(content);
    return { success: true, data: preview };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export async function transformPersonalNoteAction(
  content: string,
  action: AITransformAction
): Promise<PersonalNoteActionResult<string>> {
  try {
    await requireAuthenticatedUser();
    const preview = await transformService(content, action);
    return { success: true, data: preview };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Narrow server-side action to lightly rewrite a personal CRM note for clarity and readability.
 * Preserves all facts, numbers, amounts, dates, names, URLs, and natural language style without inventing anything.
 * Does NOT auto-save the note.
 */
export async function improvePersonalNote(
  input: string | { text?: string; content?: string }
): Promise<PersonalNoteActionResult<string> & { improvedText?: string }> {
  try {
    await requireAuthenticatedUser();

    const rawText = typeof input === "string" ? input : (input?.text ?? input?.content ?? "");
    const trimmed = (rawText ?? "").trim();
    if (!trimmed) {
      return { success: false, error: "Note content cannot be empty." };
    }

    const improved = await improvePersonalNoteService(trimmed);
    return {
      success: true,
      data: improved,
      improvedText: improved,
    };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

export const improvePersonalNoteAction = improvePersonalNote;

