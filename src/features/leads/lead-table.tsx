import { ChevronRight, MessageCircle, Phone, Trash2 } from "lucide-react";
import { getTelephoneHref, getWhatsAppHref } from "@/features/leads/contact-links";
import { formatCurrency, formatDate } from "@/features/leads/formatters";
import { StatusSelector } from "@/features/leads/status-selector";
import type { Lead } from "@/features/leads/types";
import { AIScoreBadge, deriveAIAttention } from "@/features/ai-attention";

export function LeadTable({ leads, onSelect, onDelete }: { leads: Lead[]; onSelect: (lead: Lead) => void; onDelete: (lead: Lead) => void }) {
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
            return (
              <tr key={lead.id} tabIndex={0} aria-label={`Open lead ${lead.name}`} onClick={event => { if (!(event.target as HTMLElement).closest("a,button")) onSelect(lead); }} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect(lead); } }} className="cursor-pointer bg-white transition-colors hover:bg-slate-50/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
                <td className="px-5 py-4">
                  <p className="font-semibold text-slate-900">{lead.name}</p>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">{lead.business || "No business added"}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <div className="flex items-center gap-1.5">
                    <AIScoreBadge score={ai.score} category={ai.scoreCategory} size="sm" />
                    {!isTerminal && ai.priority === "critical" && (
                      <span className="flex size-2 rounded-full bg-rose-500" title="Critical Attention" />
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">{lead.phone}</td>
                <td className="px-4 py-4"><StatusSelector status={lead.status} readOnly /></td>
                <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">{formatDate(lead.nextFollowUpDate)}</td>
                <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-700">{formatCurrency(lead.quotedAmount)}</td>
                <td className="px-5 py-4 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button type="button" onClick={() => onDelete(lead)} aria-label={`Delete ${lead.name}`} className="grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-600"><Trash2 size={17} /></button>
                    <a href={getTelephoneHref(lead.phone)} className="grid size-10 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-700" aria-label={`Call ${lead.name}`}><Phone aria-hidden="true" size={17} /></a>
                    <a href={getWhatsAppHref(lead.phone, lead.name)} target="_blank" rel="noopener noreferrer" className="grid size-10 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700" aria-label={`Message ${lead.name} on WhatsApp`}><MessageCircle aria-hidden="true" size={17} /></a>
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
