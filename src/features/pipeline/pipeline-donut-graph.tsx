"use client";

import type { Lead, LeadStatus } from "@/features/leads/types";
import { useMemo } from "react";

// Matches PIPELINE_COLUMNS order + Won/Lost
const STAGE_COLORS: Record<string, string> = {
  New: "#3b82f6", // blue-500
  Contacted: "#8b5cf6", // violet-500
  Qualified: "#10b981", // emerald-500
  "Proposal Sent": "#f59e0b", // amber-500
  Won: "#059669", // emerald-600
  Lost: "#ef4444", // red-500
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
      <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-slate-100 bg-slate-50">
        <span className="text-xs text-slate-400 font-semibold">No Data</span>
      </div>
    );
  }

  // Calculate SVG paths
  const cx = 50;
  const cy = 50;
  const r = 40;
  const circumference = 2 * Math.PI * r;

  let currentOffset = 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-28 w-28 shrink-0 sm:h-32 sm:w-32">
        <svg viewBox="0 0 100 100" className="-rotate-90 transform w-full h-full">
          <circle cx={cx} cy={cy} r={r} fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
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
                strokeWidth="12"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500 ease-in-out hover:stroke-[14px] cursor-pointer"
              >
                <title>{`${segment.label}: ${segment.value}`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-900 leading-none">{total}</span>
          <span className="text-[10px] font-semibold uppercase text-slate-500">Leads</span>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-2">
        {data.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: segment.color }}
            />
            <span className="font-medium text-slate-600 w-16">{segment.label}</span>
            <span className="font-bold text-slate-900">{segment.value}</span>
            <span className="text-slate-400">({Math.round((segment.value / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
