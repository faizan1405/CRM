"use client";

import { CheckCircle2, RotateCcw, ArrowRight } from "lucide-react";
import Link from "next/link";

type BriefingEmptyStateProps = {
  onResetActions?: () => void;
  completedCount?: number;
};

export function BriefingEmptyState({
  onResetActions,
  completedCount = 0,
}: BriefingEmptyStateProps) {
  return (
    <div
      role="status"
      aria-label="No urgent actions remaining"
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-8 text-center sm:p-12"
    >
      <div className="grid size-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-xs sm:size-16">
        <CheckCircle2 size={32} strokeWidth={2.2} />
      </div>

      <h3 className="mt-4 text-lg font-bold text-slate-900 sm:text-xl">
        Nothing urgent today 🎉
      </h3>

      <p className="mt-1.5 max-w-md text-xs sm:text-sm text-slate-600">
        You&apos;re all caught up on critical follow-ups, overdue touches, and high-priority leads.
        {completedCount > 0 && ` You marked ${completedCount} actions done.`}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {onResetActions && (
          <button
            type="button"
            onClick={onResetActions}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <RotateCcw size={13} />
            <span>Reset Demo Checklist</span>
          </button>
        )}

        <Link
          href="/pipeline"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          <span>View Full Pipeline</span>
          <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
