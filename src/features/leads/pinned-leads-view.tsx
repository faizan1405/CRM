"use client";

import { Phone, MessageCircle, CalendarPlus, Star, Clock, IndianRupee, Activity, FileText } from "lucide-react";
import { formatCurrency } from "@/features/leads/formatters";
import { formatNextFollowUp, formatLastContacted } from "@/lib/date-utils";
import { LeadStatusBadge } from "@/features/leads/lead-status-badge";
import { useWhatsApp } from "@/components/whatsapp-context";
import { useCall } from "@/components/call-context";
import { CopyContactButton } from "@/components/copy-contact-button";
import type { Lead } from "@/features/leads/types";

type PinnedLeadsViewProps = {
  leads: Lead[];
  onSelect: (lead: Lead) => void;
  onTogglePin: (lead: Lead) => void;
  onAddFollowUp: (lead: Lead) => void;
};

export function PinnedLeadsView({
  leads,
  onSelect,
  onTogglePin,
  onAddFollowUp,
}: PinnedLeadsViewProps) {
  const { openWhatsApp } = useWhatsApp();
  const { openCallModal } = useCall();

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-500">
          <Star className="size-6 fill-amber-400 text-amber-500" />
        </div>
        <h3 className="mt-3 text-base font-bold text-slate-900">No pinned leads yet</h3>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Star important leads from Leads, Pipeline, Follow-ups, or Lead Detail to maintain your focused shortlist.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {leads.length} {leads.length === 1 ? "Prospect Shortlisted" : "Prospects Shortlisted"}
        </p>
        <span className="text-xs text-amber-600 font-medium">★ Priority Focus</span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {leads.map((lead) => {
          const notesText = lead.latestNote || lead.notes || "";
          const dealAmount = lead.dealValue ?? lead.quotedAmount ?? null;
          const lastActivityText = lead.lastActivity?.message || (lead.lastContactDate ? `Contacted: ${formatLastContacted(lead.lastContactDate)}` : "Lead created");

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
              className="group relative flex flex-col justify-between rounded-xl border border-amber-200/80 bg-gradient-to-b from-amber-50/20 to-white p-3.5 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {/* Header: Name, Phone, Status & Unpin Action */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="truncate text-[15px] font-bold text-slate-900 tracking-tight">
                        {lead.name}
                      </h3>
                      <LeadStatusBadge status={lead.status} />
                      {lead.staleInfo?.isStale && (
                        <span
                          role="status"
                          aria-label={lead.staleInfo.staleLabel}
                          title={lead.staleInfo.staleLabel}
                          className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                        >
                          <Clock size={10} className="text-amber-600 shrink-0" />
                          <span>{lead.staleInfo.staleLabel}</span>
                        </span>
                      )}
                    </div>
                    {lead.business && (
                      <p className="truncate text-xs text-slate-500 mt-0.5">{lead.business}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(lead);
                    }}
                    className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center gap-1 rounded-lg border border-amber-200 bg-amber-50/80 px-2 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 hover:text-amber-900 active:scale-95 shrink-0"
                    title="Unpin lead"
                    aria-label={`Unpin ${lead.name}`}
                  >
                    <Star className="size-3.5 fill-amber-400 text-amber-500" />
                    <span className="hidden sm:inline text-[11px]">Unpin</span>
                  </button>
                </div>

                {/* Phone & Deal Value */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100/90 pt-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Phone className="size-3.5 text-slate-400" />
                    <span>{lead.phone}</span>
                    <CopyContactButton name={lead.name} phone={lead.phone} />
                  </div>

                  {dealAmount !== null && (
                    <div className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 text-[11px]">
                      <span>Deal: {formatCurrency(dealAmount)}</span>
                    </div>
                  )}
                </div>

                {/* Latest Meaningful Note */}
                <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                    <FileText className="size-3 text-slate-400" />
                    <span>Latest Note</span>
                  </div>
                  <p className="line-clamp-2 leading-relaxed">
                    {notesText ? notesText : <span className="italic text-slate-400">No notes recorded</span>}
                  </p>
                </div>

                {/* Timings: Next follow-up & Last activity */}
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                  <div className="flex flex-col">
                    <span className="flex items-center gap-1 font-medium text-slate-400 text-[10px] uppercase">
                      <Clock className="size-3" /> Next Follow-up
                    </span>
                    <span className="font-semibold text-blue-700 mt-0.5">
                      {formatNextFollowUp(lead.nextFollowUpDate)}
                    </span>
                  </div>

                  <div className="flex flex-col text-right">
                    <span className="flex items-center justify-end gap-1 font-medium text-slate-400 text-[10px] uppercase">
                      <Activity className="size-3" /> Last Activity
                    </span>
                    <span className="truncate text-slate-700 font-medium mt-0.5" title={lastActivityText}>
                      {lastActivityText}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions: Call, WhatsApp, Follow-up */}
              <div
                className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2.5"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => openCallModal(lead)}
                  className="flex-1 inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 active:bg-blue-200 transition-colors"
                  aria-label={`Call ${lead.name}`}
                >
                  <Phone size={14} /> Call
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    openWhatsApp(lead);
                  }}
                  className="flex-1 inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-[#25d366]/10 text-[#20bd5a] text-xs font-semibold hover:bg-[#25d366]/20 active:bg-[#25d366]/30 transition-colors"
                  aria-label={`Message ${lead.name} on WhatsApp`}
                >
                  <MessageCircle size={14} /> WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => onAddFollowUp(lead)}
                  className="flex-1 inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-sm"
                  aria-label={`Schedule follow-up for ${lead.name}`}
                >
                  <CalendarPlus size={14} /> Follow-up
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
