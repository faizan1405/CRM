import { ActionCard } from "@/components/action-card";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { Building2, Phone, MessageCircle, CalendarPlus } from "lucide-react";
import type { Lead } from "@/features/leads/types";
import { AIScoreBadge, deriveAIAttention } from "@/features/ai-attention";
import { QuickStatusChip } from "@/features/leads/quick-status-chip";
import { getLeadCardTheme } from "@/features/leads/lead-card-theme";
import { formatLeadAge, formatLastContacted, formatNextFollowUp } from "@/lib/date-utils";
import { CopyContactButton } from "@/components/copy-contact-button";

export function PipelineCard({
  lead,
  onClick,
  dragHandleProps,
}: {
  lead: Lead;
  onClick: () => void;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
}) {
  const ai = lead.aiAttention || deriveAIAttention(lead);
  const notesText = lead.latestNote || lead.notes || "";
  const theme = getLeadCardTheme(lead);

  return (
    <ActionCard
      onActivate={onClick}
      aria-label={`Open lead ${lead.name}`}
      {...dragHandleProps}
      className={`group relative flex flex-col gap-1.5 rounded-xl border ${theme.cardBg} ${theme.borderBase} ${theme.leftBorder} ${theme.hoverBorder} p-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] active:shadow-sm transition-[transform,box-shadow,border-color] duration-200 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h4 className="font-semibold text-slate-900 text-[15px] truncate">{lead.name}</h4>
            <AIScoreBadge score={ai.score} category={ai.scoreCategory} size="sm" showLabel={false} />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[12px] font-medium text-slate-600 truncate">{lead.phone}</span>
            <CopyContactButton name={lead.name} phone={lead.phone} />
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0 gap-1.5">
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100/80 px-1.5 py-0.5 rounded-md">
            Age {formatLeadAge(lead.createdAt)}
          </span>
          <QuickStatusChip quickStatus={lead.quickStatus} leadStatus={lead.status} readOnly size="sm" />
        </div>
      </div>

      <div className="text-[11px] sm:text-[12px] leading-tight text-slate-500 line-clamp-1 italic bg-white/50 rounded p-1 -mx-1 mt-0.5">
        {notesText || "No notes"}
      </div>

      <div className="flex justify-between items-center text-[10px] sm:text-[11px] mt-1 border-t border-slate-100 pt-1.5">
        <span className="text-slate-500 font-medium">Last: <span className="text-slate-700">{formatLastContacted(lead.lastContactDate)}</span></span>
        <span className="text-slate-500 font-medium">Next: <span className="font-bold text-blue-700">{formatNextFollowUp(lead.nextFollowUpDate)}</span></span>
      </div>
    </ActionCard>
  );
}
