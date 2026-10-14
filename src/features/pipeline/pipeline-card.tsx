import { memo } from "react";
import { ActionCard } from "@/components/action-card";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { GripVertical, Star, CalendarClock } from "lucide-react";
import type { Lead } from "@/features/leads/types";
import { AIScoreBadge, deriveAIAttention } from "@/features/ai-attention";
import { formatNextFollowUp } from "@/lib/date-utils";
import { formatCurrency, cleanLeadName } from "@/features/leads/formatters";
import { cn } from "@/lib/utils";

const quickStatusBadgeConfig: Record<string, { label: string; className: string }> = {
  INTERESTED: {
    label: "Interested",
    className: "text-emerald-700 bg-emerald-50/70 border-emerald-200/80 ring-1 ring-inset ring-emerald-500/20",
  },
  CONTACTED: {
    label: "Contacted",
    className: "text-muted-foreground bg-muted/60 border-border/80 ring-1 ring-inset ring-border",
  },
  CALL_BACK: {
    label: "Call back",
    className: "text-amber-800 bg-amber-50/70 border-amber-200/80 ring-1 ring-inset ring-amber-500/20",
  },
  NOT_PICKED: {
    label: "Call not picked",
    className: "text-rose-700 bg-rose-50/70 border-rose-200/80 ring-1 ring-inset ring-rose-500/20",
  },
};

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

  const followUpRaw = lead.nextFollowUpDate ? formatNextFollowUp(lead.nextFollowUpDate) : "No follow-up";
  const isOverdue = followUpRaw.startsWith("Overdue");
  const isToday = followUpRaw.startsWith("Today");

  const quickBadge = lead.quickStatus && lead.quickStatus !== "NONE"
    ? quickStatusBadgeConfig[lead.quickStatus]
    : null;

  return (
    <ActionCard
      onActivate={onClick}
      aria-label={`Open lead ${lead.name}`}
      className="card-surface card-hover press group relative flex flex-col gap-2.5 p-3.5 text-left rounded-xl bg-card border border-border/80 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-lift)] hover:border-border transition-all duration-200 active:scale-[0.99] cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div
          {...dragHandleProps}
          className="shrink-0 text-muted-foreground/40 hover:text-foreground cursor-grab active:cursor-grabbing -ml-1 mt-0.5 p-0.5 touch-none transition-colors"
          title="Drag lead"
        >
          <GripVertical size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="font-medium text-foreground text-[13.5px] truncate leading-snug">
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
            className="press p-1 rounded-md text-subtle hover:text-warning shrink-0 cursor-pointer transition-colors"
          >
            <Star
              size={14}
              className={lead.isPinned ? "fill-warning text-warning" : "text-subtle hover:text-warning"}
            />
          </button>
        )}
      </div>

      <div className="flex items-baseline gap-1.5 pt-0.5">
        <span className="text-[15px] font-semibold tabular text-foreground">
          {amount > 0 ? formatCurrency(amount) : "—"}
        </span>
        <span className="text-[11px] text-subtle">
          {lead.quotedAmount ? "quoted" : lead.budget ? "budget" : ""}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-dashed border-border/80 pt-2.5 text-[11.5px]">
        <span
          className={cn(
            "inline-flex items-center gap-1 tabular truncate",
            isOverdue
              ? "font-medium text-destructive"
              : isToday
              ? "font-medium text-warning"
              : lead.nextFollowUpDate
              ? "text-muted-foreground"
              : "text-subtle"
          )}
        >
          <CalendarClock className="h-3 w-3 shrink-0" />
          <span>{followUpRaw}</span>
        </span>

        {quickBadge ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md font-medium px-1.5 py-0.5 text-[11px] border leading-none",
              quickBadge.className
            )}
          >
            {quickBadge.label}
          </span>
        ) : lead.status ? (
          <span className="text-[10.5px] font-medium text-subtle shrink-0">
            {lead.status}
          </span>
        ) : null}
      </div>
    </ActionCard>
  );
});
