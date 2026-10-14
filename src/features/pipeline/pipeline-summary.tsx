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
    <div className="flex flex-wrap gap-2.5 sm:gap-3" role="region" aria-label="Pipeline summary">
      {Object.entries(stats).map(([label, value]) => (
        <Link
          href={label === "Total" ? "/leads" : `/pipeline?stage=${label === "Proposal" ? "PROPOSAL_SENT" : label.toUpperCase()}`}
          aria-label={`View ${label} leads`}
          key={label}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 cursor-pointer flex flex-col rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-lift)] border border-border/80 hover:border-border min-w-[105px] flex-1 sm:flex-none transition-all duration-200 card-hover press"
        >
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular">{value}</p>
        </Link>
      ))}
    </div>
  );
}
