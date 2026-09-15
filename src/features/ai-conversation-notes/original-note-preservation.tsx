"use client";

import { Check, Copy, FileText, ShieldCheck } from "lucide-react";
import { useState } from "react";

interface OriginalNotePreservationProps {
  rawNote: string;
  className?: string;
}

export function OriginalNotePreservation({
  rawNote,
  className = "",
}: OriginalNotePreservationProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawNote);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <section
      aria-labelledby="original-note-heading"
      className={`rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-slate-500" aria-hidden="true" />
          <h4
            id="original-note-heading"
            className="text-xs font-semibold uppercase tracking-wider text-slate-700"
          >
            Original Raw Note
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Preserved
          </span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy original raw note"
            className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-200/60 hover:text-slate-700"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
                <span className="text-emerald-600">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" aria-hidden="true" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 font-mono whitespace-pre-wrap break-words leading-relaxed">
        {rawNote || <span className="text-slate-400 italic">No original note entered</span>}
      </div>

      <p className="mt-1.5 text-[11px] text-slate-500">
        AI will never silently overwrite this content. You can choose to apply the structured format or keep this original note as-is.
      </p>
    </section>
  );
}
