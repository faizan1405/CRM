import { ChevronRight, MessageCircle, Phone } from "lucide-react";
import { getTelephoneHref, getWhatsAppHref } from "@/features/leads/contact-links";
import { formatCurrency, formatDate } from "@/features/leads/formatters";
import { LeadStatusBadge } from "@/features/leads/lead-status-badge";
import type { Lead } from "@/features/leads/types";

export function LeadTable({ leads, onSelect }: { leads: Lead[]; onSelect: (lead: Lead) => void }) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full min-w-[860px] border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-5 py-3.5">Name / Business</th>
            <th className="px-4 py-3.5">Phone</th>
            <th className="px-4 py-3.5">Budget</th>
            <th className="px-4 py-3.5">Status</th>
            <th className="px-4 py-3.5">Next follow-up</th>
            <th className="px-4 py-3.5">Quoted amount</th>
            <th className="px-5 py-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {leads.map((lead) => (
            <tr key={lead.id} className="bg-white transition-colors hover:bg-slate-50/70">
              <td className="px-5 py-4">
                <p className="font-semibold text-slate-900">{lead.name}</p>
                <p className="mt-0.5 text-sm text-[var(--muted)]">{lead.business || "No business added"}</p>
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">{lead.phone}</td>
              <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-700">{formatCurrency(lead.budget)}</td>
              <td className="px-4 py-4"><LeadStatusBadge status={lead.status} /></td>
              <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">{formatDate(lead.nextFollowUpDate)}</td>
              <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-slate-700">{formatCurrency(lead.quotedAmount)}</td>
              <td className="px-5 py-4 text-right">
                <div className="inline-flex items-center gap-1"><a href={getTelephoneHref(lead.phone)} className="grid size-10 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-700" aria-label={`Call ${lead.name}`}><Phone aria-hidden="true" size={17} /></a><a href={getWhatsAppHref(lead.phone, lead.name)} target="_blank" rel="noopener noreferrer" className="grid size-10 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700" aria-label={`Message ${lead.name} on WhatsApp`}><MessageCircle aria-hidden="true" size={17} /></a><button type="button" onClick={() => onSelect(lead)} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50" aria-label={`View ${lead.name}`}>
                  View <ChevronRight aria-hidden="true" size={16} />
                </button></div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
