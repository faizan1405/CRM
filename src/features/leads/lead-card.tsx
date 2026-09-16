"use client";

import { ActionCard } from "@/components/action-card";
import { Phone, MessageCircle, CalendarPlus, Trash2, FileText } from "lucide-react";
import { formatCurrency, formatDate } from "@/features/leads/formatters";
import { getTelephoneHref, getWhatsAppHref } from "@/features/leads/contact-links";
import { QuickStatusChip } from "@/features/leads/quick-status-chip";
import { getLeadCardTheme } from "@/features/leads/lead-card-theme";
import type { Lead, QuickStatusType } from "@/features/leads/types";
import {
  AIScoreBadge,
  deriveAIAttention,
  type AIAttentionLeadData,
} from "@/features/ai-attention";

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
  const ai = aiAttention || lead.aiAttention || deriveAIAttention(lead);
  const isTerminal = lead.status === "Won" || lead.status === "Lost";
  const theme = getLeadCardTheme(lead);

  const notesText = lead.latestNote || lead.notes || "";

  return (
    <ActionCard
      onActivate={() => onSelect(lead)}
      aria-label={`Open lead ${lead.name}`}
      className={`group relative min-w-0 rounded-2xl border ${theme.cardBg} ${theme.borderBase} ${theme.leftBorder} ${theme.hoverBorder} p-4 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)] active:scale-[0.98]`}
    >
      {/* 1. TOP: Lead Name + Business + Quick Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-slate-950 text-base tracking-tight">{lead.name}</h3>
            {!isTerminal && ai.score >= 80 && (
              <AIScoreBadge score={ai.score} category={ai.scoreCategory} size="sm" showLabel={false} />
            )}
          </div>
          {lead.business && (
            <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
              {lead.business}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {(theme.state === "FOLLOW_UP_NOW" || theme.state === "FUTURE_FOLLOW_UP" || theme.state === "WASTE") && (
            <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold ${theme.badgeClass}`}>
              {theme.badgeLabel}
            </span>
          )}
          <QuickStatusChip
            quickStatus={lead.quickStatus}
            leadStatus={lead.status}
            onSelectStatus={onUpdateQuickStatus ? (statusKey) => onUpdateQuickStatus(lead, statusKey) : undefined}
            size="sm"
          />
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(lead);
              }}
              aria-label={`Delete ${lead.name}`}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* 2. PHONE: Direct clickable one-tap phone link */}
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100/80 pt-2.5" onClick={(e) => e.stopPropagation()}>
        <a
          href={getTelephoneHref(lead.phone)}
          className="inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors"
          aria-label={`Call ${lead.name} at ${lead.phone}`}
        >
          <Phone aria-hidden="true" size={13} className="text-blue-500" />
          <span>{lead.phone}</span>
        </a>

        {lead.quotedAmount !== null && (
          <span className="text-xs font-bold text-slate-900">
            {formatCurrency(lead.quotedAmount)}
          </span>
        )}
      </div>

      {/* 3. NOTES PREVIEW: Upfront, 2-4 lines clamped context */}
      <div className="mt-2 rounded-xl bg-slate-50/80 p-2.5 border border-slate-100">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <FileText size={11} className="text-slate-400" />
          <span>Notes</span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-700 line-clamp-3 break-words">
          {notesText ? notesText : <span className="italic text-slate-400">No interaction notes yet.</span>}
        </p>
      </div>

      {/* Next Follow-up info if present */}
      {lead.nextFollowUpDate && (
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 px-0.5">
          <span>Next follow-up:</span>
          <span className="font-semibold text-slate-700">{formatDate(lead.nextFollowUpDate)}</span>
        </div>
      )}

      {/* 4. BOTTOM ACTIONS: Call | WhatsApp | Add Follow-up */}
      <div className="mt-3.5 flex items-center gap-2 border-t border-slate-100 pt-3" onClick={(e) => e.stopPropagation()}>
        {/* Call Button */}
        <a
          href={getTelephoneHref(lead.phone)}
          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-150 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.97]"
          aria-label={`Call ${lead.name}`}
        >
          <Phone size={13} className="text-blue-600" />
          <span>Call</span>
        </a>

        {/* WhatsApp Button */}
        <a
          href={getWhatsAppHref(lead.phone, whatsAppMessage || `Hi ${lead.name}, connecting from Scale Flow CRM.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 shadow-sm transition-all duration-150 hover:bg-emerald-100/80 active:scale-[0.97]"
          aria-label={`WhatsApp ${lead.name}`}
        >
          <MessageCircle size={13} className="text-emerald-600" />
          <span>WhatsApp</span>
        </a>

        {/* Add Follow-up Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAddFollowUp(lead);
          }}
          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-blue-800 shadow-sm transition-all duration-150 hover:bg-blue-100/80 active:scale-[0.97] cursor-pointer"
          aria-label={`Add follow-up for ${lead.name}`}
        >
          <CalendarPlus size={13} className="text-blue-600" />
          <span>Follow-up</span>
        </button>
      </div>
    </ActionCard>
  );
}
