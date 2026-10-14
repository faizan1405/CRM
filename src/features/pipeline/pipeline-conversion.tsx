"use client";

import { useMemo } from "react";
import type { Lead, LeadStatus } from "@/features/leads/types";
import { ArrowRight } from "lucide-react";

export function PipelineConversion({ leads, grouped }: { leads: Lead[]; grouped: Record<LeadStatus, Lead[]> }) {
  const conversions = useMemo(() => {
    const total = leads.length;
    // For conversions, we include leads that moved past the stage as well using strict funnel logic:
    // Total = all leads
    // Contacted or further = Contacted + Qualified + Proposal + Won
    const contactedAndBeyond = grouped["Contacted"].length + grouped["Qualified"].length + grouped["Proposal Sent"].length + grouped["Won"].length;
    // Qualified or further
    const qualifiedAndBeyond = grouped["Qualified"].length + grouped["Proposal Sent"].length + grouped["Won"].length;
    // Proposal or further
    const proposalAndBeyond = grouped["Proposal Sent"].length + grouped["Won"].length;
    const won = grouped["Won"].length;

    const rate = (num: number, den: number) => {
      if (den === 0) return "0%";
      return `${Math.round((num / den) * 100)}%`;
    };

    return [
      { label: "Total → Contacted", rate: rate(contactedAndBeyond, total), color: "text-info" },
      { label: "Contacted → Qualified", rate: rate(qualifiedAndBeyond, contactedAndBeyond), color: "text-chart-4" },
      { label: "Qualified → Proposal", rate: rate(proposalAndBeyond, qualifiedAndBeyond), color: "text-chart-2" },
      { label: "Proposal → Won", rate: rate(won, proposalAndBeyond), color: "text-primary" },
      { label: "Overall Win Rate", rate: rate(won, total), color: "text-foreground", highlight: true },
    ];
  }, [leads, grouped]);

  return (
    <div className="flex flex-nowrap overflow-x-auto gap-2.5 pb-1 sm:pb-0 hide-scrollbar" role="region" aria-label="Pipeline conversion analytics">
      {conversions.map((conv) => (
        <div
          key={conv.label}
          className={`shrink-0 flex flex-col justify-center rounded-xl px-3.5 py-2.5 border transition-all ${
            conv.highlight
              ? "bg-card border-primary/30 shadow-[var(--shadow-card)] ring-1 ring-inset ring-primary/20"
              : "bg-muted/40 border-border/70 hover:bg-card hover:shadow-[var(--shadow-card)]"
          }`}
        >
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            {conv.label.split(" → ").map((part, j) => (
              <span key={j} className="flex items-center gap-1.5">
                {j > 0 && <ArrowRight size={10} className="text-muted-foreground/60" />}
                {part}
              </span>
            ))}
          </div>
          <p className={`mt-1 text-lg sm:text-xl font-bold tracking-tight tabular ${conv.color}`}>{conv.rate}</p>
        </div>
      ))}
    </div>
  );
}
