"use client";

import type { BriefingProposalItem } from "../types";
import { FileText, ArrowUpRight } from "lucide-react";

export type ProposalsAwaitingReplyProps = {
  proposals?: BriefingProposalItem[];
  onOpenLead?: (leadId: string) => void;
  className?: string;
};

export function ProposalsAwaitingReply({
  proposals = [],
  onOpenLead,
  className = "",
}: ProposalsAwaitingReplyProps) {
  return (
    <section
      aria-label="Proposal Stage Leads"
      className={`rounded-2xl border border-slate-200 dark:border-border bg-white dark:bg-card p-4 sm:p-5 shadow-xs ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-border/60">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            <FileText size={13} />
          </span>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Proposal Stage Leads
          </h2>
        </div>
        <span className="rounded-full bg-slate-100 dark:bg-muted px-2 py-0.5 text-xs font-semibold tabular text-slate-700 dark:text-muted-foreground">
          {proposals.length}
        </span>
      </div>

      {/* List or Empty State */}
      {proposals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="grid size-9 place-items-center rounded-full bg-slate-100 dark:bg-muted text-slate-400">
            <FileText size={18} />
          </div>
          <p className="mt-2 text-xs font-semibold text-foreground">
            No leads in proposal stage
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Leads in Proposal Sent stage will appear here.
          </p>
        </div>
      ) : (
        <ol className="divide-y divide-slate-100 dark:divide-border/60">
          {proposals.map((proposal) => (
            <li
              key={proposal.id}
              onClick={() => onOpenLead && onOpenLead(proposal.leadId)}
              className="group flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-slate-50/80 dark:hover:bg-muted/30 px-1 rounded-lg cursor-pointer"
            >
              {/* Left: Client name and company */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    {proposal.clientName}
                  </span>
                  <ArrowUpRight
                    size={11}
                    className="text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
                {proposal.companyName && (
                  <div className="truncate text-[11px] text-muted-foreground">
                    {proposal.companyName}
                  </div>
                )}
              </div>

              {/* Right: Quoted Amount & Days Badge */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold tabular text-foreground">
                  {proposal.quotedAmountFormatted}
                </span>
                <span className="rounded bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-400">
                  {proposal.daysAgo !== undefined && proposal.daysAgo > 0
                    ? `${proposal.daysAgo}d ago`
                    : "Sent"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
