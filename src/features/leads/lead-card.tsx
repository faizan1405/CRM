"use client";

import { memo } from "react";
import { ActionCard } from "@/components/action-card";
import { Phone, MessageCircle, CalendarPlus, Trash2, Star, Clock } from "lucide-react";
import { cleanLeadName, formatCurrency } from "@/features/leads/formatters";
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
import { Avatar } from "@/components/crm/primitives";
import { cn } from "@/lib/utils";

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

export const LeadCard = memo(function LeadCard({
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
  const displayName = cleanLeadName(lead.name);

  return (
    <ActionCard
      onActivate={() => onSelect(lead)}
      aria-label={`Open lead ${lead.name}`}
      className="card-surface card-hover group relative min-w-0 p-3.5 transition-all duration-200 active:scale-[0.98] flex flex-col gap-2"
    >
      {/* ROW 1: Avatar, Name, Business + Status, Pin, Delete */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Avatar name={displayName} className="h-9 w-9 text-[12px] shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="truncate font-semibold text-foreground text-[14.5px] tracking-tight leading-snug">
                {displayName}
              </h3>
              {lead.isPinned && (
                <Star size={13} className="fill-warning text-warning shrink-0" />
              )}
            </div>
            <p className="truncate text-[12px] text-muted-foreground">
              {lead.business || lead.phone || "No business"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 -mt-0.5">
          <LeadStatusBadge status={lead.status} />
          {onTogglePin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(lead);
              }}
              aria-label={lead.isPinned ? `Unpin ${lead.name}` : `Pin ${lead.name}`}
              title={lead.isPinned ? "Unpin lead" : "Pin lead"}
              className="press p-1 rounded-lg text-subtle hover:text-warning hover:bg-warning-soft active:scale-95 transition-all min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
            >
              <Star
                size={16}
                className={lead.isPinned ? "fill-warning text-warning" : "text-subtle hover:text-warning"}
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
              className="press p-1 rounded-lg text-subtle hover:text-destructive hover:bg-danger-soft active:scale-95 transition-all min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ROW 2: Phone, Age, Quoted Value */}
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <div className="flex items-center gap-1.5 text-muted-foreground font-mono">
          <span>{lead.phone}</span>
          <CopyContactButton name={lead.name} phone={lead.phone} />
        </div>
        <div className="flex items-center gap-2">
          {lead.quotedAmount != null && lead.quotedAmount > 0 && (
            <span className="font-semibold tabular text-foreground">
              {formatCurrency(lead.quotedAmount)}
            </span>
          )}
          <span className="text-[10.5px] font-medium text-subtle bg-muted px-1.5 py-0.5 rounded-md tabular">
            Age {formatLeadAge(lead.createdAt)}
          </span>
        </div>
      </div>

      {/* ROW 3: Stale / Follow-up Status */}
      <div className="flex items-center justify-between gap-2 text-[11.5px] border-t border-dashed pt-1.5">
        <div className="flex items-center gap-1.5 text-muted-foreground truncate">
          <span>Last: {formatLastContacted(lead.lastContactDate)}</span>
          {lead.staleInfo?.isStale && (
            <span
              role="status"
              aria-label={lead.staleInfo.staleLabel}
              className="inline-flex items-center gap-1 rounded bg-warning-soft px-1 text-[10px] font-semibold text-warning"
            >
              <Clock size={10} className="shrink-0" />
              <span>{lead.staleInfo.staleLabel}</span>
            </span>
          )}
        </div>
        <span className="font-medium text-primary shrink-0 tabular">
          Next: {formatNextFollowUp(lead.nextFollowUpDate)}
        </span>
      </div>

      {/* ROW 4: Notes Snippet */}
      {notesText && (
        <div className="text-[12px] leading-relaxed text-muted-foreground line-clamp-1 bg-muted/40 rounded-lg px-2 py-1">
          {notesText}
        </div>
      )}

      {/* ROW 5: Bottom Contact Actions */}
      <div className="mt-1 grid grid-cols-3 gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => openCallModal(lead)}
          className="press inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-ink text-ink-foreground text-[12.5px] font-medium hover:opacity-90 transition-opacity"
        >
          <Phone size={13} /> Call
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            openWhatsApp(lead);
          }}
          className="press inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-whatsapp text-whatsapp-foreground text-[12.5px] font-medium hover:opacity-90 transition-opacity"
        >
          <MessageCircle size={13} /> WhatsApp
        </button>
        <button
          type="button"
          onClick={() => onAddFollowUp(lead)}
          className="press inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-muted text-foreground text-[12.5px] font-medium hover:bg-muted/80 transition-colors shadow-sm"
        >
          <CalendarPlus size={13} /> Follow-up
        </button>
      </div>
    </ActionCard>
  );
});
