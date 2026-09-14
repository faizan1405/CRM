import { ChevronRight, Phone } from "lucide-react";
import { formatCurrency, formatDate } from "@/features/leads/formatters";
import { getTelephoneHref } from "@/features/leads/contact-links";
import { LeadQuickActions } from "@/features/leads/lead-quick-actions";
import { LeadStatusBadge } from "@/features/leads/lead-status-badge";
import type { Lead } from "@/features/leads/types";

type LeadCardProps = {
  lead: Lead;
  onSelect: (lead: Lead, action?: "note" | "status") => void;
  onAddFollowUp: (lead: Lead) => void;
  whatsAppMessage?: string;
};

export function LeadCard({ lead, onSelect, onAddFollowUp, whatsAppMessage }: LeadCardProps) {
  return (
    <article className="min-w-0 rounded-xl border border-[var(--border)] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md active:translate-y-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-950">{lead.name}</h3>
          <p className="mt-0.5 truncate text-sm text-[var(--muted)]">{lead.business || "No business added"}</p>
        </div>
        <LeadStatusBadge status={lead.status} />
      </div>
      <a href={getTelephoneHref(lead.phone)} className="mt-4 flex min-h-10 items-center gap-2 rounded-md text-sm text-slate-700 hover:text-blue-700 focus-visible:outline-offset-2" aria-label={`Call ${lead.name} at ${lead.phone}`}><Phone aria-hidden="true" size={16} className="text-slate-400" />{lead.phone}</a>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
        <div><dt className="text-xs font-medium text-slate-500">Next follow-up</dt><dd className="mt-1 text-sm font-medium text-slate-800">{formatDate(lead.nextFollowUpDate)}</dd></div>
        <div><dt className="text-xs font-medium text-slate-500">Quoted amount</dt><dd className="mt-1 text-sm font-medium text-slate-800">{formatCurrency(lead.quotedAmount)}</dd></div>
      </dl>
      <LeadQuickActions lead={lead} whatsAppMessage={whatsAppMessage} onAddNote={() => onSelect(lead, "note")} onAddFollowUp={() => onAddFollowUp(lead)} onChangeStatus={() => onSelect(lead, "status")} className="mt-3 border-y border-slate-100 py-1" />
      <button type="button" onClick={() => onSelect(lead)} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-lg text-sm font-semibold text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 active:bg-blue-100" aria-label={`View ${lead.name}`}>
        View details <ChevronRight aria-hidden="true" size={16} />
      </button>
    </article>
  );
}
