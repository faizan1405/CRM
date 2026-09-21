"use client";

import { useState } from "react";
import { AiNoteEditor } from "@/components/ui/ai-note-editor";

type NoteComposerProps = {
  onAddNote: (text: string) => Promise<{ success: boolean; error?: string }>;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
};

export function NoteComposer({ onAddNote, disabled = false, autoFocus = false, id = "note-composer" }: NoteComposerProps) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const MAX_CHARS = 1000;

  const handleSubmit = async () => {
    if (disabled || saving) return;
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

  return (
    <div>
      <AiNoteEditor
        id={id}
        value={text}
        onChange={(val) => {
          setText(val);
          if (error) setError(null);
        }}
        label="Add a note"
        labelClassName="mb-1.5 block text-sm font-semibold text-slate-700"
        placeholder="What happened during this interaction?"
        rows={4}
        maxLength={MAX_CHARS}
        showCharCount
        disabled={disabled || saving}
        autoFocus={autoFocus}
        onSubmitShortcut={handleSubmit}
        textareaClassName="resize-y whitespace-pre-wrap leading-relaxed"
      />

      {error && (
        <p id="note-error" className="mt-1.5 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-2.5 flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || saving || !text.trim()}
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 transition-colors sm:w-auto"
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
