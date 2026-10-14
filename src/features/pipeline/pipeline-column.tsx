"use client";

import type { LeadStatus } from "@/features/leads/types";
import { cn } from "@/lib/utils";

const statusAccent: Record<LeadStatus, { dot: string; swatch: string }> = {
  New: { dot: "bg-info", swatch: "bg-info" },
  Contacted: { dot: "bg-subtle", swatch: "bg-subtle" },
  Qualified: { dot: "bg-chart-2", swatch: "bg-chart-2" },
  "Proposal Sent": { dot: "bg-warning", swatch: "bg-warning" },
  Won: { dot: "bg-primary", swatch: "bg-primary" },
  Lost: { dot: "bg-destructive", swatch: "bg-destructive" },
};

export function PipelineSummary({ stats }: { stats: Record<string, number> }) {
  return (
    <div className="flex flex-wrap gap-2.5" role="region" aria-label="Pipeline summary">
      {Object.entries(stats).map(([label, value]) => (
        <div
          key={label}
          className="card-surface flex flex-col px-3.5 py-2.5 min-w-[105px] flex-1 sm:flex-none border border-border/80 shadow-[var(--shadow-card)]"
        >
          <p className="eyebrow truncate">{label}</p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-foreground tabular">{value}</p>
        </div>
      ))}
    </div>
  );
}

export function PipelineEmptyState({ status }: { status: LeadStatus }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1.5 py-8 text-[12px] text-muted-foreground rounded-xl border border-dashed border-border/70 bg-background/30"
      aria-label={`No leads in ${status}`}
    >
      <span>No leads in this stage</span>
    </div>
  );
}

export function PipelineColumnHeader({
  status,
  count,
  totalValue,
}: {
  status: LeadStatus;
  count: number;
  totalValue?: string;
}) {
  const accent = statusAccent[status] || { dot: "bg-subtle", swatch: "bg-subtle" };
  return (
    <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-2 border-b border-border/50">
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn("size-2 rounded-sm shrink-0", accent.dot)} aria-hidden="true" />
        <h3 className="font-semibold text-foreground text-[12.5px] truncate">{status}</h3>
        <span
          className="font-normal text-muted-foreground text-[12px] tabular"
          aria-label={`${count} leads`}
        >
          {count}
        </span>
      </div>
      {totalValue && (
        <span className="text-[12px] font-medium text-muted-foreground tabular shrink-0">
          {totalValue}
        </span>
      )}
    </div>
  );
}
