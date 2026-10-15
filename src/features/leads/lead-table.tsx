import { ChevronRight, Clock, MessageCircle, Phone, Star, Trash2 } from "lucide-react";
import { getTelephoneHref } from "@/features/leads/contact-links";
import { cleanLeadName, formatCurrency, formatDate } from "@/features/leads/formatters";
import { LeadStatusBadge } from "@/features/leads/lead-status-badge";
import { getCanonicalLeadTheme } from "@/features/leads/lead-card-theme";
import type { Lead } from "@/features/leads/types";
import { AIScoreBadge, deriveAIAttention } from "@/features/ai-attention";
import { useWhatsApp } from "@/components/whatsapp-context";

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
      <div role="table" className="w-full min-w-[1060px] text-left">
        <div role="rowgroup">
          <div
            role="row"
            className={`border-b border-slate-200 bg-slate-50/90 text-xs font-semibold uppercase tracking-wider text-slate-500 ${LEAD_TABLE_GRID}`}
          >
            <div role="columnheader" className="px-5 py-3.5">Name / Business</div>
            <div role="columnheader" className="px-4 py-3.5">AI Score</div>
            <div role="columnheader" className="px-4 py-3.5">Phone</div>
            <div role="columnheader" className="px-4 py-3.5">Status</div>
            <div role="columnheader" className="px-4 py-3.5">Next follow-up</div>
            <div role="columnheader" className="px-4 py-3.5">Quoted amount</div>
            <div role="columnheader" className="px-5 py-3.5 text-right">Actions</div>
          </div>
        </div>
        <div role="rowgroup" className="divide-y divide-slate-100">
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
                className={`cursor-pointer ${theme.rowBg} ${theme.rowHoverBg} transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${LEAD_TABLE_GRID}`}
              >
                <div role="cell" className={`px-5 py-3.5 ${theme.leftBorder}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    {onTogglePin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePin(lead);
                        }}
                        aria-label={lead.isPinned ? `Unpin ${lead.name}` : `Pin ${lead.name}`}
                        title={lead.isPinned ? "Unpin lead" : "Pin lead"}
                        className="inline-flex size-7 items-center justify-center rounded-lg hover:bg-amber-50 active:scale-95 transition-transform shrink-0 cursor-pointer"
                      >
                        <Star
                          size={15}
                          className={lead.isPinned ? "fill-amber-400 text-amber-500" : "text-slate-300 hover:text-amber-500"}
                        />
                      </button>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate text-[13.5px] leading-tight">{displayName}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)] truncate">{lead.business || "No business added"}</p>
                    </div>
                  </div>
                </div>
                <div role="cell" className="whitespace-nowrap px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <AIScoreBadge score={ai.score} category={ai.scoreCategory} size="sm" />
                    {!isTerminal && ai.priority === "critical" && (
                      <span className="flex size-2 rounded-full bg-rose-500" title="Critical Attention" />
                    )}
                  </div>
                </div>
                <div role="cell" className="whitespace-nowrap px-4 py-3.5 text-sm text-slate-700 font-mono text-xs">
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
                        className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 whitespace-nowrap"
                      >
                        <Clock size={10} className="text-amber-600 shrink-0" aria-hidden="true" />
                        <span>{lead.staleInfo.staleLabel}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div role="cell" className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-600">
                  {lead.nextFollowUpDate ? formatDate(lead.nextFollowUpDate) : "—"}
                </div>
                <div role="cell" className="whitespace-nowrap px-4 py-3.5 text-sm font-semibold text-slate-800">
                  {formatCurrency(lead.quotedAmount)}
                </div>
                <div role="cell" className="px-5 py-3.5 text-right">
                  <div className="inline-flex items-center gap-1 justify-end">
                    <button
                      type="button"
                      onClick={() => onDelete(lead)}
                      aria-label={`Delete ${lead.name}`}
                      title="Delete lead"
                      className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors focus-visible:ring-2 focus-visible:ring-rose-600 cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                    <a
                      href={getTelephoneHref(lead.phone)}
                      className="grid size-8 place-items-center rounded-lg text-blue-600 bg-blue-50/70 hover:bg-blue-100 hover:text-blue-700 transition-colors cursor-pointer"
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
                      className="grid size-8 place-items-center rounded-lg text-emerald-600 bg-emerald-50/70 hover:bg-emerald-100 hover:text-emerald-700 transition-colors cursor-pointer"
                      aria-label={`Message ${lead.name} on WhatsApp`}
                      title="Message on WhatsApp"
                    >
                      <MessageCircle aria-hidden="true" size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelect(lead)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
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
