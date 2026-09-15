"use client";

import { useEffect, useMemo, useState } from "react";
import type { Lead, LeadStatus } from "@/features/leads/types";
import { PipelineCard } from "./pipeline-card";
import { PipelineEmptyState } from "./pipeline-column";

const STAGES: LeadStatus[] = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Won",
  "Lost",
];

const statusAccent: Record<LeadStatus, { dot: string; activeBg: string; activeText: string }> = {
  New: { dot: "bg-blue-500", activeBg: "bg-blue-50", activeText: "text-blue-700" },
  Contacted: { dot: "bg-slate-400", activeBg: "bg-slate-100", activeText: "text-slate-700" },
  Qualified: { dot: "bg-indigo-500", activeBg: "bg-indigo-50", activeText: "text-indigo-700" },
  "Proposal Sent": { dot: "bg-amber-500", activeBg: "bg-amber-50", activeText: "text-amber-800" },
  Won: { dot: "bg-emerald-500", activeBg: "bg-emerald-50", activeText: "text-emerald-800" },
  Lost: { dot: "bg-rose-500", activeBg: "bg-rose-50", activeText: "text-rose-800" },
};

export function PipelineMobileView({
  leads,
  initialStage,
  grouped,
  onSelectLead,
}: {
  leads: Lead[];
  initialStage?: LeadStatus;
  grouped: Record<LeadStatus, Lead[]>;
  onSelectLead: (lead: Lead) => void;
}) {
  const [activeStage, setActiveStage] = useState<LeadStatus>(initialStage || (leads.length > 0 ? leads[0]?.status ?? "New" : "New"));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialStage) setActiveStage(initialStage);
  }, [initialStage]);
  const visibleLeads = grouped[activeStage] ?? [];

  // Compute counts for tab badges
  const counts = useMemo(() => {
    const map: Record<LeadStatus, number> = {
      New: 0,
      Contacted: 0,
      Qualified: 0,
      "Proposal Sent": 0,
      Won: 0,
      Lost: 0,
    };
    leads.forEach((lead) => {
      if (map[lead.status] !== undefined) map[lead.status]++;
    });
    return map;
  }, [leads]);

  return (
    <div className="flex h-full flex-col overflow-hidden lg:hidden">
      {/* Stage tabs */}
      <div
        className="shrink-0 overflow-x-auto border-b border-slate-200 bg-white custom-scrollbar"
        role="tablist"
        aria-label="Pipeline stages"
      >
        <div className="flex min-w-max">
          {STAGES.map((stage) => {
            const accent = statusAccent[stage];
            const isActive = activeStage === stage;
            return (
              <button
                key={stage}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveStage(stage)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? `border-blue-500 ${accent.activeText} ${accent.activeBg}`
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${isActive ? accent.dot : "bg-slate-300"}`}
                  aria-hidden="true"
                />
                {stage}
                <span
                  className={`ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-medium ${
                    isActive ? "bg-white/70" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {counts[stage]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards for selected stage */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar" role="tabpanel">
        {visibleLeads.length === 0 ? (
          <PipelineEmptyState status={activeStage} />
        ) : (
          <div className="flex flex-col gap-3">
            {visibleLeads.map((lead) => (
              <PipelineCard
                key={lead.id}
                lead={lead}
                onClick={() => onSelectLead(lead)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
