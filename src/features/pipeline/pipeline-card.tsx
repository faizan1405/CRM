import { Building2, Phone } from "lucide-react";
import { formatCurrency, formatDate } from "@/features/leads/formatters";
import type { Lead } from "@/features/leads/types";

export function PipelineCard({
  lead,
  onClick,
}: {
  lead: Lead;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className="group flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:border-blue-300 hover:shadow-md transition-shadow text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex justify-between items-start gap-2">
        <h4 className="font-semibold text-slate-900 text-sm break-words line-clamp-2">
          {lead.name}
        </h4>
        {lead.source && (
          <span className="shrink-0 text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-sm">
            {lead.source}
          </span>
        )}
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
              <span>{lead.phone}</span>
            </div>
          )}
        </div>
      )}

      {(lead.budget || lead.quotedAmount || lead.nextFollowUpDate) && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-slate-100 pt-2 text-[11px]">
          {lead.budget !== null && (
            <div className="flex flex-col">
              <span className="text-slate-400 leading-tight">Budget</span>
              <span className="font-medium text-slate-700 leading-tight">
                {formatCurrency(lead.budget)}
              </span>
            </div>
          )}
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
    </div>
  );
}
