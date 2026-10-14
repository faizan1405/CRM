"use client";

import { useState, useRef } from "react";
import { Plus, Sparkles, RotateCcw } from "lucide-react";
import { improvePersonalNote } from "@/app/actions/personal-notes";

interface QuickNoteBoxProps {
  onSave: (content: string) => void;
  className?: string;
  onImproveNote?: (text: string) => Promise<string>;
  saving?: boolean;
}

export function QuickNoteBox({ onSave, className = "", onImproveNote, saving = false }: QuickNoteBoxProps) {
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
      className={`card-surface rounded-2xl border transition-all duration-200 ${
        isFocused
          ? "border-primary bg-card ring-2 ring-primary/20 shadow-sm"
          : "border-border bg-card hover:border-border/80"
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
          placeholder="Write anything... (e.g. need to call client tomorrow, check campaign results)"
          rows={isFocused || content ? 3 : 1}
          className="w-full resize-none border-0 bg-transparent text-base sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0 leading-relaxed"
        />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleImprove}
              disabled={!content.trim() || isImproving}
              title={!content.trim() ? "Write a note first." : "Improve note with AI"}
              className="press inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-muted active:bg-muted disabled:cursor-not-allowed disabled:opacity-40 transition-colors cursor-pointer"
              aria-label="Improve quick note"
            >
              <Sparkles
                size={13}
                className={isImproving ? "animate-spin text-sidebar-primary" : "text-sidebar-primary"}
                aria-hidden="true"
              />
              <span>{isImproving ? "Improving..." : "✨ Improve"}</span>
            </button>

            {lastOriginalDraft !== null && (
              <button
                type="button"
                onClick={handleUndo}
                className="press inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/60 px-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                aria-label="Undo improvement"
              >
                <RotateCcw size={12} aria-hidden="true" />
                <span>Undo</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="hidden sm:inline text-[11px] text-muted-foreground">
              Press <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Ctrl+Enter</kbd> to save
            </span>

            <button
              type="submit"
              disabled={!content.trim() || saving}
              aria-busy={saving}
              className="press inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-ink px-3 text-xs font-medium text-ink-foreground shadow-xs transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              aria-label="Save quick note"
            >
              {saving ? (
                <span className="size-3.5 animate-spin rounded-full border-2 border-ink-foreground/30 border-t-ink-foreground shrink-0" aria-hidden="true" />
              ) : (
                <Plus size={14} aria-hidden="true" />
              )}
              <span>{saving ? "Saving..." : "Save Note"}</span>
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
