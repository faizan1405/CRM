import { AlertTriangle, ArrowUpRight, CopyPlus, RefreshCcw, X } from "lucide-react";
import type { DuplicateLeadCandidate } from "./ai-entry-types";

type DuplicateLeadWarningProps = {
  candidate: DuplicateLeadCandidate;
  onOpenExisting?: (candidate: DuplicateLeadCandidate) => void;
  onUpdateExisting?: (candidate: DuplicateLeadCandidate) => void;
  onCreateAnyway: () => void;
  onCancel?: () => void;
};

export function DuplicateLeadWarning({
  candidate,
  onOpenExisting,
  onUpdateExisting,
  onCreateAnyway,
  onCancel,
}: DuplicateLeadWarningProps) {
  const matchedLabel =
    candidate.matchedBy === "phone_and_email"
      ? "Phone number & Email"
      : candidate.matchedBy === "phone"
      ? "Phone number"
      : candidate.matchedBy === "email"
      ? "Email address"
      : "Contact details";

  return (
    <section
      aria-labelledby="duplicate-warning-title"
      className="rounded-xl border border-amber-300 bg-amber-50/95 p-4 shadow-xs"
    >
      <div className="flex gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600" size={19} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 id="duplicate-warning-title" className="text-sm font-bold text-amber-950">
              Possible Duplicate Lead
            </h3>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                aria-label="Dismiss duplicate warning"
                className="rounded text-amber-600 hover:text-amber-900"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <p className="mt-1 text-sm font-semibold text-amber-950">
            {candidate.name}
            <span className="mx-1.5 font-normal text-amber-700" aria-hidden="true">·</span>
            {candidate.phone}
            {candidate.status ? (
              <span className="ml-2 rounded-md bg-amber-200/80 px-1.5 py-0.5 text-[11px] font-bold text-amber-900">
                {candidate.status}
              </span>
            ) : null}
          </p>

          {candidate.business ? (
            <p className="mt-0.5 text-xs font-medium text-amber-800">{candidate.business}</p>
          ) : null}

          {candidate.lastActivityText ? (
            <p className="mt-1 text-xs text-amber-800">
              <span className="font-medium text-amber-900">Last activity:</span> {candidate.lastActivityText}
            </p>
          ) : null}

          <p className="mt-1.5 text-xs text-amber-700 font-medium">
            Matched by: <span className="font-semibold text-amber-900">{matchedLabel}</span>
          </p>

          {candidate.isDeleted ? (
            <p className="mt-1 text-xs font-medium text-rose-700">
              Notice: Matching lead exists in Recently Deleted.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenExisting?.(candidate)}
          disabled={!onOpenExisting}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowUpRight aria-hidden="true" size={14} />
          Open Existing
        </button>

        {!candidate.isDeleted && onUpdateExisting && (
          <button
            type="button"
            onClick={() => onUpdateExisting?.(candidate)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-100"
          >
            <RefreshCcw aria-hidden="true" size={14} />
            Update Existing
          </button>
        )}

        <button
          type="button"
          onClick={onCreateAnyway}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          <CopyPlus aria-hidden="true" size={14} />
          Create Anyway
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100/60"
          >
            Cancel
          </button>
        )}
      </div>
    </section>
  );
}
