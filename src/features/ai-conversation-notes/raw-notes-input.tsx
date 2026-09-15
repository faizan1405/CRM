"use client";

import { Sparkles, X } from "lucide-react";
import { useEffect, useRef } from "react";

interface RawNotesInputProps {
  value: string;
  onChange: (value: string) => void;
  onStructure: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  id?: string;
}

export function RawNotesInput({
  value,
  onChange,
  onStructure,
  isLoading = false,
  disabled = false,
  id = "raw-call-notes-textarea",
}: RawNotesInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content naturally on mobile
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(140, textareaRef.current.scrollHeight)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && value.trim() && !isLoading && !disabled) {
      e.preventDefault();
      onStructure();
    }
  };

  const handleClear = () => {
    if (disabled || isLoading) return;
    onChange("");
    textareaRef.current?.focus();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="block text-sm font-semibold text-slate-800"
        >
          Call Notes (Raw / Unstructured)
        </label>
        {value.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled || isLoading}
            aria-label="Clear notes"
            className="inline-flex min-h-11 items-center gap-1 px-2 text-xs font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="size-3.5" aria-hidden="true" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="relative">
        <textarea
          ref={textareaRef}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isLoading}
          placeholder="Write what happened on the call..."
          rows={5}
          className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3.5 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 sm:text-sm"
          aria-describedby="raw-notes-hint"
        />
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <p id="raw-notes-hint" className="text-xs text-slate-500">
          Tip: Type rough notes like &ldquo;interested ecommerce talk with partner friday 4pm&rdquo;
        </p>

        <button
          type="button"
          onClick={onStructure}
          disabled={disabled || isLoading || !value.trim()}
          aria-busy={isLoading}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none sm:w-auto"
        >
          {isLoading ? (
            <>
              <span
                className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                aria-hidden="true"
              />
              <span>Structuring Notes...</span>
            </>
          ) : (
            <>
              <Sparkles className="size-4 text-blue-200" aria-hidden="true" />
              <span>✨ Structure Notes</span>
            </>
          )}
        </button>
      </div>

      {/* Screen reader status announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        {isLoading ? "Structuring your rough notes into organized fields..." : ""}
      </div>
    </div>
  );
}
