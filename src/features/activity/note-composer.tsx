"use client";

import { useEffect, useRef, useState } from "react";
import { improveNoteText } from "@/app/actions/conversation-notes";
import { Sparkles } from "lucide-react";

type NoteComposerProps = {
  onAddNote: (text: string) => Promise<{ success: boolean; error?: string }>;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
};

export function NoteComposer({ onAddNote, disabled = false, autoFocus = false, id = "note-composer" }: NoteComposerProps) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [improving, setImproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const MAX_CHARS = 500;

  useEffect(() => {
    if (autoFocus && !disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus, disabled]);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setError(null);
    setSaving(true);

    try {
      const result = await onAddNote(trimmed);
      if (!result.success) {
        setError(result.error || "Failed to add note.");
      } else {
        setText("");
        setError(null);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleImprove = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setError(null);
    setImproving(true);
    try {
      const res = await improveNoteText(trimmed);
      if (!res.success) {
        setError(res.error || "Failed to improve note.");
      } else if (res.data) {
        setText(res.data);
      }
    } catch {
      setError("Something went wrong improving the note.");
    } finally {
      setImproving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // Prevent native composition events from triggering submit
      if (e.nativeEvent.isComposing) return;
      
      e.preventDefault();
      handleSubmit();
    }
  };

  const remaining = MAX_CHARS - text.length;

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-700">
        Add a note
      </label>
      <textarea
        ref={textareaRef}
        id={id}
        value={text}
        onKeyDown={handleKeyDown}
        onChange={(e) => {
          if (e.target.value.length <= MAX_CHARS) {
            setText(e.target.value);
            setError(null);
          }
        }}
        rows={3}
        placeholder="What happened during this interaction?"
        disabled={disabled || saving || improving}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
        aria-describedby={error ? "note-error" : "note-chars"}
      />

      <div className="mt-1.5 flex items-center justify-between">
        <span id="note-chars" className="text-xs text-slate-400">
          {remaining <= 50 ? (
            <span className={remaining <= 10 ? "text-red-500 font-medium" : "text-slate-500"}>
              {remaining} characters left
            </span>
          ) : (
            <span className="text-slate-400">{remaining} characters left</span>
          )}
        </span>
      </div>

      {error && (
        <p id="note-error" className="mt-1.5 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleImprove}
          disabled={disabled || saving || improving || !text.trim()}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-blue-600 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          {improving ? (
            <>
              <span className="size-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" aria-hidden="true" />
              Improving...
            </>
          ) : (
            <>
              <Sparkles className="size-4 text-blue-500" />
              Improve
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || saving || improving || !text.trim()}
          className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 transition-colors sm:flex-none"
        >
          {saving ? (
            <>
              <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
              Saving...
            </>
          ) : (
            "Save Note"
          )}
        </button>
      </div>
    </div>
  );
}
