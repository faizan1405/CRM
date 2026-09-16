import { ActionCard } from "@/components/action-card";
import { ChevronRight, Phone, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/features/leads/formatters";
import { getTelephoneHref } from "@/features/leads/contact-links";
import { LeadQuickActions } from "@/features/leads/lead-quick-actions";
import { LeadStatusBadge } from "@/features/leads/lead-status-badge";
import type { Lead } from "@/features/leads/types";
import {
  AIScoreBadge,
  AttentionPriorityBadge,
  StaleIndicator,
  StageAgingBadge,
  AIRecommendedAction,
  deriveAIAttention,
  type AIAttentionLeadData,
} from "@/features/ai-attention";

type LeadCardProps = {
  lead: Lead;
  onSelect: (lead: Lead, action?: "note" | "status") => void;
  onAddFollowUp: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
  whatsAppMessage?: string;
  aiAttention?: AIAttentionLeadData;
};

export function LeadCard({
  lead,
  onSelect,
  onAddFollowUp,
  onDelete,
  whatsAppMessage,
  aiAttention,
}: LeadCardProps) {
  const ai = aiAttention || lead.aiAttention || deriveAIAttention(lead);
  const isTerminal = lead.status === "Won" || lead.status === "Lost";
  const isCritical = !isTerminal && (ai.priority === "critical" || ai.score >= 85);

  return (
    <ActionCard onActivate={() => onSelect(lead)} aria-label={`Open lead ${lead.name}`} className={`min-w-0 rounded-xl border bg-white p-4 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-elevated)] active:scale-[0.97] ${isCritical ? "border-l-2 border-l-rose-400 hover:border-rose-300" : "border-[var(--border)] hover:border-blue-300"}`}>
      {/* Top Header: Title & Badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-slate-950">{lead.name}</h3>
          <p className="mt-0.5 truncate text-sm text-[var(--muted)]">
            {lead.business || "No business added"}
          </p>
        </div>

        {onDelete && <button type="button" onClick={() => onDelete(lead)} aria-label={`Delete ${lead.name}`} className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-600"><Trash2 size={18} /></button>}
        {/* Status and Score */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <LeadStatusBadge status={lead.status} />
          {!isTerminal && (
            <div className="flex items-center gap-1">
              <AIScoreBadge score={ai.score} category={ai.scoreCategory} size="sm" />
              <AttentionPriorityBadge priority={ai.priority} size="sm" showIcon={false} />
            </div>
          )}
        </div>
      </div>

      {/* AI Attention Meta: Stage Aging & Stale Indicator */}
      {!isTerminal && (
        <>
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100/80 pt-2 text-xs">
            <StageAgingBadge stageAging={ai.stageAging} variant="pill" />
            <StaleIndicator staleStatus={ai.staleStatus} variant="compact" />
          </div>

          {/* AI Recommended Next Action */}
          <div className="mt-2.5">
            <AIRecommendedAction action={ai.recommendedAction} variant="compact" />
          </div>
        </>
      )}

      {/* Phone Link */}
      <a
        href={getTelephoneHref(lead.phone)}
        className="mt-3 flex min-h-10 items-center gap-2 break-all rounded-md text-sm text-slate-700 hover:text-blue-700 focus-visible:outline-offset-2"
        aria-label={`Call ${lead.name} at ${lead.phone}`}
      >
        <Phone aria-hidden="true" size={16} className="text-slate-400" />
        {lead.phone}
      </a>

      {/* Quick Info Grid */}
      <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
        <div>
          <dt className="text-xs font-medium text-slate-500">Next follow-up</dt>
          <dd className="mt-0.5 break-all text-sm font-medium text-slate-800">
            {formatDate(lead.nextFollowUpDate)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Quoted amount</dt>
          <dd className="mt-0.5 break-all text-sm font-medium text-slate-800">
            {formatCurrency(lead.quotedAmount)}
          </dd>
        </div>
      </dl>

      {/* Existing Quick Actions */}
      <LeadQuickActions
        lead={lead}
        whatsAppMessage={whatsAppMessage}
        onAddNote={() => onSelect(lead, "note")}
        onAddFollowUp={() => onAddFollowUp(lead)}
        onChangeStatus={() => onSelect(lead, "status")}
        className="mt-3 border-y border-slate-100 py-1 transition-opacity duration-200 opacity-80 group-hover:opacity-100"
      />

      {/* View Details */}
      <button
        type="button"
        onClick={() => onSelect(lead)}
        className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-lg text-sm font-semibold text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 active:bg-blue-100 cursor-pointer"
        aria-label={`View ${lead.name}`}
      >
        View details <ChevronRight aria-hidden="true" size={16} />
      </button>
    </ActionCard>
  );
}
