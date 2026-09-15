"use client";

import { Check, Copy, Sparkles } from "lucide-react";
import { useState } from "react";
import { formatStructuredCallNote } from "./formatters";
import type { StructuredCallNotesData } from "./types";

interface NoteOutputPreviewProps {
  data: StructuredCallNotesData;
  className?: string;
}

export function NoteOutputPreview({ data, className = "" }: NoteOutputPreviewProps) {
  const [copied, setCopied] = useState(false);
  const formattedText = formatStructuredCallNote(data);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <section
      aria-labelledby="formatted-output-heading"
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-blue-50 p-1.5 text-blue-600">
            <Sparkles className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h4
              id="formatted-output-heading"
              className="text-xs font-semibold uppercase tracking-wider text-slate-800"
            >
              Activity Note Preview
            </h4>
            <p className="text-[11px] text-slate-500">Formatted for Phase 5 Lead Activity Notes</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy formatted note"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
              <span className="text-emerald-600">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3.5 text-slate-500" aria-hidden="true" />
              <span>Copy Output</span>
            </>
          )}
        </button>
      </div>

      <div className="mt-3 rounded-lg bg-slate-50 p-3.5 font-mono text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed border border-slate-200/70">
        {formattedText || <span className="text-slate-400 italic">No fields filled yet</span>}
      </div>
    </section>
  );
}
