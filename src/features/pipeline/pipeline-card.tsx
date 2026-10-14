import { memo } from "react";
import { ActionCard } from "@/components/action-card";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { GripVertical, Star, CalendarClock } from "lucide-react";
import type { Lead } from "@/features/leads/types";
import { AIScoreBadge, deriveAIAttention } from "@/features/ai-attention";
import { formatNextFollowUp } from "@/lib/date-utils";
import { formatCurrency, cleanLeadName } from "@/features/leads/formatters";
import { cn } from "@/lib/utils";

export const PipelineCard = memo(function PipelineCard({
  lead,
  onClick,
  onTogglePin,
  dragHandleProps,
}: {
  lead: Lead;
  onClick: () => void;
  onTogglePin?: (lead: Lead) => void;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
}) {
  const ai = lead.aiAttention || deriveAIAttention(lead);
  const displayName = cleanLeadName(lead.name);
  const amount = lead.quotedAmount ?? lead.budget ?? 0;

  return (
    <ActionCard
      onActivate={onClick}
      aria-label={`Open lead ${lead.name}`}
      className="card-surface card-hover group relative flex flex-col gap-2 p-3 text-left transition-all duration-200 active:scale-[0.98] cursor-pointer"
    >
      <div className="flex items-start justify-between gap-1.5">
        <div
          {...dragHandleProps}
          className="shrink-0 text-subtle hover:text-foreground cursor-grab active:cursor-grabbing -ml-1 mt-0.5 p-0.5 touch-none"
          title="Drag lead"
        >
          <GripVertical size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className="font-medium text-foreground text-[13.5px] truncate leading-tight">
              {displayName}
            </h4>
            {lead.isPinned && (
              <Star size={12} className="fill-warning text-warning shrink-0" />
            )}
            <AIScoreBadge score={ai.score} category={ai.scoreCategory} size="sm" showLabel={false} />
          </div>
          <p className="text-[12px] text-muted-foreground truncate mt-0.5">
            {lead.business || lead.phone}
          </p>
        </div>

        {onTogglePin && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(lead);
            }}
            aria-label={lead.isPinned ? `Unpin ${lead.name}` : `Pin ${lead.name}`}
            title={lead.isPinned ? "Unpin lead" : "Pin lead"}
            className="press p-1 rounded-md text-subtle hover:text-warning shrink-0 cursor-pointer"
          >
            <Star
              size={14}
              className={lead.isPinned ? "fill-warning text-warning" : "text-subtle hover:text-warning"}
            />
          </button>
        )}
      </div>

      <div className="flex items-baseline gap-1.5 pt-0.5">
        <span className="text-[14.5px] font-semibold tabular text-foreground">
          {amount > 0 ? formatCurrency(amount) : "—"}
        </span>
        <span className="text-[11px] text-subtle">
          {lead.quotedAmount ? "quoted" : lead.budget ? "budget" : ""}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-dashed pt-2 text-[11.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 tabular truncate">
          <CalendarClock className="h-3 w-3 shrink-0 text-subtle" />
          <span>{lead.nextFollowUpDate ? formatNextFollowUp(lead.nextFollowUpDate) : "No follow-up"}</span>
        </span>
        {lead.status && (
          <span className="text-[10.5px] font-medium text-subtle shrink-0">
            {lead.status}
          </span>
        )}
      </div>
    </ActionCard>
  );
});
