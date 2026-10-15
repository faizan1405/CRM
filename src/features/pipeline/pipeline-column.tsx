"use client";

import type { LeadStatus } from "@/features/leads/types";

const statusAccent: Record<LeadStatus, { dot: string; border: string }> = {
  New: { dot: "bg-blue-500", border: "border-l-blue-400" },
  Contacted: { dot: "bg-slate-400", border: "border-l-slate-400" },
  Qualified: { dot: "bg-indigo-500", border: "border-l-indigo-400" },
  "Proposal Sent": { dot: "bg-amber-500", border: "border-l-amber-400" },
  Won: { dot: "bg-emerald-500", border: "border-l-emerald-400" },
  Lost: { dot: "bg-rose-500", border: "border-l-rose-400" },
};

export function PipelineSummary({ stats }: { stats: Record<string, number> }) {
  return (
    <div className="flex flex-wrap gap-3" role="region" aria-label="Pipeline summary">
      {Object.entries(stats).map(([label, value]) => (
        <div
          key={label}
          className="flex flex-col rounded-lg bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] border border-[var(--border)] min-w-[110px] flex-1 sm:flex-none"
        >
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
      ))}
    </div>
  );
}

export function PipelineEmptyState({ status }: { status: LeadStatus }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1.5 py-8 text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-lg"
      aria-label={`No leads in ${status}`}
    >
      <span>No leads</span>
    </div>
  );
}

export function PipelineColumnHeader({ status, count }: { status: LeadStatus; count: number }) {
  const accent = statusAccent[status];
  return (
    <div className="flex items-center justify-between gap-2 p-3.5 border-b border-slate-200 bg-slate-100/50">
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${accent.dot}`} aria-hidden="true" />
        <h3 className="font-semibold text-slate-700 text-sm">{status}</h3>
      </div>
      <span
        className="flex h-6 min-w-[24px] px-1.5 items-center justify-center rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-600 shadow-sm"
        aria-label={`${count} leads`}
      >
        {count}
      </span>
    </div>
  );
}
