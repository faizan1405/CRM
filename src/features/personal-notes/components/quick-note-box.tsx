"use client";

import { useState, useRef } from "react";
import { Plus } from "lucide-react";

interface QuickNoteBoxProps {
  onSave: (content: string) => void;
  className?: string;
}

export function QuickNoteBox({ onSave, className = "" }: QuickNoteBoxProps) {
  const [content, setContent] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setContent("");
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
    // Auto-adjust height
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
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

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
          <span className="hidden sm:inline text-[11px] text-slate-400">
            Press <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-600">Ctrl+Enter</kbd> to save
          </span>

          <button
            type="submit"
            disabled={!content.trim()}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40 ml-auto"
            aria-label="Save quick note"
          >
            <Plus size={15} aria-hidden="true" />
            <span>Save Note</span>
          </button>
        </div>
      </form>
    </div>
  );
}
