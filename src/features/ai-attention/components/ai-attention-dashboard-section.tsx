import Link from "next/link";
import { Flame, PhoneCall, MessageCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { type AIAttentionSummaryItem, type AttentionPriority } from "../types";
import { AIScoreBadge } from "./ai-score-badge";
import { AttentionPriorityBadge } from "./attention-priority-badge";
import { getTelephoneHref, getWhatsAppHref } from "@/features/leads/contact-links";
import type { PriorityItem } from "@/app/actions/dashboard";

interface AIAttentionDashboardSectionProps {
  items?: AIAttentionSummaryItem[];
  priorities?: PriorityItem[];
  onSelectLead?: (leadId: string) => void;
  className?: string;
}

export function AIAttentionDashboardSection({
  items,
  priorities,
  onSelectLead,
  className = "",
}: AIAttentionDashboardSectionProps) {
  // If items provided directly, use them
  let displayItems: AIAttentionSummaryItem[] = items || [];

  // If priorities provided and no items, map priorities into AI Attention items (real data)
  if ((!displayItems || displayItems.length === 0) && priorities && priorities.length > 0) {
    displayItems = priorities.map((p, idx) => {
      let score = 90 - idx * 5;
      if (p.type === "OVERDUE") score = Math.max(88, score);
      else if (p.type === "PROPOSAL") score = Math.max(78, score);
      else if (p.type === "NEW") score = Math.max(72, score);

      let priority: AttentionPriority = "normal";
      if (p.type === "OVERDUE" || score >= 85) priority = "critical";
      else if (p.type === "PROPOSAL" || score >= 70) priority = "important";

      let reason = p.actionNeeded;
      if (p.type === "OVERDUE") {
        reason = `Overdue follow-up (${p.time})`;
      } else if (p.type === "PROPOSAL") {
        reason = `Proposal awaiting review (${p.time})`;
      } else if (p.type === "NEW") {
        reason = `New uncontacted lead (${p.time})`;
      }

      return {
        id: p.id,
        leadId: p.leadId,
        leadName: p.leadName,
        business: p.business,
        phone: p.phone,
        score,
        scoreCategory: score >= 80 ? "hot" : score >= 50 ? "warm" : "cold",
        priority,
        attentionReason: reason,
        stage: p.status,
        recommendedAction: {
          title: p.type === "OVERDUE" ? "Call today" : p.actionNeeded || "Follow up today",
          type: p.type === "OVERDUE" ? "call" : "followup",
        },
      };
    });
  }

  // Zero-state if completely empty (NO MOCK DATA)
  if (!displayItems || displayItems.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center ${className}`}
      >
        <div className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-2">
          <CheckCircle2 size={20} aria-hidden="true" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">All leads are on track</h3>
        <p className="mt-1 text-xs text-slate-500 max-w-sm">
          No active leads currently require urgent attention. Check back as new activities and follow-ups are scheduled.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {displayItems.map((item) => {
        const isHot = item.score >= 80;
        return (
          <article
            key={item.id}
            className="group flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs transition-all hover:border-blue-300 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            {/* Lead Info & Score */}
            <div className="min-w-0 flex-1 space-y-1">
              {/* Primary Line: 🔥 Name — Score 91 — Critical */}
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <div className="flex items-center gap-1 font-bold text-slate-950">
                  {isHot && (
                    <Flame
                      size={16}
                      className="text-rose-500 shrink-0 fill-rose-500"
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate">{item.leadName}</span>
                </div>

                <span className="text-slate-300" aria-hidden="true">
                  —
                </span>

                {/* Score */}
                <AIScoreBadge
                  score={item.score}
                  category={item.scoreCategory}
                  size="sm"
                  showLabel={false}
                />

                <span className="text-slate-300" aria-hidden="true">
                  —
                </span>

                {/* Priority */}
                <AttentionPriorityBadge priority={item.priority} size="sm" showIcon={false} />
              </div>

              {/* Sub-line: Attention Reason & Action */}
              <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
                <span className="font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                  {item.attentionReason}
                </span>

                {item.business && (
                  <span className="truncate text-slate-500">· {item.business}</span>
                )}

                {item.stage && (
                  <span className="text-slate-400">· {item.stage}</span>
                )}

                {item.recommendedAction?.title && (
                  <span className="hidden sm:inline text-blue-700 font-medium">
                    · Next: {item.recommendedAction.title}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-2 sm:border-0 sm:pt-0 sm:justify-end gap-1.5 shrink-0">
              {item.phone && (
                <div className="flex items-center gap-1">
                  <a
                    href={getTelephoneHref(item.phone)}
                    className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors"
                    aria-label={`Call ${item.leadName}`}
                    title="Call"
                  >
                    <PhoneCall size={14} aria-hidden="true" />
                  </a>

                  <a
                    href={getWhatsAppHref(item.phone, item.leadName)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors"
                    aria-label={`WhatsApp ${item.leadName}`}
                    title="WhatsApp"
                  >
                    <MessageCircle size={14} aria-hidden="true" />
                  </a>
                </div>
              )}

              {onSelectLead ? (
                <button
                  type="button"
                  onClick={() => onSelectLead(item.leadId)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label={`Review ${item.leadName}`}
                >
                  <span>Review</span>
                  <ArrowRight size={13} aria-hidden="true" />
                </button>
              ) : (
                <Link
                  href={`/leads`}
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors"
                  aria-label={`Review ${item.leadName}`}
                >
                  <span>Review</span>
                  <ArrowRight size={13} aria-hidden="true" />
                </Link>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
