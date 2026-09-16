import type { ReactNode } from "react";
import { ActionCard } from "@/components/action-card";
import { Building2, Phone } from "lucide-react";
import { formatCurrency, formatDate } from "@/features/leads/formatters";
import type { Lead } from "@/features/leads/types";
import { AIScoreBadge, deriveAIAttention } from "@/features/ai-attention";

export function PipelineCard({
  lead,
  onClick,
  dragHandle,
}: {
  lead: Lead;
  onClick: () => void;
  dragHandle?: ReactNode;
}) {
  const ai = lead.aiAttention || deriveAIAttention(lead);

  return (
    <ActionCard
      onActivate={onClick}
      aria-label={`Open lead ${lead.name}`}
      className="group flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] active:shadow-sm transition-[transform,box-shadow,border-color] duration-200 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
    >
      <div className="flex justify-between items-start gap-2">
        <h4 className="font-semibold text-slate-900 text-sm break-words line-clamp-2">
          {lead.name}
        </h4>
        <div className="flex shrink-0 items-center gap-1">
          <AIScoreBadge score={ai.score} category={ai.scoreCategory} size="sm" showLabel={false} />
          {dragHandle}
        </div>
      </div>

      {(lead.business || lead.phone) && (
        <div className="flex flex-col gap-1 text-xs text-slate-600 mt-0.5">
          {lead.business && (
            <div className="flex items-start gap-1.5">
              <Building2 size={12} className="text-slate-400 shrink-0 mt-0.5" />
              <span className="break-words line-clamp-1">{lead.business}</span>
            </div>
          )}
          {lead.phone && (
            <div className="flex items-start gap-1.5">
              <Phone size={12} className="text-slate-400 shrink-0 mt-0.5" />
              <span className="break-all">{lead.phone}</span>
            </div>
          )}
        </div>
      )}

      {(lead.quotedAmount !== null || lead.nextFollowUpDate) && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-slate-100 pt-2 text-[11px]">
          {lead.quotedAmount !== null && (
            <div className="flex flex-col">
              <span className="text-slate-400 leading-tight">Quoted</span>
              <span className="font-medium text-slate-700 leading-tight">
                {formatCurrency(lead.quotedAmount)}
              </span>
            </div>
          )}
          {lead.nextFollowUpDate && (
            <div className="flex flex-col">
              <span className="text-slate-400 leading-tight">Follow-up</span>
              <span className="font-medium text-slate-700 leading-tight">
                {formatDate(lead.nextFollowUpDate)}
              </span>
            </div>
          )}
        </div>
      )}
    </ActionCard>
  );
}
