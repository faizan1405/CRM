"use client";

import { ActionCard } from "@/components/action-card";
import { Phone, MessageCircle, CalendarPlus, Trash2, FileText, Check, Star, Clock } from "lucide-react";
import { formatCurrency } from "@/features/leads/formatters";
import { getTelephoneHref } from "@/features/leads/contact-links";
import { useWhatsApp } from "@/components/whatsapp-context";
import { getCanonicalLeadTheme } from "@/features/leads/lead-card-theme";
import { LeadStatusBadge } from "@/features/leads/lead-status-badge";
import type { Lead, QuickStatusType } from "@/features/leads/types";
import {
  AIScoreBadge,
  deriveAIAttention,
  type AIAttentionLeadData,
} from "@/features/ai-attention";
import { formatLeadAge, formatLastContacted, formatNextFollowUp } from "@/lib/date-utils";
import { CopyContactButton } from "@/components/copy-contact-button";
import { useCall } from "@/components/call-context";

type LeadCardProps = {
  lead: Lead;
  onSelect: (lead: Lead, action?: "note" | "status") => void;
  onAddFollowUp: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
  onTogglePin?: (lead: Lead) => void;
  onUpdateQuickStatus?: (lead: Lead, statusKey: QuickStatusType | "WON" | "LOST") => void;
  whatsAppMessage?: string;
  aiAttention?: AIAttentionLeadData;
};

export function LeadCard({
  lead,
  onSelect,
  onAddFollowUp,
  onDelete,
  onTogglePin,
  onUpdateQuickStatus,
  whatsAppMessage,
  aiAttention,
}: LeadCardProps) {
  const { openWhatsApp } = useWhatsApp();
  const { openCallModal } = useCall();
  const ai = aiAttention || lead.aiAttention || deriveAIAttention(lead);
  const isTerminal = lead.status === "Won" || lead.status === "Lost";
  const theme = getCanonicalLeadTheme(lead.status);

  const notesText = lead.latestNote || lead.notes || "";

  return (
    <ActionCard
      onActivate={() => onSelect(lead)}
      aria-label={`Open lead ${lead.name}`}
      className={`group relative min-w-0 rounded-2xl border ${theme.cardBg} ${theme.cardHoverBg} ${theme.borderBase} ${theme.leftBorder} ${theme.hoverBorder} p-3 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)] active:scale-[0.98] flex flex-col gap-1.5`}
    >
      {/* ROW 1: Name + Status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <h3 className="truncate font-bold text-slate-950 text-[16px] tracking-tight leading-none">{lead.name}</h3>
          <LeadStatusBadge status={lead.status} />
          {lead.staleInfo?.isStale && (
            <span
              role="status"
              aria-label={lead.staleInfo.staleLabel}
              title={lead.staleInfo.staleLabel}
              className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
            >
              <Clock size={11} className="text-amber-600 shrink-0" aria-hidden="true" />
              <span>{lead.staleInfo.staleLabel}</span>
            </span>
          )}
          {!isTerminal && ai.score >= 80 && (
            <AIScoreBadge score={ai.score} category={ai.scoreCategory} size="sm" showLabel={false} />
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 -mt-1 -mr-1">
          {onTogglePin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(lead);
              }}
              aria-label={lead.isPinned ? `Unpin ${lead.name}` : `Pin ${lead.name}`}
              title={lead.isPinned ? "Unpin lead" : "Pin lead"}
              className="p-1 rounded-md text-slate-300 hover:text-amber-500 hover:bg-amber-50 active:scale-95 transition-all min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
            >
              <Star
                size={17}
                className={lead.isPinned ? "fill-amber-400 text-amber-500" : "text-slate-300 hover:text-amber-500"}
              />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(lead);
              }}
              aria-label={`Delete ${lead.name}`}
              className="text-slate-300 hover:text-rose-600 transition-colors p-1 rounded-md active:bg-slate-100 min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ROW 2: Phone + Age */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium text-slate-600">{lead.phone}</span>
          <CopyContactButton name={lead.name} phone={lead.phone} />
        </div>
        <span className="text-[10px] font-bold text-slate-400 bg-slate-100/80 px-1.5 py-0.5 rounded-md">
          Age {formatLeadAge(lead.createdAt)}
        </span>
      </div>

      {/* ROW 3: Notes Preview */}
      <div className="text-[12px] leading-snug text-slate-600 line-clamp-1 bg-white/50 rounded p-1 -mx-1 mt-0.5">
        {notesText ? notesText : <span className="italic text-slate-400">No notes.</span>}
      </div>

      {/* ROW 4: Last Contacted & Next Follow-up */}
      <div className="flex flex-col gap-0.5 text-[11px] mt-0.5">
        <div className="flex justify-between items-center text-slate-500 font-medium">
          <span>Last: <span className="text-slate-700">{formatLastContacted(lead.lastContactDate)}</span></span>
          <span>Next: <span className="text-blue-700 font-bold">{formatNextFollowUp(lead.nextFollowUpDate)}</span></span>
        </div>
      </div>

      {/* ROW 5: BOTTOM ACTIONS */}
      <div className="mt-1.5 flex items-center justify-between gap-1.5 pt-2 border-t border-slate-200/60" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => openCallModal(lead)}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-50 text-blue-700 text-[13px] font-bold hover:bg-blue-100 active:bg-blue-200 transition-colors"
        >
          <Phone size={14} /> Call
        </button>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); openWhatsApp(lead); }}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#25d366]/10 text-[#20bd5a] text-[13px] font-bold hover:bg-[#25d366]/20 active:bg-[#25d366]/30 transition-colors"
        >
          <MessageCircle size={14} /> WhatsApp
        </button>
        <button
          type="button"
          onClick={() => onAddFollowUp(lead)}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-[13px] font-bold hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-sm"
        >
          <CalendarPlus size={14} /> <span className="hidden sm:inline">Follow-up</span><span className="sm:hidden">Date</span>
        </button>
      </div>
    </ActionCard>
  );
}
