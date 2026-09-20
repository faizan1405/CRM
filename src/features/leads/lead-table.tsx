import { ChevronRight, Clock, MessageCircle, Phone, Star, Trash2 } from "lucide-react";
import { getTelephoneHref } from "@/features/leads/contact-links";
import { formatCurrency, formatDate } from "@/features/leads/formatters";
import { LeadStatusBadge } from "@/features/leads/lead-status-badge";
import { getCanonicalLeadTheme } from "@/features/leads/lead-card-theme";
import type { Lead } from "@/features/leads/types";
import { AIScoreBadge, deriveAIAttention } from "@/features/ai-attention";
import { useWhatsApp } from "@/components/whatsapp-context";

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
      <table className="w-full min-w-[860px] border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-5 py-3.5">Name / Business</th>
            <th className="px-4 py-3.5">AI Score</th>
            <th className="px-4 py-3.5">Phone</th>
            <th className="px-4 py-3.5">Status</th>
            <th className="px-4 py-3.5">Next follow-up</th>
            <th className="px-4 py-3.5">Quoted amount</th>
            <th className="px-5 py-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {leads.map((lead) => {
            const ai = lead.aiAttention || deriveAIAttention(lead);
            const isTerminal = lead.status === "Won" || lead.status === "Lost";
            const theme = getCanonicalLeadTheme(lead.status);
            return (
              <tr key={lead.id} tabIndex={0} aria-label={`Open lead ${lead.name}`} onClick={event => { if (!(event.target as HTMLElement).closest("a,button")) onSelect(lead); }} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect(lead); } }} className={`cursor-pointer ${theme.rowBg} ${theme.rowHoverBg} transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600`}>
                <td className={`px-5 py-4 ${theme.leftBorder}`}>
                  <div className="flex items-center gap-1.5">
                    {onTogglePin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePin(lead);
                        }}
                        aria-label={lead.isPinned ? `Unpin ${lead.name}` : `Pin ${lead.name}`}
                        title={lead.isPinned ? "Unpin lead" : "Pin lead"}
                        className="inline-flex size-7 items-center justify-center rounded hover:bg-amber-50 active:scale-95 transition-transform shrink-0 cursor-pointer"
                      >
                        <Star
                          size={16}
                          className={lead.isPinned ? "fill-amber-400 text-amber-500" : "text-slate-300 hover:text-amber-500"}
                        />
                      </button>
                    )}
                    <div>
                      <p className="font-semibold text-slate-900">{lead.name}</p>
                      <p className="mt-0.5 text-sm text-[var(--muted)]">{lead.business || "No business added"}</p>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <div className="flex items-center gap-1.5">
                    <AIScoreBadge score={ai.score} category={ai.scoreCategory} size="sm" />
                    {!isTerminal && ai.priority === "critical" && (
                      <span className="flex size-2 rounded-full bg-rose-500" title="Critical Attention" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1 items-start">
                    <LeadStatusBadge status={lead.status} />
                    {lead.staleInfo?.isStale && (
                      <span
                        role="status"
                        aria-label={lead.staleInfo.staleLabel}
                        title={lead.staleInfo.staleLabel}
                        className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 whitespace-nowrap"
                      >
                        <Clock size={10} className="text-amber-600 shrink-0" aria-hidden="true" />
                        <span>{lead.staleInfo.staleLabel}</span>
                      </span>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-700">{formatCurrency(lead.quotedAmount)}</td>
                <td className="px-5 py-4 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button type="button" onClick={() => onDelete(lead)} aria-label={`Delete ${lead.name}`} className="grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-600"><Trash2 size={17} /></button>
                    <a href={getTelephoneHref(lead.phone)} className="grid size-10 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-700" aria-label={`Call ${lead.name}`}><Phone aria-hidden="true" size={17} /></a>
                    <button type="button" onClick={(e) => { e.stopPropagation(); openWhatsApp(lead); }} className="grid size-10 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700" aria-label={`Message ${lead.name} on WhatsApp`}><MessageCircle aria-hidden="true" size={17} /></button>
                    <button type="button" onClick={() => onSelect(lead)} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer" aria-label={`View ${lead.name}`}>
                      View <ChevronRight aria-hidden="true" size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
