"use client";

import {
  ChevronRight,
  Clock,
  MessageCircle,
  Phone,
  Star,
  Trash2,
} from "lucide-react";
import { getTelephoneHref } from "@/features/leads/contact-links";
import { cleanLeadName, formatCurrency, formatDate } from "@/features/leads/formatters";
import { LeadStatusBadge } from "@/features/leads/lead-status-badge";
import type { Lead } from "@/features/leads/types";
import { AIScoreBadge, deriveAIAttention } from "@/features/ai-attention";
import { useWhatsApp } from "@/components/whatsapp-context";
import { Avatar, QuickStatusPill } from "@/components/crm/primitives";
import { cn } from "@/lib/utils";

export const LEAD_TABLE_GRID =
  "grid grid-cols-[minmax(220px,2fr)_minmax(110px,1fr)_minmax(130px,1.2fr)_minmax(130px,1.2fr)_minmax(140px,1.2fr)_minmax(120px,1fr)_minmax(210px,auto)] items-center";

export type LeadTableProps = {
  leads: Lead[];
  totalCount?: number;
  onSelect: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onTogglePin?: (lead: Lead) => void;
  onClearFilters?: () => void;
  hasFilters?: boolean;
};

function formatFollowUpDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return formatDate(dateStr);
}

function isFollowUpOverdue(dateStr: string | null) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return target.getTime() < today.getTime();
}

function isFollowUpToday(dateStr: string | null) {
  if (!dateStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return target.getTime() === today.getTime();
}

export function LeadTable({
  leads,
  totalCount,
  onSelect,
  onDelete,
  onTogglePin,
  onClearFilters,
  hasFilters = false,
}: LeadTableProps) {
  const { openWhatsApp } = useWhatsApp();
  const total = totalCount ?? leads.length;

  return (
    <div className="card-surface overflow-hidden rounded-xl border border-border shadow-[var(--shadow-card)]">
      {/* ─── Desktop Table View ────────────────────────────── */}
      <div className="hidden overflow-x-auto lg:block">
        <div role="table" className="w-full min-w-[1060px] text-left text-[13px]">
          <div role="rowgroup">
            <div
              role="row"
              className={`border-b border-border bg-muted/40 text-[11.5px] font-medium text-muted-foreground ${LEAD_TABLE_GRID}`}
            >
              <div role="columnheader" className="px-5 py-3 font-medium">Name / Business</div>
              <div role="columnheader" className="px-4 py-3 font-medium">AI Score</div>
              <div role="columnheader" className="px-4 py-3 font-medium">Phone</div>
              <div role="columnheader" className="px-4 py-3 font-medium">Status</div>
              <div role="columnheader" className="px-4 py-3 font-medium">Next follow-up</div>
              <div role="columnheader" className="px-4 py-3 text-right font-medium">Quoted amount</div>
              <div role="columnheader" className="px-5 py-3 text-right font-medium">Actions</div>
            </div>
          </div>

          <div role="rowgroup" className="divide-y divide-border/60">
            {leads.map((lead) => {
              const ai = lead.aiAttention || deriveAIAttention(lead);
              const isTerminal = lead.status === "Won" || lead.status === "Lost";
              const displayName = cleanLeadName(lead.name);
              const overdue = isFollowUpOverdue(lead.nextFollowUpDate);
              const isToday = isFollowUpToday(lead.nextFollowUpDate);
              const displayValue = lead.quotedAmount ?? lead.budget ?? null;

              return (
                <div
                  role="row"
                  key={lead.id}
                  tabIndex={0}
                  aria-label={`Open lead ${lead.name}`}
                  onClick={(event) => {
                    if (!(event.target as HTMLElement).closest("a,button")) {
                      onSelect(lead);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      onSelect(lead);
                    }
                  }}
                  className={`group cursor-pointer transition-colors duration-150 hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${LEAD_TABLE_GRID}`}
                >
                  {/* Column 1: Name / Business / Avatar / Pin */}
                  <div role="cell" className="px-5 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      {onTogglePin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePin(lead);
                          }}
                          aria-label={lead.isPinned ? `Unpin ${displayName}` : `Pin ${displayName}`}
                          title={lead.isPinned ? "Unpin lead" : "Pin lead"}
                          className="press inline-flex size-7 items-center justify-center rounded-lg hover:bg-accent active:scale-95 transition-transform shrink-0 cursor-pointer"
                        >
                          <Star
                            size={15}
                            className={lead.isPinned ? "fill-amber-400 text-amber-500" : "text-subtle hover:text-amber-500"}
                          />
                        </button>
                      )}
                      <Avatar name={displayName} className="h-8 w-8 text-[11px]" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-foreground truncate text-[13.5px] leading-tight">
                            {displayName}
                          </p>
                          {lead.isPinned && !onTogglePin && (
                            <Star size={12} className="fill-amber-400 text-amber-500 shrink-0" />
                          )}
                        </div>
                        <p className="mt-0.5 text-[12px] text-muted-foreground truncate">
                          {[lead.business, lead.industry].filter(Boolean).join(" · ") || lead.phone || "No business added"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: AI Score */}
                  <div role="cell" className="whitespace-nowrap px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <AIScoreBadge score={ai.score} category={ai.scoreCategory} size="sm" />
                      {!isTerminal && ai.priority === "critical" && (
                        <span className="flex size-2 rounded-full bg-destructive animate-pulse" title="Critical Attention" />
                      )}
                    </div>
                  </div>

                  {/* Column 3: Phone */}
                  <div role="cell" className="whitespace-nowrap px-4 py-3.5 text-[13px] text-muted-foreground tabular font-mono">
                    {lead.phone || "—"}
                  </div>

                  {/* Column 4: Status + Quick Status */}
                  <div role="cell" className="px-4 py-3.5">
                    <div className="flex flex-col gap-1 items-start">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <LeadStatusBadge status={lead.status} />
                        {lead.quickStatus && lead.quickStatus !== "NONE" && (
                          <QuickStatusPill status={lead.quickStatus} />
                        )}
                      </div>
                      {lead.staleInfo?.isStale && (
                        <span
                          role="status"
                          aria-label={lead.staleInfo.staleLabel}
                          title={lead.staleInfo.staleLabel}
                          className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning whitespace-nowrap"
                        >
                          <Clock size={10} className="text-warning shrink-0" aria-hidden="true" />
                          <span>{lead.staleInfo.staleLabel}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Column 5: Next follow-up */}
                  <div
                    role="cell"
                    className={cn(
                      "whitespace-nowrap px-4 py-3.5 text-[12.5px] tabular",
                      overdue
                        ? "font-medium text-destructive"
                        : isToday
                        ? "font-medium text-warning"
                        : "text-muted-foreground"
                    )}
                  >
                    <div>{lead.nextFollowUpDate ? formatDate(lead.nextFollowUpDate) : "—"}</div>
                    {lead.nextFollowUpDate && (
                      <div className="text-[11px] text-subtle font-normal">
                        {formatFollowUpDate(lead.nextFollowUpDate)}
                      </div>
                    )}
                  </div>

                  {/* Column 6: Quoted amount / Value */}
                  <div role="cell" className="whitespace-nowrap px-4 py-3.5 text-right tabular">
                    <div className="text-[13.5px] font-semibold text-foreground">
                      {formatCurrency(displayValue)}
                    </div>
                    {displayValue !== null && (
                      <div className="text-[11px] text-subtle">
                        {lead.quotedAmount ? "quoted" : lead.budget ? "budget" : ""}
                      </div>
                    )}
                  </div>

                  {/* Column 7: Actions */}
                  <div role="cell" className="px-5 py-3.5 text-right">
                    <div className="inline-flex items-center gap-1 justify-end opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(lead);
                        }}
                        aria-label={`Delete ${displayName}`}
                        title="Delete lead"
                        className="press grid size-8 place-items-center rounded-lg text-subtle hover:bg-danger-soft hover:text-destructive transition-colors focus-visible:ring-2 focus-visible:ring-destructive cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                      <a
                        href={getTelephoneHref(lead.phone)}
                        onClick={(e) => e.stopPropagation()}
                        className="press grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                        aria-label={`Call ${displayName}`}
                        title="Call lead"
                      >
                        <Phone aria-hidden="true" size={15} />
                      </a>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openWhatsApp(lead);
                        }}
                        className="press grid size-8 place-items-center rounded-lg text-whatsapp hover:bg-success-soft transition-colors cursor-pointer"
                        aria-label={`Message ${displayName} on WhatsApp`}
                        title="WhatsApp message"
                      >
                        <MessageCircle aria-hidden="true" size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(lead);
                        }}
                        className="press grid size-8 place-items-center rounded-lg text-subtle hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                        aria-label={`View ${displayName}`}
                        title="View lead details"
                      >
                        <ChevronRight className="h-4 w-4 text-subtle transition-transform duration-200 group-hover:translate-x-0.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Mobile Card List View (Lovable Style) ─────────── */}
      <div className="divide-y divide-border lg:hidden">
        {leads.map((lead) => {
          const displayName = cleanLeadName(lead.name);
          const overdue = isFollowUpOverdue(lead.nextFollowUpDate);
          const displayValue = lead.quotedAmount ?? lead.budget ?? null;

          return (
            <div
              key={lead.id}
              className="flex items-center gap-3 px-3.5 py-3 transition-colors active:bg-muted"
            >
              <button
                type="button"
                onClick={() => onSelect(lead)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
              >
                <Avatar name={displayName} className="h-10 w-10 text-[12px]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-medium text-foreground">
                      {displayName}
                    </span>
                    {lead.isPinned && (
                      <Star size={13} className="fill-amber-400 text-amber-500 shrink-0" />
                    )}
                  </div>
                  <div className="truncate text-[12.5px] text-muted-foreground">
                    {lead.business || lead.phone}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <LeadStatusBadge status={lead.status} />
                    {displayValue !== null && (
                      <span className="text-[12.5px] font-semibold tabular text-foreground">
                        {formatCurrency(displayValue)}
                      </span>
                    )}
                    {overdue && (
                      <span className="text-[11.5px] font-medium text-destructive">
                        · overdue
                      </span>
                    )}
                  </div>
                </div>
              </button>

              <div className="flex shrink-0 gap-1 flex-col">
                <a
                  aria-label={`Call ${displayName}`}
                  href={getTelephoneHref(lead.phone)}
                  onClick={(e) => e.stopPropagation()}
                  className="press grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                >
                  <Phone className="h-[15px] w-[15px]" />
                </a>
                <button
                  type="button"
                  aria-label={`Message ${displayName} on WhatsApp`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openWhatsApp(lead);
                  }}
                  className="press grid h-8 w-8 place-items-center rounded-lg text-whatsapp hover:bg-success-soft cursor-pointer"
                >
                  <MessageCircle className="h-[15px] w-[15px]" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Table Footer ──────────────────────────────────── */}
      <div className="flex items-center justify-between border-t border-border bg-muted/40 px-5 py-2.5 text-[12px] text-muted-foreground">
        <span className="tabular font-medium">
          {leads.length} of {total} {total === 1 ? "lead" : "leads"}
        </span>
        {hasFilters && onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="font-medium hover:text-foreground cursor-pointer transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
