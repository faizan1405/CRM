"use client";

import { useState } from "react";
import {
  Sparkles,
  RotateCcw,
  Pin,
  Save,
  X,
} from "lucide-react";
import type { PersonalNote, AITransformAction } from "../types";
import { improvePersonalNote } from "@/app/actions/personal-notes";

interface NoteEditorProps {
  note: PersonalNote | null;
  onSave: (data: { id?: string; title: string; content: string; pinned: boolean }) => void;
  onClose: () => void;
  onImproveNote?: (text: string) => Promise<string>;
  onAITransform?: (text: string, action: AITransformAction) => Promise<string> | string;
  isSaving?: boolean;
}

export function NoteEditor({
  note,
  onSave,
  onClose,
  onImproveNote,
  isSaving = false,
}: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title || "");
  const [content, setContent] = useState(note?.content || "");
  const [pinned, setPinned] = useState(note?.pinned || false);
  const [isImproving, setIsImproving] = useState(false);
  const [lastOriginalDraft, setLastOriginalDraft] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!content.trim() && !title.trim()) return;

    onSave({
      id: note?.id,
      title: title.trim() || (content.trim().split("\n")[0]?.slice(0, 40) ?? "Untitled Note"),
      content: content.trim(),
      pinned,
    });
  };

  /**
   * AI Improvement trigger
   * Lightly rewrites the note for clarity while strictly preserving all facts, numbers, dates, names, etc.
   * Does NOT auto-save. The note remains fully editable in the textarea.
   */
  const handleImprove = async () => {
    const rawText = content.trim();
    if (!rawText || isImproving) return;

    setIsImproving(true);
    setAiError(null);

    try {
      let improved = "";

      if (onImproveNote) {
        improved = await onImproveNote(rawText);
      } else {
        const res = await improvePersonalNote(rawText);
        if (res.success && res.data) {
          improved = res.data;
        } else {
          throw new Error(res.error || "Unable to improve note right now. Please try again or edit manually.");
        }
      }

      if (!improved.trim()) {
        throw new Error("AI returned empty text. Your note is unchanged.");
      }

      // Success: Replace textarea with improved text and record original draft for Undo
      setLastOriginalDraft(content);
      setContent(improved);
    } catch (err) {
      console.error("AI Improve failed", err);
      // Failure: keep original text untouched
      setAiError(err instanceof Error ? err.message : "Unable to improve note right now. Please try again or edit manually.");
    } finally {
      setIsImproving(false);
    }
  };

  /**
   * Restores the exact original text before AI improvement
   */
  const handleUndoImprovement = () => {
    if (lastOriginalDraft !== null) {
      setContent(lastOriginalDraft);
      setLastOriginalDraft(null);
      setAiError(null);
    }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Editor Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPinned((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
              pinned
                ? "bg-amber-100 text-amber-900 border border-amber-200"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
            title={pinned ? "Pinned Note" : "Pin Note"}
          >
            <Pin size={14} className={pinned ? "fill-amber-600 text-amber-600" : ""} />
            <span>{pinned ? "Pinned" : "Pin"}</span>
          </button>
          <span className="text-xs text-slate-400">
            {note ? "Editing Note" : "New Personal Note"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close editor"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* Title Input */}
        <div>
          <label htmlFor="note-title-input" className="sr-only">
            Note Title
          </label>
          <input
            id="note-title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title (e.g. Sales Thought, Pricing Idea)..."
            className="w-full border-0 border-b border-slate-100 pb-2 text-base sm:text-lg font-bold text-slate-950 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-0"
          />
        </div>

        {/* Note Content Textarea */}
        <div>
          <label htmlFor="note-content-input" className="sr-only">
            Note Content
          </label>
          <textarea
            id="note-content-input"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (aiError) setAiError(null);
            }}
            placeholder="Type your personal note here... ideas, reminders, sales observations, rough notes..."
            rows={10}
            className="w-full resize-none border-0 bg-transparent text-base sm:text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0 min-h-[180px] sm:min-h-[260px]"
          />
        </div>

        {/* AI Improve Controls: [ ✨ Improve ] [ Undo improvement ] */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleImprove}
                disabled={!content.trim() || isImproving}
                title={!content.trim() ? "Write a note first." : "Improve note with AI"}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-indigo-600 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                aria-label="Improve note with AI"
              >
                <Sparkles
                  size={13}
                  className={isImproving ? "animate-spin text-indigo-600" : "text-indigo-600"}
                  aria-hidden="true"
                />
                <span>{isImproving ? "Improving..." : "✨ Improve"}</span>
              </button>

              {lastOriginalDraft !== null && (
                <button
                  type="button"
                  onClick={handleUndoImprovement}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  aria-label="Undo improvement"
                >
                  <RotateCcw size={12} aria-hidden="true" />
                  <span>Undo improvement</span>
                </button>
              )}
            </div>

            <span className="text-[11px] text-slate-400">
              {wordCount} words · {charCount} chars
            </span>
          </div>

          {aiError && (
            <p role="alert" className="text-xs text-red-600 font-medium flex items-center gap-1">
              {aiError}
            </p>
          )}
        </div>
      </div>

      {/* Editor Footer */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={(!content.trim() && !title.trim()) || isSaving}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 transition-colors"
        >
          <Save size={15} aria-hidden="true" />
          <span>{isSaving ? "Saving..." : "Save Note"}</span>
        </button>
      </div>
    </div>
  );
}
