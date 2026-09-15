"use client";

import { useState } from "react";
import {
  Sparkles,
  Check,
  RotateCcw,
  Pin,
  Save,
  X,
  ListOrdered,
  FileText,
  Wand2,
} from "lucide-react";
import type { PersonalNote, AITransformAction, AIPreviewState } from "../types";

interface NoteEditorProps {
  note: PersonalNote | null;
  onSave: (data: { id?: string; title: string; content: string; pinned: boolean }) => void;
  onClose: () => void;
  onAITransform?: (text: string, action: AITransformAction) => Promise<string> | string;
  isSaving?: boolean;
}

export function NoteEditor({
  note,
  onSave,
  onClose,
  onAITransform,
  isSaving = false,
}: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title || "");
  const [content, setContent] = useState(note?.content || "");
  const [pinned, setPinned] = useState(note?.pinned || false);
  const [isTransforming, setIsTransforming] = useState(false);
  const [aiPreview, setAiPreview] = useState<AIPreviewState | null>(null);
  const [aiError, setAIError] = useState<string | null>(null);

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
   * AI Transformation trigger
   */
  const handleAITransform = async (action: AITransformAction, label: string) => {
    const rawText = content.trim();
    if (!rawText) return;

    setIsTransforming(true);
    setAIError(null);
    setAiPreview(null);

    try {
      let transformed = "";

      if (onAITransform) {
        transformed = await onAITransform(rawText, action);
      } else {
        throw new Error("AI transformation is unavailable.");
      }
      if (!transformed.trim()) throw new Error("AI returned an empty preview. Your note is unchanged.");

      // Display in preview mode - NEVER silently overwrite
      setAiPreview({
        originalText: content,
        previewText: transformed,
        action,
        actionLabel: label,
      });
    } catch (err) {
      console.error("AI Transform failed", err);
      setAIError(err instanceof Error ? err.message : "AI transformation failed. Your note is unchanged.");
    } finally {
      setIsTransforming(false);
    }
  };

  const applyAIPreview = () => {
    if (!aiPreview) return;
    setContent(aiPreview.previewText);
    setAiPreview(null);
  };

  const dismissAIPreview = () => {
    setAiPreview(null);
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

        {aiError && <p role="alert" className="text-sm text-red-600">{aiError}</p>}
        {/* AI Preview Banner & Diff Container */}
        {aiPreview && (
          <div
            role="region"
            aria-label="AI Generated Preview"
            className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-purple-50/30 to-white p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                <Sparkles size={15} className="text-indigo-600" aria-hidden="true" />
                <span>AI Preview ({aiPreview.actionLabel})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={dismissAIPreview}
                  className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <RotateCcw size={13} aria-hidden="true" />
                  <span>Keep Original</span>
                </button>
                <button
                  type="button"
                  onClick={applyAIPreview}
                  className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors"
                >
                  <Check size={14} aria-hidden="true" />
                  <span>Apply</span>
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-indigo-100 bg-white p-3.5 text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
              {aiPreview.previewText}
            </div>

            <p className="text-[11px] text-slate-500 italic">
              Original note is preserved until you click &quot;Apply&quot;.
            </p>
          </div>
        )}

        {/* Note Content Textarea */}
        <div>
          <label htmlFor="note-content-input" className="sr-only">
            Note Content
          </label>
          <textarea
            id="note-content-input"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your personal note here... ideas, reminders, sales observations, rough notes..."
            rows={10}
            className="w-full resize-none border-0 bg-transparent text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-0 min-h-[180px] sm:min-h-[260px]"
          />
        </div>

        {/* AI Action Toolbar */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <Sparkles size={12} className="text-indigo-600" aria-hidden="true" />
              AI Assistant Actions
            </span>
            <span className="text-[11px] text-slate-400">
              {wordCount} words · {charCount} chars
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={!content.trim() || isTransforming}
              onClick={() => handleAITransform("cleanup", "Clean Up")}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-40 transition-colors"
              aria-label="Clean up note structure"
            >
              <Sparkles size={13} className="text-amber-500" aria-hidden="true" />
              <span>Clean Up</span>
            </button>

            <button
              type="button"
              disabled={!content.trim() || isTransforming}
              onClick={() => handleAITransform("organize", "Organize")}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-40 transition-colors"
              aria-label="Organize note into sections"
            >
              <ListOrdered size={13} className="text-blue-500" aria-hidden="true" />
              <span>Organize</span>
            </button>

            <button
              type="button"
              disabled={!content.trim() || isTransforming}
              onClick={() => handleAITransform("rewrite", "Rewrite Clearly")}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-40 transition-colors"
              aria-label="Rewrite note clearly"
            >
              <Wand2 size={13} className="text-purple-500" aria-hidden="true" />
              <span>Rewrite Clearly</span>
            </button>

            <button
              type="button"
              disabled={!content.trim() || isTransforming}
              onClick={() => handleAITransform("summarize", "Summarize")}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-40 transition-colors"
              aria-label="Summarize note"
            >
              <FileText size={13} className="text-emerald-500" aria-hidden="true" />
              <span>Summarize</span>
            </button>
          </div>
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
