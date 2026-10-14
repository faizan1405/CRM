"use client";

import type { Lead, LeadStatus } from "@/features/leads/types";
import { useMemo } from "react";

// Matches PIPELINE_COLUMNS order + Won/Lost using Lovable-aligned hues
const STAGE_COLORS: Record<string, string> = {
  New: "#2563eb", // info blue
  Contacted: "#64748b", // slate
  Qualified: "#059669", // emerald
  "Proposal Sent": "#d97706", // amber
  Won: "#16a34a", // success green
  Lost: "#dc2626", // destructive red
};

export function PipelineDonutGraph({
  leads,
  grouped,
}: {
  leads: Lead[];
  grouped: Record<LeadStatus, Lead[]>;
}) {
  const data = useMemo(() => {
    return [
      { label: "New", value: grouped["New"].length, color: STAGE_COLORS["New"] },
      { label: "Contacted", value: grouped["Contacted"].length, color: STAGE_COLORS["Contacted"] },
      { label: "Qualified", value: grouped["Qualified"].length, color: STAGE_COLORS["Qualified"] },
      { label: "Proposal", value: grouped["Proposal Sent"].length, color: STAGE_COLORS["Proposal Sent"] },
      { label: "Won", value: grouped["Won"].length, color: STAGE_COLORS["Won"] },
      { label: "Lost", value: grouped["Lost"].length, color: STAGE_COLORS["Lost"] },
    ].filter((d) => d.value > 0);
  }, [grouped]);

  const total = leads.length;

  if (total === 0 || data.length === 0) {
    return (
      <div className="flex h-28 w-28 items-center justify-center rounded-full border-4 border-muted/80 bg-muted/20">
        <span className="text-xs text-muted-foreground font-medium">No Data</span>
      </div>
    );
  }

  // Calculate SVG paths
  const cx = 50;
  const cy = 50;
  const r = 38;
  const circumference = 2 * Math.PI * r;

  let currentOffset = 0;

  return (
    <div className="flex items-center gap-5 sm:gap-6">
      <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
        <svg viewBox="0 0 100 100" className="-rotate-90 transform w-full h-full">
          <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="var(--muted, #f1f5f9)" strokeWidth="11" />
          {data.map((segment) => {
            const strokeDasharray = `${(segment.value / total) * circumference} ${circumference}`;
            const strokeDashoffset = -currentOffset;
            currentOffset += (segment.value / total) * circumference;

            return (
              <circle
                key={segment.label}
                cx={cx}
                cy={cy}
                r={r}
                fill="transparent"
                stroke={segment.color}
                strokeWidth="11"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-300 ease-out hover:stroke-[13px] cursor-pointer"
              >
                <title>{`${segment.label}: ${segment.value} leads (${Math.round((segment.value / total) * 100)}%)`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold tracking-tight text-foreground leading-none tabular">{total}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">Leads</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:flex sm:flex-col sm:justify-center">
        {data.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 rounded-sm shrink-0"
              style={{ backgroundColor: segment.color }}
            />
            <span className="font-medium text-foreground text-[12px] truncate max-w-[70px]">{segment.label}</span>
            <span className="font-semibold text-foreground text-[12px] tabular">{segment.value}</span>
            <span className="text-muted-foreground text-[11px] tabular">
              ({Math.round((segment.value / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
