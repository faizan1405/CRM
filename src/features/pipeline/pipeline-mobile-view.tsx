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
  New: { dot: "bg-info", activeBg: "bg-info/10", activeText: "text-info" },
  Contacted: { dot: "bg-subtle", activeBg: "bg-muted", activeText: "text-foreground" },
  Qualified: { dot: "bg-chart-2", activeBg: "bg-chart-2/10", activeText: "text-chart-2" },
  "Proposal Sent": { dot: "bg-warning", activeBg: "bg-warning/10", activeText: "text-warning" },
  Won: { dot: "bg-primary", activeBg: "bg-primary/10", activeText: "text-primary" },
  Lost: { dot: "bg-destructive", activeBg: "bg-destructive/10", activeText: "text-destructive" },
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
        className="shrink-0 overflow-x-auto border-b border-border bg-card custom-scrollbar"
        role="tablist"
        aria-label="Pipeline stages"
      >
        <div className="flex min-w-max px-2">
          {STAGES.map((stage) => {
            const accent = statusAccent[stage];
            const isActive = activeStage === stage;
            return (
              <button
                key={stage}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveStage(stage)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-3.5 py-3 text-[13px] font-medium border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? `border-primary font-semibold ${accent.activeText}`
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <span
                  className={`size-2 rounded-sm ${isActive ? accent.dot : "bg-subtle"}`}
                  aria-hidden="true"
                />
                {stage}
                <span
                  className={`ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-medium tabular ${
                    isActive ? "bg-card text-foreground shadow-xs" : "bg-muted text-muted-foreground"
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
      <div className="flex-1 overflow-y-auto p-3.5 custom-scrollbar" role="tabpanel">
        {visibleLeads.length === 0 ? (
          <PipelineEmptyState status={activeStage} />
        ) : (
          <div className="flex flex-col gap-2.5">
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
