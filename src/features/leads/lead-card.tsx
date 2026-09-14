import { ChevronRight, Phone } from "lucide-react";
import { formatCurrency, formatDate } from "@/features/leads/formatters";
import { LeadStatusBadge } from "@/features/leads/lead-status-badge";
import type { Lead } from "@/features/leads/types";

export function LeadCard({ lead, onSelect }: { lead: Lead; onSelect: (lead: Lead) => void }) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-950">{lead.name}</h3>
          <p className="mt-0.5 truncate text-sm text-[var(--muted)]">{lead.business || "No business added"}</p>
        </div>
        <LeadStatusBadge status={lead.status} />
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm text-slate-700"><Phone aria-hidden="true" size={16} className="text-slate-400" />{lead.phone}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
        <div><dt className="text-xs font-medium text-slate-500">Next follow-up</dt><dd className="mt-1 text-sm font-medium text-slate-800">{formatDate(lead.nextFollowUpDate)}</dd></div>
        <div><dt className="text-xs font-medium text-slate-500">Quoted amount</dt><dd className="mt-1 text-sm font-medium text-slate-800">{formatCurrency(lead.quotedAmount)}</dd></div>
      </dl>
      <button type="button" onClick={() => onSelect(lead)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50" aria-label={`View ${lead.name}`}>
        View details <ChevronRight aria-hidden="true" size={16} />
      </button>
    </article>
  );
}
