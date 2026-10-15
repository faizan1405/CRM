"use client";

import type { BriefingCardId, BriefingSummaryStats } from "../types";
import { Flame, PhoneCall, AlertTriangle, Sparkles, Clock, IndianRupee } from "lucide-react";

type BriefingSummaryCardsProps = {
  stats: BriefingSummaryStats;
  selectedCard?: BriefingCardId | null;
  onSelectCard?: (cardId: BriefingCardId | null) => void;
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
  borderColor: string;
  badge?: string;
};

const CARDS: CardConfig[] = [
  {
    id: "hot_leads",
    label: "Hot Leads",
    emoji: "🔥",
    icon: Flame,
    getValue: (s) => s.hotLeadsCount,
    subtext: "High engagement score",
    accentColor: "text-amber-600",
    bgLight: "bg-amber-50/70",
    borderColor: "border-amber-200",
    badge: "Active",
  },
  {
    id: "followups_today",
    label: "Follow-ups Today",
    emoji: "📞",
    icon: PhoneCall,
    getValue: (s) => s.followUpsTodayCount,
    subtext: "Scheduled for today",
    accentColor: "text-blue-600",
    bgLight: "bg-blue-50/70",
    borderColor: "border-blue-200",
    badge: "Today",
  },
  {
    id: "overdue_followups",
    label: "Overdue Follow-ups",
    emoji: "⚠️",
    icon: AlertTriangle,
    getValue: (s) => s.overdueFollowUpsCount,
    subtext: "Requires instant touch",
    accentColor: "text-rose-600",
    bgLight: "bg-rose-50/70",
    borderColor: "border-rose-200",
    badge: "Urgent",
  },
  {
    id: "new_leads",
    label: "New Leads",
    emoji: "🆕",
    icon: Sparkles,
    getValue: (s) => s.newLeadsCount,
    subtext: "Added in last 24h",
    accentColor: "text-emerald-600",
    bgLight: "bg-emerald-50/70",
    borderColor: "border-emerald-200",
    badge: "Fresh",
  },
  {
    id: "stale_leads",
    label: "Leads Becoming Stale",
    emoji: "💤",
    icon: Clock,
    getValue: (s) => s.staleLeadsCount,
    subtext: "No touch for 4+ days",
    accentColor: "text-slate-600",
    bgLight: "bg-slate-50",
    borderColor: "border-slate-200",
    badge: "At risk",
  },
  {
    id: "opportunity_value",
    label: "Active Opportunity Value",
    emoji: "💰",
    icon: IndianRupee,
    getValue: (s) => s.activeOpportunityValueFormatted,
    subtext: "In active negotiation",
    accentColor: "text-indigo-600",
    bgLight: "bg-indigo-50/70",
    borderColor: "border-indigo-200",
    badge: "Pipeline",
  },
];

export function BriefingSummaryCards({
  stats,
  selectedCard,
  onSelectCard,
}: BriefingSummaryCardsProps) {
  return (
    <section aria-label="Daily sales metrics overview" className="w-full">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
        {CARDS.map((card) => {
          const isSelected = selectedCard === card.id;
          const value = card.getValue(stats);
          const IconComponent = card.icon;

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
              className={`group relative flex flex-col justify-between rounded-xl border p-3 text-left transition-all sm:p-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 active:scale-[0.98] ${
                isSelected
                  ? "border-blue-600 bg-white ring-2 ring-blue-500/20 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
              }`}
            >
              {/* Header row with emoji/icon & badge */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="text-base select-none sm:text-lg"
                  >
                    {card.emoji}
                  </span>
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold sm:hidden ${card.bgLight} ${card.accentColor}`}
                  >
                    {card.badge}
                  </span>
                </div>
                <span
                  aria-hidden="true"
                  className={`hidden sm:grid size-6 place-items-center rounded-md ${card.bgLight} ${card.accentColor}`}
                >
                  <IconComponent size={13} strokeWidth={2.4} />
                </span>
              </div>

              {/* Metric number */}
              <div className="mt-2.5">
                <div className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                  {value}
                </div>
                <div className="mt-0.5 truncate text-[11px] font-medium leading-tight text-slate-600 sm:text-xs">
                  {card.label}
                </div>
              </div>

              {/* Subtext info */}
              <div className="mt-2 hidden border-t border-slate-100 pt-1.5 sm:block">
                <span className="truncate text-[10px] font-normal text-slate-500">
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
