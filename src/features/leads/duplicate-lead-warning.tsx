import { AlertTriangle, ArrowUpRight, CopyPlus, RefreshCcw } from "lucide-react";
import type { DuplicateLeadCandidate } from "./ai-entry-types";

type DuplicateLeadWarningProps = {
  candidate: DuplicateLeadCandidate;
  onOpenExisting?: (candidate: DuplicateLeadCandidate) => void;
  onUpdateExisting?: (candidate: DuplicateLeadCandidate) => void;
  onCreateAnyway: () => void;
};

export function DuplicateLeadWarning({
  candidate,
  onOpenExisting,
  onUpdateExisting,
  onCreateAnyway,
}: DuplicateLeadWarningProps) {
  return (
    <section aria-labelledby="duplicate-warning-title" className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0 text-amber-700" size={19} />
        <div className="min-w-0">
          <h3 id="duplicate-warning-title" className="text-sm font-semibold text-amber-950">
            Possible existing lead found
          </h3>
          <p className="mt-1 text-sm text-amber-900">
            <strong>{candidate.name}</strong>
            <span className="mx-1.5" aria-hidden="true">·</span>
            {candidate.phone}
            {candidate.status ? (
              <span className="ml-2 rounded-md bg-amber-200/80 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900">
                {candidate.status}
              </span>
            ) : null}
          </p>
          {candidate.business ? <p className="mt-0.5 text-xs text-amber-800">{candidate.business}</p> : null}
          {candidate.reason ? <p className="mt-0.5 text-xs text-amber-700 italic">{candidate.reason}</p> : null}
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onOpenExisting?.(candidate)}
          disabled={!onOpenExisting}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowUpRight aria-hidden="true" size={16} />
          Open existing
        </button>
        <button
          type="button"
          onClick={() => onUpdateExisting?.(candidate)}
          disabled={!onUpdateExisting}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCcw aria-hidden="true" size={16} />
          Update existing
        </button>
        <button
          type="button"
          onClick={onCreateAnyway}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-amber-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-amber-950"
        >
          <CopyPlus aria-hidden="true" size={16} />
          Create anyway
        </button>
      </div>
    </section>
  );
}
