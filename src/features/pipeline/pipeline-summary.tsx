"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Lead, LeadStatus } from "@/features/leads/types";

export function PipelineSummary({ leads, grouped }: { leads: Lead[]; grouped: Record<LeadStatus, Lead[]> }) {
  const stats = useMemo(
    () => [
      { label: "Total", value: leads.length, color: "text-slate-600", bg: "bg-slate-50" },
      { label: "New", value: grouped["New"].length, color: "text-sky-600", bg: "bg-sky-50" },
      { label: "Contacted", value: grouped["Contacted"].length, color: "text-violet-600", bg: "bg-violet-50" },
      { label: "Qualified", value: grouped["Qualified"].length, color: "text-fuchsia-600", bg: "bg-fuchsia-50" },
      { label: "Proposal", value: grouped["Proposal Sent"].length, color: "text-indigo-600", bg: "bg-indigo-50" },
      { label: "Won", value: grouped["Won"].length, color: "text-emerald-600", bg: "bg-emerald-50" },
    ],
    [leads, grouped]
  );

  return (
    <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0" role="region" aria-label="Pipeline summary">
      {stats.map(({ label, value, color, bg }) => (
        <Link
          href={label === "Total" ? "/leads" : `/pipeline?stage=${label === "Proposal" ? "PROPOSAL_SENT" : label.toUpperCase()}`}
          aria-label={`View ${label} leads`}
          key={label}
          className={`group flex shrink-0 items-center gap-2.5 sm:flex-col sm:items-start sm:gap-1.5 rounded-xl border border-slate-100/60 ${bg} sm:bg-white sm:shadow-sm px-3.5 py-2 sm:p-4 min-w-[fit-content] sm:min-w-[120px] transition-all duration-200 hover:border-slate-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600`}
        >
          <div className="flex items-center gap-1.5">
            <div className={`size-1.5 rounded-full bg-current ${color}`} />
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider group-hover:text-slate-700 transition-colors">
              {label}
            </p>
          </div>
          <p className={`text-sm sm:text-2xl font-bold tracking-tight ${color} sm:text-slate-900`}>{value}</p>
        </Link>
      ))}
    </div>
  );
}
