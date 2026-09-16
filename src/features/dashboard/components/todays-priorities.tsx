import { PhoneCall, ArrowRight, Building2, Phone } from "lucide-react";
import { ActionCard } from "@/components/action-card";
import { LeadRecordLink, ScheduleFollowUpButton } from "@/features/leads/lead-record-link";
import { getLeadCardTheme } from "@/features/leads/lead-card-theme";
import type { PriorityItem } from "@/app/actions/dashboard";

export function TodaysPriorities({ priorities }: { priorities: PriorityItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      {priorities.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed py-8 text-sm text-slate-500 bg-slate-50">
          No priorities for today.
        </div>
      ) : (
        priorities.map((item) => {
          const isFollowUp = item.type === "OVERDUE" || item.type === "TODAY";
          const isProposal = item.type === "PROPOSAL" || item.status === "Proposal Sent";
          const theme = getLeadCardTheme(
            isFollowUp
              ? { status: item.status, operationalState: "FOLLOW_UP_NOW" }
              : isProposal
              ? { status: "Proposal Sent" }
              : { status: item.status || "New" }
          );

          return (
            <ActionCard
              key={item.id}
              href={`/leads?selected=${encodeURIComponent(item.leadId)}`}
              aria-label={`Open lead ${item.leadName}`}
              className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border ${theme.cardBg} ${theme.borderBase} ${theme.leftBorder} ${theme.hoverBorder} p-4 shadow-sm transition-all hover:shadow-md`}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{item.leadName}</span>
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${theme.badgeClass}`}>
                    {theme.badgeLabel}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {item.business}</span>
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {item.phone || "No phone"}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between sm:justify-end gap-3 border-t pt-3 sm:border-0 sm:pt-0 text-sm">
                <div className="flex flex-col sm:items-end mr-2">
                  <span className="font-medium text-slate-700">{item.actionNeeded}</span>
                  <span className="text-xs font-semibold text-slate-500">{item.time}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.phone && (
                    <a href={`tel:${item.phone}`} className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="Call">
                      <PhoneCall className="h-4 w-4" />
                    </a>
                  )}
                  <LeadRecordLink leadId={item.leadId} label={`Open lead ${item.leadName}`} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors" title="Open Lead">
                    <ArrowRight className="h-4 w-4" />
                  </LeadRecordLink>
                  <ScheduleFollowUpButton leadId={item.leadId} leadName={item.leadName} />
                </div>
              </div>
            </ActionCard>
          );
        })
      )}
    </div>
  );
}
