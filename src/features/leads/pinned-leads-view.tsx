"use client";

import {
  Phone,
  MessageCircle,
  CalendarPlus,
  Star,
  Clock,
  Activity,
  FileText,
  ArrowUpDown,
} from "lucide-react";
import { formatCurrency } from "@/features/leads/formatters";
import { formatNextFollowUp, formatLastContacted } from "@/lib/date-utils";
import { LeadStatusBadge } from "@/features/leads/lead-status-badge";
import { useWhatsApp } from "@/components/whatsapp-context";
import { useCall } from "@/components/call-context";
import { CopyContactButton } from "@/components/copy-contact-button";
import { Avatar } from "@/components/crm/primitives";
import type { Lead, LeadSortOption } from "@/features/leads/types";
import { cn } from "@/lib/utils";

type PinnedLeadsViewProps = {
  leads: Lead[];
  onSelect: (lead: Lead) => void;
  onTogglePin: (lead: Lead) => void;
  onAddFollowUp: (lead: Lead) => void;
  sortBy?: LeadSortOption;
  onSortByChange?: (value: LeadSortOption) => void;
};

export function PinnedLeadsView({
  leads,
  onSelect,
  onTogglePin,
  onAddFollowUp,
  sortBy = "default",
  onSortByChange,
}: PinnedLeadsViewProps) {
  const { openWhatsApp } = useWhatsApp();
  const { openCallModal } = useCall();

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center shadow-xs">
        <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
          <Star className="size-6 fill-amber-400 text-amber-500" />
        </div>
        <h3 className="mt-3.5 text-base font-semibold text-foreground">No pinned leads yet</h3>
        <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
          Star important leads from the Leads table, Pipeline, or Lead Details to maintain your priority shortlist.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* Top Header Summary & Sorting */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="tabular text-[13px] font-semibold text-foreground">
            {leads.length} {leads.length === 1 ? "lead" : "leads"} shortlisted
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            <Star className="size-3 fill-current" /> Priority Shortlist
          </span>
        </div>

        {onSortByChange && (
          <div className="flex items-center gap-1.5">
            <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="sr-only">Sort pinned leads</span>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => onSortByChange(e.target.value as LeadSortOption)}
                  className="h-8 rounded-lg bg-card pl-2.5 pr-7 text-[12px] font-medium text-foreground shadow-[inset_0_0_0_1px_var(--input)] outline-none transition-shadow hover:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_20%,var(--input))] focus:shadow-[inset_0_0_0_1px_var(--ring),0_0_0_2px_color-mix(in_oklab,var(--ring)_15%,transparent)] cursor-pointer"
                  aria-label="Sort pinned leads"
                  data-testid="pinned-sort-select"
                >
                  <option value="default">Newest</option>
                  <option value="value">Highest Value</option>
                  <option value="followup">Earliest Follow-up</option>
                  <option value="name_asc">Name A → Z</option>
                  <option value="name_desc">Name Z → A</option>
                  <option value="most_stale">Most Stale</option>
                </select>
                <ArrowUpDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-subtle" />
              </div>
            </label>
          </div>
        )}
      </div>

      {/* Lovable-Fidelity Pinned Cards Grid */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {leads.map((lead) => {
          const notesText = lead.latestNote || lead.notes || "";
          const dealAmount = lead.dealValue ?? lead.quotedAmount ?? lead.budget ?? null;
          const lastActivityText =
            lead.lastActivity?.message ||
            (lead.lastContactDate
              ? `Contacted: ${formatLastContacted(lead.lastContactDate)}`
              : "Lead created");

          return (
            <div
              key={lead.id}
              tabIndex={0}
              role="button"
              aria-label={`Open pinned lead ${lead.name}`}
              onClick={() => onSelect(lead)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(lead);
                }
              }}
              className="card-surface group relative flex flex-col justify-between rounded-xl p-4 shadow-[var(--shadow-card)] transition-all duration-150 hover:shadow-md cursor-pointer border border-border"
            >
              <div>
                {/* Header: Avatar, Name, Status & Unpin Action */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar name={lead.name} className="h-9 w-9 text-[11px]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="truncate text-[14.5px] font-semibold text-foreground tracking-tight">
                          {lead.name}
                        </h3>
                        <LeadStatusBadge status={lead.status} />
                        {lead.staleInfo?.isStale && (
                          <span
                            role="status"
                            aria-label={lead.staleInfo.staleLabel}
                            title={lead.staleInfo.staleLabel}
                            className="inline-flex items-center gap-1 rounded bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning"
                          >
                            <Clock size={10} className="shrink-0" />
                            <span>{lead.staleInfo.staleLabel}</span>
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[12px] text-muted-foreground mt-0.5">
                        {[lead.business, lead.industry].filter(Boolean).join(" · ") || "No business added"}
                      </p>
                    </div>
                  </div>

                  {/* Unpin button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(lead);
                    }}
                    className="press inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
                    title="Unpin lead"
                    aria-label={`Unpin ${lead.name}`}
                  >
                    <Star className="size-3.5 fill-amber-400 text-amber-500" />
                    <span className="text-[11.5px] text-muted-foreground">Unpin</span>
                  </button>
                </div>

                {/* Phone & Value Pill */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5 text-xs">
                  <div className="flex items-center gap-1.5 text-foreground font-mono">
                    <Phone className="size-3.5 text-subtle shrink-0" />
                    <span className="tabular">{lead.phone}</span>
                    <CopyContactButton name={lead.name} phone={lead.phone} />
                  </div>

                  {dealAmount !== null && (
                    <div className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 font-semibold text-accent-foreground text-[11px] tabular">
                      <span>{lead.quotedAmount ? "Quoted" : "Value"}: {formatCurrency(dealAmount)}</span>
                    </div>
                  )}
                </div>

                {/* Latest Note Box */}
                <div className="mt-2.5 rounded-lg bg-muted/50 p-2.5 text-[12px] text-foreground/80">
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    <FileText className="size-3 text-subtle shrink-0" />
                    <span>Latest Note</span>
                  </div>
                  <p className="line-clamp-2 leading-relaxed">
                    {notesText ? (
                      notesText
                    ) : (
                      <span className="italic text-muted-foreground">No notes recorded</span>
                    )}
                  </p>
                </div>

                {/* Timings: Next Follow-up & Last Activity */}
                <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11.5px] text-muted-foreground">
                  <div className="flex flex-col">
                    <span className="flex items-center gap-1 font-medium text-subtle text-[10px] uppercase tracking-wide">
                      <Clock className="size-3 shrink-0" /> Next Follow-up
                    </span>
                    <span className="font-semibold text-primary mt-0.5 tabular">
                      {formatNextFollowUp(lead.nextFollowUpDate)}
                    </span>
                  </div>

                  <div className="flex flex-col text-right">
                    <span className="flex items-center justify-end gap-1 font-medium text-subtle text-[10px] uppercase tracking-wide">
                      <Activity className="size-3 shrink-0" /> Last Activity
                    </span>
                    <span className="truncate text-foreground font-medium mt-0.5" title={lastActivityText}>
                      {lastActivityText}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions: Call, WhatsApp, Follow-up */}
              <div
                className="mt-3.5 flex items-center gap-2 border-t border-border/60 pt-3"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => openCallModal(lead)}
                  className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-card border border-border text-foreground text-xs font-semibold hover:bg-muted active:scale-98 transition-all cursor-pointer"
                  aria-label={`Call ${lead.name}`}
                >
                  <Phone size={13} className="text-muted-foreground" />
                  <span>Call</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    openWhatsApp(lead);
                  }}
                  className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-whatsapp text-whatsapp-foreground text-xs font-semibold hover:opacity-90 active:scale-98 transition-all cursor-pointer"
                  aria-label={`Message ${lead.name} on WhatsApp`}
                >
                  <MessageCircle size={13} />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => onAddFollowUp(lead)}
                  className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-muted active:scale-98 transition-all cursor-pointer"
                  aria-label={`Schedule follow-up for ${lead.name}`}
                >
                  <CalendarPlus size={13} className="text-muted-foreground" />
                  <span>Follow-up</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
