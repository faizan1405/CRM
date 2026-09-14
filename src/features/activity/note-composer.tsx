"use client";

import { useEffect, useRef, useState } from "react";

type NoteComposerProps = {
  onAddNote: (text: string) => Promise<{ success: boolean; error?: string }>;
  disabled?: boolean;
};

export function NoteComposer({ onAddNote, disabled = false }: NoteComposerProps) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const MAX_CHARS = 500;

  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

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

  const remaining = MAX_CHARS - text.length;

  return (
    <div>
      <label htmlFor="note-composer" className="mb-1.5 block text-sm font-semibold text-slate-700">
        Add a note
      </label>
      <textarea
        ref={textareaRef}
        id="note-composer"
        value={text}
        onChange={(e) => {
          if (e.target.value.length <= MAX_CHARS) {
            setText(e.target.value);
            setError(null);
          }
        }}
        rows={3}
        placeholder="What happened during this interaction?"
        disabled={disabled || saving}
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

      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || saving || !text.trim()}
        className="mt-2.5 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        {saving ? (
          <>
            <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
            Saving...
          </>
        ) : (
          "Add Note"
        )}
      </button>
    </div>
  );
}
