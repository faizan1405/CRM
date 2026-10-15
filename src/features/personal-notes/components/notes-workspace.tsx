"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Search,
  Plus,
  StickyNote,
  Pin,
  SearchX,
  X,
  AlertCircle,
} from "lucide-react";
import type { PersonalNote, PersonalNotesProps, AITransformAction } from "../types";
import { QuickNoteBox } from "./quick-note-box";
import { NoteCard } from "./note-card";
import { NoteEditor } from "./note-editor";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import {
  createPersonalNote,
  updatePersonalNote,
  deletePersonalNote,
  togglePersonalNotePinned,
  transformPersonalNoteAction,
  improvePersonalNote,
} from "@/app/actions/personal-notes";
import { useToast } from "@/components/toast-provider";

export function NotesWorkspace({
  initialNotes = [],
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onPinNote,
  onAITransform,
  onImproveNote,
}: PersonalNotesProps) {
  const [notes, setNotes] = useState<PersonalNote[]>(initialNotes);

  // Sync notes with incoming data on revalidation / route refresh
  useEffect(() => {
    setNotes(initialNotes);
    setSelectedNote((prev) => {
      if (!prev) return null;
      const updated = initialNotes.find((n) => n.id === prev.id);
      return updated || prev;
    });
  }, [initialNotes]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNote, setSelectedNote] = useState<PersonalNote | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingNote, setDeletingNote] = useState<PersonalNote | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { showToast, showUndoToast } = useToast();

  // Filter notes based on search query
  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

  // Separate pinned and unpinned notes
  const pinnedNotes = useMemo(
    () => filteredNotes.filter((n) => n.pinned),
    [filteredNotes]
  );
  const otherNotes = useMemo(
    () => filteredNotes.filter((n) => !n.pinned),
    [filteredNotes]
  );

  // Quick Note save handler
  const handleQuickSave = async (content: string) => {
    setErrorMessage(null);
    const newNoteData = {
      title: content.split("\n")[0]?.slice(0, 40) || "Quick Thought",
      content,
      pinned: false,
    };

    setIsSaving(true);
    try {
      if (onCreateNote) {
        const created = await onCreateNote(newNoteData);
        if (created) {
          setNotes((prev) => [created, ...prev]);
        }
      } else {
        const res = await createPersonalNote(newNoteData);
        if (res.success && res.data) {
          setNotes((prev) => [res.data!, ...prev]);
          if (res.undoId) {
            showUndoToast("Note added", res.undoId, () => {
              setNotes((prev) => prev.filter((n) => n.id !== res.data!.id));
            });
          }
        } else {
          setErrorMessage(res.error || "Failed to save personal note.");
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save note.");
    } finally {
      setIsSaving(false);
    }
  };

  // Open note for editing
  const handleOpenNote = (note: PersonalNote) => {
    setSelectedNote(note);
    setIsEditorOpen(true);
  };

  // Open empty editor for creating a new note
  const handleCreateNew = () => {
    setSelectedNote(null);
    setIsEditorOpen(true);
  };

  // Save note from editor
  const handleEditorSave = async (data: {
    id?: string;
    title: string;
    content: string;
    pinned: boolean;
  }) => {
    setErrorMessage(null);
    setIsSaving(true);
    try {
      if (data.id) {
        // Edit existing note
        if (onUpdateNote) {
          const updated = await onUpdateNote(data.id, {
            title: data.title,
            content: data.content,
            pinned: data.pinned,
          });
          if (updated) {
            setNotes((prev) =>
              prev.map((n) => (n.id === data.id ? updated : n))
            );
          }
        } else {
          const res = await updatePersonalNote(data.id, {
            title: data.title,
            content: data.content,
            pinned: data.pinned,
          });
          if (res.success && res.data) {
            setNotes((prev) =>
              prev.map((n) => (n.id === data.id ? res.data! : n))
            );
            if (res.undoId) {
              showUndoToast("Note updated", res.undoId);
            }
          } else {
            setErrorMessage(res.error || "Failed to update personal note.");
            return;
          }
        }
      } else {
        // Create new note
        if (onCreateNote) {
          const created = await onCreateNote({
            title: data.title,
            content: data.content,
            pinned: data.pinned,
          });
          if (created) {
            setNotes((prev) => [created, ...prev]);
          }
        } else {
          const res = await createPersonalNote({
            title: data.title,
            content: data.content,
            pinned: data.pinned,
          });
          if (res.success && res.data) {
            setNotes((prev) => [res.data!, ...prev]);
            if (res.undoId) {
              showUndoToast("Note added", res.undoId, () => {
                setNotes((prev) => prev.filter((n) => n.id !== res.data!.id));
              });
            }
          } else {
            setErrorMessage(res.error || "Failed to create personal note.");
            return;
          }
        }
      }

      setIsEditorOpen(false);
      setSelectedNote(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save note.");
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Pin on a note
  const handleTogglePin = async (note: PersonalNote) => {
    setErrorMessage(null);
    const nextPinned = !note.pinned;
    try {
      if (onPinNote) {
        await onPinNote(note.id, nextPinned);
      } else {
        const res = await togglePersonalNotePinned(note.id, nextPinned);
        if (!res.success) {
          setErrorMessage(res.error || "Failed to pin/unpin note.");
          return;
        }
        if (res.undoId) {
          showUndoToast(nextPinned ? "Note pinned" : "Note unpinned", res.undoId, () => {
            void togglePersonalNotePinned(note.id, !nextPinned);
          });
        }
      }
      setNotes((prev) =>
        prev.map((n) =>
          n.id === note.id
            ? { ...n, pinned: nextPinned, isPinned: nextPinned, updatedAt: new Date().toISOString() }
            : n
        )
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to update pin state.");
    }
  };

  // Confirm delete note
  const handleConfirmDelete = async () => {
    if (!deletingNote) return;
    setErrorMessage(null);
    setIsDeleting(true);
    try {
      if (onDeleteNote) {
        await onDeleteNote(deletingNote.id);
      } else {
        const res = await deletePersonalNote(deletingNote.id);
        if (!res.success) {
          setErrorMessage(res.error || "Failed to delete personal note.");
          return;
        }
        if (res.undoId) {
          showUndoToast("Note deleted", res.undoId, () => {
            setNotes((prev) => [...prev, { ...deletingNote, id: "" + res.data!.id } as PersonalNote]);
          });
        }
      }
      setNotes((prev) => prev.filter((n) => n.id !== deletingNote.id));
      if (selectedNote?.id === deletingNote.id) {
        setIsEditorOpen(false);
        setSelectedNote(null);
      }
      setDeletingNote(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to delete note.");
    } finally {
      setIsDeleting(false);
    }
  };

  // AI Note Improver invocation
  const handleImproveNote = async (text: string): Promise<string> => {
    if (onImproveNote) {
      return await onImproveNote(text);
    }
    const res = await improvePersonalNote(text);
    if (res.success && typeof res.data === "string") {
      return res.data;
    }
    throw new Error(res.error || "Unable to improve note right now. Please try again or edit manually.");
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-16">
      {/* Workspace Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
              Personal Notes
            </h1>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {notes.length}
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Private workspace for ideas, reminders, and sales thoughts.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreateNew}
          className="inline-flex min-h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 active:bg-blue-800 transition-colors"
          aria-label="Create new personal note"
        >
          <Plus size={18} aria-hidden="true" />
          <span>New Note</span>
        </button>
      </div>

      {/* Error Message Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:text-rose-700"
            aria-label="Dismiss error"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Search Input Bar */}
      <div className="relative">
        <label htmlFor="notes-search-input" className="sr-only">
          Search personal notes
        </label>
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          id="notes-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search notes, ideas, reminders..."
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 grid size-6 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Quick Note Box (Fast Mobile-first Capture) */}
      <section aria-label="Quick note capture">
        <QuickNoteBox onSave={handleQuickSave} onImproveNote={handleImproveNote} saving={isSaving} />
      </section>

      {/* Main Content Layout: Desktop Split Screen vs Mobile Stack */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Notes List Column */}
        <div className={`space-y-6 ${isEditorOpen ? "lg:col-span-5" : "lg:col-span-12"}`}>
          {/* Empty State when no notes at all */}
          {notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 sm:p-12 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                <StickyNote size={24} aria-hidden="true" />
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900">No personal notes yet.</h3>
              <p className="mt-1 max-w-sm text-xs sm:text-sm text-slate-500 leading-relaxed">
                Capture an idea, reminder, or sales thought. Use the quick box above to write anything.
              </p>
            </div>
          ) : filteredNotes.length === 0 ? (
            /* Search Empty State */
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
              <SearchX size={24} className="text-slate-400 mb-2" aria-hidden="true" />
              <h3 className="text-sm font-bold text-slate-900">No matching notes found</h3>
              <p className="mt-1 text-xs text-slate-500">
                Try searching for different keywords or clear the search.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Clear Search
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Pinned Notes Section */}
              {pinnedNotes.length > 0 && (
                <section aria-label="Pinned notes" className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Pin size={12} className="text-amber-600 fill-amber-600" aria-hidden="true" />
                    <span>Pinned ({pinnedNotes.length})</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    {pinnedNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        isSelected={selectedNote?.id === note.id}
                        onOpen={handleOpenNote}
                        onEdit={handleOpenNote}
                        onTogglePin={handleTogglePin}
                        onDeleteRequest={(n) => setDeletingNote(n)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Other Notes Section */}
              {otherNotes.length > 0 && (
                <section aria-label="All notes" className="space-y-3">
                  {pinnedNotes.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <span>Other Notes ({otherNotes.length})</span>
                    </div>
                  )}
                  <div
                    className={`grid grid-cols-1 gap-3 ${
                      isEditorOpen ? "sm:grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3"
                    }`}
                  >
                    {otherNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        isSelected={selectedNote?.id === note.id}
                        onOpen={handleOpenNote}
                        onEdit={handleOpenNote}
                        onTogglePin={handleTogglePin}
                        onDeleteRequest={(n) => setDeletingNote(n)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Desktop Note Editor Side Panel */}
        {isEditorOpen && (
          <div className="hidden lg:block lg:col-span-7 sticky top-6 self-start max-h-[calc(100vh-6rem)]">
            <NoteEditor
              key={selectedNote?.id || "new-desktop"}
              note={selectedNote}
              onSave={handleEditorSave}
              onClose={() => {
                setIsEditorOpen(false);
                setSelectedNote(null);
              }}
              onImproveNote={handleImproveNote}
              isSaving={isSaving}
            />
          </div>
        )}
      </div>

      {/* Mobile Modal Note Editor (Slide up on Mobile screen) */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/40 p-2 sm:p-4 lg:hidden">
          <div className="flex-1 w-full max-w-xl mx-auto overflow-hidden">
            <NoteEditor
              key={selectedNote?.id || "new-mobile"}
              note={selectedNote}
              onSave={handleEditorSave}
              onClose={() => {
                setIsEditorOpen(false);
                setSelectedNote(null);
              }}
              onImproveNote={handleImproveNote}
              isSaving={isSaving}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmDialog
        isOpen={Boolean(deletingNote)}
        title={deletingNote?.title || ""}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingNote(null)}
        isDeleting={isDeleting}
      />
    </div>
  );
}
