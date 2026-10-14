"use client";

import type { BriefingCardId, BriefingSummaryStats } from "../types";
import {
  Flame,
  PhoneCall,
  AlertTriangle,
  Sparkles,
  Clock,
  IndianRupee,
} from "lucide-react";

export type BriefingSummaryCardsProps = {
  stats: BriefingSummaryStats;
  selectedCard?: BriefingCardId | null;
  onSelectCard?: (cardId: BriefingCardId | null) => void;
  className?: string;
};

type CardConfig = {
  id: BriefingCardId;
  label: string;
  emoji: string;
  icon: typeof Flame;
  getValue: (s: BriefingSummaryStats) => string | number;
  subtext: string;
  accentColor: string;
  bgLight: string;
  badge: string;
};

const CARDS: CardConfig[] = [
  {
    id: "hot_leads",
    label: "Hot Leads",
    emoji: "🔥",
    icon: Flame,
    getValue: (s) => s.hotLeadsCount,
    subtext: "High engagement score",
    accentColor: "text-amber-600 dark:text-amber-400",
    bgLight: "bg-amber-50 dark:bg-amber-950/30",
    badge: "Active",
  },
  {
    id: "followups_today",
    label: "Follow-ups Today",
    emoji: "📞",
    icon: PhoneCall,
    getValue: (s) => s.followUpsTodayCount,
    subtext: "Scheduled for today",
    accentColor: "text-blue-600 dark:text-blue-400",
    bgLight: "bg-blue-50 dark:bg-blue-950/30",
    badge: "Today",
  },
  {
    id: "overdue_followups",
    label: "Overdue Follow-ups",
    emoji: "⚠️",
    icon: AlertTriangle,
    getValue: (s) => s.overdueFollowUpsCount,
    subtext: "Requires instant touch",
    accentColor: "text-rose-600 dark:text-rose-400",
    bgLight: "bg-rose-50 dark:bg-rose-950/30",
    badge: "Urgent",
  },
  {
    id: "new_leads",
    label: "New Leads",
    emoji: "✨",
    icon: Sparkles,
    getValue: (s) => s.newLeadsCount,
    subtext: "Added in last 24h",
    accentColor: "text-emerald-600 dark:text-emerald-400",
    bgLight: "bg-emerald-50 dark:bg-emerald-950/30",
    badge: "Fresh",
  },
  {
    id: "stale_leads",
    label: "Leads Becoming Stale",
    emoji: "⏱️",
    icon: Clock,
    getValue: (s) => s.staleLeadsCount,
    subtext: "No touch for 7+ days",
    accentColor: "text-slate-600 dark:text-slate-400",
    bgLight: "bg-slate-100 dark:bg-slate-800/40",
    badge: "At risk",
  },
  {
    id: "opportunity_value",
    label: "Active Opportunity Value",
    emoji: "₹",
    icon: IndianRupee,
    getValue: (s) => s.activeOpportunityValueFormatted,
    subtext: "In active negotiation",
    accentColor: "text-indigo-600 dark:text-indigo-400",
    bgLight: "bg-indigo-50 dark:bg-indigo-950/30",
    badge: "Pipeline",
  },
];

export function BriefingSummaryCards({
  stats,
  selectedCard,
  onSelectCard,
  className = "",
}: BriefingSummaryCardsProps) {
  return (
    <section
      aria-label="Pipeline Snapshot"
      className={`w-full ${className}`}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
        {CARDS.map((card) => {
          const isSelected = selectedCard === card.id;
          const value = card.getValue(stats);
          const Icon = card.icon;

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                if (onSelectCard) {
                  onSelectCard(isSelected ? null : card.id);
                }
              }}
              aria-pressed={isSelected}
              aria-label={`${card.label}: ${value}`}
              className={`group press relative flex flex-col justify-between rounded-xl border p-3 text-left transition-all sm:p-3.5 cursor-pointer ${
                isSelected
                  ? "ring-2 ring-primary/30 border-primary bg-primary/5 shadow-xs"
                  : "border-slate-200 dark:border-border bg-white dark:bg-card hover:border-slate-300 dark:hover:border-border/80 hover:shadow-xs"
              }`}
            >
              {/* Header row with emoji/icon & badge */}
              <div className="flex items-center justify-between gap-1.5 w-full">
                <div className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={`grid size-6 place-items-center rounded-md ${card.bgLight}`}
                  >
                    <Icon size={13} className={card.accentColor} />
                  </span>
                </div>
                <span className="rounded bg-slate-100 dark:bg-muted px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-muted-foreground">
                  {card.badge}
                </span>
              </div>

              {/* Metric number & label */}
              <div className="mt-2.5">
                <div className="truncate text-[20px] font-bold tabular text-foreground sm:text-[24px]">
                  {value}
                </div>
                <div className="mt-0.5 truncate text-[11px] font-medium leading-tight text-muted-foreground sm:text-xs">
                  {card.label}
                </div>
              </div>

              {/* Subtext info */}
              <div className="mt-2 hidden border-t border-slate-100 dark:border-border/60 pt-1.5 sm:block w-full">
                <span className="truncate text-[10.5px] font-normal text-muted-foreground">
                  {card.subtext}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
