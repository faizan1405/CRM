import { ChevronRight, Clock, MessageCircle, Phone, Star, Trash2 } from "lucide-react";
import { getTelephoneHref } from "@/features/leads/contact-links";
import { cleanLeadName, formatCurrency, formatDate } from "@/features/leads/formatters";
import { LeadStatusBadge } from "@/features/leads/lead-status-badge";
import { getCanonicalLeadTheme } from "@/features/leads/lead-card-theme";
import type { Lead } from "@/features/leads/types";
import { AIScoreBadge, deriveAIAttention } from "@/features/ai-attention";
import { useWhatsApp } from "@/components/whatsapp-context";
import { Avatar } from "@/components/crm/primitives";

export const LEAD_TABLE_GRID =
  "grid grid-cols-[minmax(220px,2fr)_minmax(110px,1fr)_minmax(130px,1.2fr)_minmax(130px,1.2fr)_minmax(140px,1.2fr)_minmax(120px,1fr)_minmax(210px,auto)] items-center";

export function LeadTable({
  leads,
  onSelect,
  onDelete,
  onTogglePin,
}: {
  leads: Lead[];
  onSelect: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onTogglePin?: (lead: Lead) => void;
}) {
  const { openWhatsApp } = useWhatsApp();
  return (
    <div className="hidden overflow-x-auto lg:block">
      <div role="table" className="w-full min-w-[1060px] text-left card-surface overflow-hidden">
        <div role="rowgroup">
          <div
            role="row"
            className={`border-b border-border bg-muted/40 text-[11.5px] font-medium text-muted-foreground ${LEAD_TABLE_GRID}`}
          >
            <div role="columnheader" className="px-5 py-3">Name / Business</div>
            <div role="columnheader" className="px-4 py-3">AI Score</div>
            <div role="columnheader" className="px-4 py-3">Phone</div>
            <div role="columnheader" className="px-4 py-3">Status</div>
            <div role="columnheader" className="px-4 py-3">Next follow-up</div>
            <div role="columnheader" className="px-4 py-3">Quoted amount</div>
            <div role="columnheader" className="px-5 py-3 text-right">Actions</div>
          </div>
        </div>
        <div role="rowgroup" className="divide-y divide-border/60">
          {leads.map((lead) => {
            const ai = lead.aiAttention || deriveAIAttention(lead);
            const isTerminal = lead.status === "Won" || lead.status === "Lost";
            const theme = getCanonicalLeadTheme(lead.status);
            const displayName = cleanLeadName(lead.name);
            return (
              <div
                role="row"
                key={lead.id}
                tabIndex={0}
                aria-label={`Open lead ${lead.name}`}
                onClick={(event) => {
                  if (!(event.target as HTMLElement).closest("a,button")) onSelect(lead);
                }}
                onKeyDown={(event) => {
                  if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    onSelect(lead);
                  }
                }}
                className={`group cursor-pointer transition-colors duration-150 hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${LEAD_TABLE_GRID}`}
              >
                <div role="cell" className="px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    {onTogglePin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePin(lead);
                        }}
                        aria-label={lead.isPinned ? `Unpin ${lead.name}` : `Pin ${lead.name}`}
                        title={lead.isPinned ? "Unpin lead" : "Pin lead"}
                        className="press inline-flex size-7 items-center justify-center rounded-lg hover:bg-accent active:scale-95 transition-transform shrink-0 cursor-pointer"
                      >
                        <Star
                          size={15}
                          className={lead.isPinned ? "fill-warning text-warning" : "text-subtle hover:text-warning"}
                        />
                      </button>
                    )}
                    <Avatar name={displayName} className="h-8 w-8 text-[11px]" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate text-[13.5px] leading-tight">{displayName}</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground truncate">{lead.business || "No business added"}</p>
                    </div>
                  </div>
                </div>
                <div role="cell" className="whitespace-nowrap px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <AIScoreBadge score={ai.score} category={ai.scoreCategory} size="sm" />
                    {!isTerminal && ai.priority === "critical" && (
                      <span className="flex size-2 rounded-full bg-destructive" title="Critical Attention" />
                    )}
                  </div>
                </div>
                <div role="cell" className="whitespace-nowrap px-4 py-3.5 text-[13px] text-muted-foreground tabular font-mono">
                  {lead.phone || "—"}
                </div>
                <div role="cell" className="px-4 py-3.5">
                  <div className="flex flex-col gap-1 items-start">
                    <LeadStatusBadge status={lead.status} />
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
                <div role="cell" className="whitespace-nowrap px-4 py-3.5 text-[12px] text-muted-foreground tabular">
                  {lead.nextFollowUpDate ? formatDate(lead.nextFollowUpDate) : "—"}
                </div>
                <div role="cell" className="whitespace-nowrap px-4 py-3.5 text-[13.5px] font-semibold tabular text-foreground">
                  {formatCurrency(lead.quotedAmount)}
                </div>
                <div role="cell" className="px-5 py-3.5 text-right">
                  <div className="inline-flex items-center gap-1 justify-end">
                    <button
                      type="button"
                      onClick={() => onDelete(lead)}
                      aria-label={`Delete ${lead.name}`}
                      title="Delete lead"
                      className="press grid size-8 place-items-center rounded-lg text-subtle hover:bg-danger-soft hover:text-destructive transition-colors focus-visible:ring-2 focus-visible:ring-destructive cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                    <a
                      href={getTelephoneHref(lead.phone)}
                      className="press grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                      aria-label={`Call ${lead.name}`}
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
                      aria-label={`Message ${lead.name} on WhatsApp`}
                      title="Message on WhatsApp"
                    >
                      <MessageCircle aria-hidden="true" size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelect(lead)}
                      className="press inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                      aria-label={`View ${lead.name}`}
                    >
                      View <ChevronRight aria-hidden="true" size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
