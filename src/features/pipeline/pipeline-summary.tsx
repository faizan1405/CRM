"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Lead, LeadStatus } from "@/features/leads/types";

export function PipelineSummary({ leads, grouped }: { leads: Lead[]; grouped: Record<LeadStatus, Lead[]> }) {
  const stats = useMemo(
    () => ({
      Total: leads.length,
      Qualified: grouped["Qualified"].length,
      Proposal: grouped["Proposal Sent"].length,
      Won: grouped["Won"].length,
      Lost: grouped["Lost"].length,
    }),
    [leads, grouped]
  );

  return (
    <div className="flex flex-wrap gap-3" role="region" aria-label="Pipeline summary">
      {Object.entries(stats).map(([label, value]) => (
        <Link
          href={label === "Total" ? "/leads" : `/pipeline?stage=${label === "Proposal" ? "PROPOSAL_SENT" : label.toUpperCase()}`}
          aria-label={`View ${label} leads`}
          key={label}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 hover:border-blue-300 cursor-pointer flex flex-col rounded-lg bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.04)] border border-[var(--border)] min-w-[110px] flex-1 sm:flex-none"
        >
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        </Link>
      ))}
    </div>
  );
}
