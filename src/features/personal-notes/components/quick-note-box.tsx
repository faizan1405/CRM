"use client";

import { useState, useRef } from "react";
import { Plus, Sparkles, RotateCcw } from "lucide-react";
import { improvePersonalNote } from "@/app/actions/personal-notes";

interface QuickNoteBoxProps {
  onSave: (content: string) => void;
  className?: string;
  onImproveNote?: (text: string) => Promise<string>;
}

export function QuickNoteBox({ onSave, className = "", onImproveNote }: QuickNoteBoxProps) {
  const [content, setContent] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [lastOriginalDraft, setLastOriginalDraft] = useState<string | null>(null);
  const [improveError, setImproveError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setContent("");
    setLastOriginalDraft(null);
    setImproveError(null);
    setIsFocused(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (improveError) setImproveError(null);
    // Auto-adjust height
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const handleImprove = async () => {
    const rawText = content.trim();
    if (!rawText || isImproving) return;

    setIsImproving(true);
    setImproveError(null);

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

      // Success: replace textarea with improved text
      setLastOriginalDraft(content);
      setContent(improved);

      // Recalculate height
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
        }
      }, 0);
    } catch (err) {
      console.error("Quick note improve failed", err);
      // Failure: keep original text untouched
      setImproveError(err instanceof Error ? err.message : "Unable to improve note right now. Please try again or edit manually.");
    } finally {
      setIsImproving(false);
    }
  };

  const handleUndo = () => {
    if (lastOriginalDraft !== null) {
      setContent(lastOriginalDraft);
      setLastOriginalDraft(null);
      setImproveError(null);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
        }
      }, 0);
    }
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-150 ${
        isFocused
          ? "border-blue-500 bg-white shadow-md ring-2 ring-blue-100"
          : "border-slate-200 bg-white shadow-xs hover:border-slate-300"
      } ${className}`}
    >
      <form onSubmit={handleSubmit} className="p-3 sm:p-4">
        <label htmlFor="quick-note-input" className="sr-only">
          Quick note content
        </label>
        <textarea
          id="quick-note-input"
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            if (!content.trim()) setIsFocused(false);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Write anything... (e.g. need call rakesh tomorrow, check ad results)"
          rows={isFocused || content ? 3 : 1}
          className="w-full resize-none border-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0 leading-relaxed"
        />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleImprove}
              disabled={!content.trim() || isImproving}
              title={!content.trim() ? "Write a note first." : "Improve note with AI"}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-indigo-600 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
              aria-label="Improve quick note"
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
                onClick={handleUndo}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                aria-label="Undo improvement"
              >
                <RotateCcw size={12} aria-hidden="true" />
                <span>Undo improvement</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="hidden sm:inline text-[11px] text-slate-400">
              Press <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-600">Ctrl+Enter</kbd> to save
            </span>

            <button
              type="submit"
              disabled={!content.trim()}
              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Save quick note"
            >
              <Plus size={15} aria-hidden="true" />
              <span>Save Note</span>
            </button>
          </div>
        </div>

        {improveError && (
          <p role="alert" className="mt-2 text-xs text-red-600 font-medium">
            {improveError}
          </p>
        )}
      </form>
    </div>
  );
}
