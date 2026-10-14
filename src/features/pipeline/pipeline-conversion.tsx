"use client";

import { useMemo } from "react";
import type { Lead, LeadStatus } from "@/features/leads/types";
import { ArrowRight } from "lucide-react";

export function PipelineConversion({ leads, grouped }: { leads: Lead[]; grouped: Record<LeadStatus, Lead[]> }) {
  const conversions = useMemo(() => {
    const total = leads.length;
    // For conversions, we should include leads that moved PAST the stage as well, or just use the funnel logic.
    // Funnel logic:
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
      { label: "Total → Contacted", rate: rate(contactedAndBeyond, total), color: "text-blue-600", bg: "bg-blue-50" },
      { label: "Contacted → Qualified", rate: rate(qualifiedAndBeyond, contactedAndBeyond), color: "text-indigo-600", bg: "bg-indigo-50" },
      { label: "Qualified → Proposal", rate: rate(proposalAndBeyond, qualifiedAndBeyond), color: "text-purple-600", bg: "bg-purple-50" },
      { label: "Proposal → Won", rate: rate(won, proposalAndBeyond), color: "text-emerald-600", bg: "bg-emerald-50" },
      { label: "Overall Win Rate", rate: rate(won, total), color: "text-slate-700", bg: "bg-slate-100", highlight: true },
    ];
  }, [leads, grouped]);

  return (
    <div className="flex flex-nowrap overflow-x-auto gap-3 pb-2 sm:pb-0 hide-scrollbar" role="region" aria-label="Pipeline conversion analytics">
      {conversions.map((conv, i) => (
        <div
          key={conv.label}
          className={`shrink-0 flex flex-col justify-center rounded-xl px-4 py-3 border border-slate-100 ${conv.bg} ${conv.highlight ? 'border-slate-300 shadow-sm' : ''}`}
        >
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
            {conv.label.split(" → ").map((part, j) => (
              <span key={j} className="flex items-center gap-1.5">
                {j > 0 && <ArrowRight size={10} className="text-slate-400" />}
                {part}
              </span>
            ))}
          </div>
          <p className={`mt-1 text-lg sm:text-xl font-bold tracking-tight ${conv.color}`}>{conv.rate}</p>
        </div>
      ))}
    </div>
  );
}
