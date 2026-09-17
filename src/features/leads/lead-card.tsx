"use client";

import { ActionCard } from "@/components/action-card";
import { Phone, MessageCircle, CalendarPlus, Trash2, FileText, Check } from "lucide-react";
import { formatCurrency } from "@/features/leads/formatters";
import { getTelephoneHref } from "@/features/leads/contact-links";
import { useWhatsApp } from "@/components/whatsapp-context";
import { getLeadCardTheme } from "@/features/leads/lead-card-theme";
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
  onUpdateQuickStatus?: (lead: Lead, statusKey: QuickStatusType | "WON" | "LOST") => void;
  whatsAppMessage?: string;
  aiAttention?: AIAttentionLeadData;
};

export function LeadCard({
  lead,
  onSelect,
  onAddFollowUp,
  onDelete,
  onUpdateQuickStatus,
  whatsAppMessage,
  aiAttention,
}: LeadCardProps) {
  const { openWhatsApp } = useWhatsApp();
  const { openCallModal } = useCall();
  const ai = aiAttention || lead.aiAttention || deriveAIAttention(lead);
  const isTerminal = lead.status === "Won" || lead.status === "Lost";
  const theme = getLeadCardTheme(lead);

  const notesText = lead.latestNote || lead.notes || "";

  return (
    <ActionCard
      onActivate={() => onSelect(lead)}
      aria-label={`Open lead ${lead.name}`}
      className={`group relative min-w-0 rounded-2xl border ${theme.cardBg} ${theme.borderBase} ${theme.leftBorder} ${theme.hoverBorder} p-3 sm:p-4 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)] active:scale-[0.98] flex flex-col gap-2`}
    >
      {/* 1. TOP: Name + Status & Age */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 flex flex-col">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="truncate font-bold text-slate-950 text-[15px] sm:text-base tracking-tight leading-none">{lead.name}</h3>
            <span className={`inline-flex shrink-0 items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600`}>
              {lead.status}
            </span>
            {!isTerminal && ai.score >= 80 && (
              <AIScoreBadge score={ai.score} category={ai.scoreCategory} size="sm" showLabel={false} />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs font-medium text-slate-600">{lead.phone}</span>
            <CopyContactButton name={lead.name} phone={lead.phone} />
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
            Age {formatLeadAge(lead.createdAt)}
          </span>
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(lead);
              }}
              aria-label={`Delete ${lead.name}`}
              className="text-slate-300 hover:text-rose-600 transition-colors cursor-pointer mt-1"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 2. NOTES PREVIEW: Upfront, 1-2 lines clamped context */}
      <div className="text-[11px] sm:text-xs leading-snug text-slate-600 line-clamp-2">
        {notesText ? notesText : <span className="italic text-slate-400">No notes.</span>}
      </div>

      {/* 3. Last Contacted & Next Follow-up */}
      <div className="flex flex-col gap-0.5 text-[10px] sm:text-[11px]">
        <div className="flex justify-between items-center text-slate-500">
          <span>Last: <span className="font-medium text-slate-700">{formatLastContacted(lead.lastContactDate)}</span></span>
          <span>Next: <span className="font-semibold text-blue-700">{formatNextFollowUp(lead.nextFollowUpDate)}</span></span>
        </div>
      </div>

      {/* 4. BOTTOM ACTIONS */}
      <div className="mt-1 flex items-center justify-between gap-1 sm:gap-2 pt-2 border-t border-slate-100/80" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => openCallModal(lead)}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-semibold hover:bg-blue-100 transition-colors"
        >
          <Phone size={12} /> Call
        </button>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); openWhatsApp(lead); }}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100 transition-colors"
        >
          <MessageCircle size={12} /> WhatsApp
        </button>
        <button
          type="button"
          onClick={() => onAddFollowUp(lead)}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white text-slate-700 text-[11px] font-semibold hover:bg-slate-50 transition-colors"
        >
          <CalendarPlus size={12} /> Follow-up
        </button>
      </div>
    </ActionCard>
  );
}
