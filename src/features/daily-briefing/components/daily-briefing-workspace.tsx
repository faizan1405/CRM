"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AiBriefingData,
  BriefingActionItem,
  BriefingCardId,
  BriefingPriority,
  BriefingSummaryStats,
} from "../types";
import { refreshDailyBriefingAi } from "@/app/actions/daily-briefing";
import { BriefingSummaryCards } from "./briefing-summary-cards";
import { AiBriefingBanner } from "./ai-briefing-banner";
import { PriorityActionItem } from "./priority-action-item";
import { BriefingEmptyState } from "./briefing-empty-state";
import { Filter, RotateCcw } from "lucide-react";

type DailyBriefingWorkspaceProps = {
  initialStats?: BriefingSummaryStats;
  initialActions?: BriefingActionItem[];
  initialAiBriefing?: AiBriefingData;
  onRefreshAi?: () => void;
};

const DEFAULT_STATS: BriefingSummaryStats = {
  hotLeadsCount: 0,
  followUpsTodayCount: 0,
  overdueFollowUpsCount: 0,
  newLeadsCount: 0,
  staleLeadsCount: 0,
  activeOpportunityValue: 0,
  activeOpportunityValueFormatted: "₹0",
};

const DEFAULT_AI_BRIEFING: AiBriefingData = {
  summary: "No AI briefing summary generated yet for today. Click Refresh to analyze your priority leads.",
  keyPoints: [],
  recommendation: "Focus on leads with scheduled follow-ups and active attention status.",
};

type PriorityFilter = "ALL" | BriefingPriority | "PENDING" | "COMPLETED";

export function DailyBriefingWorkspace({
  initialStats = DEFAULT_STATS,
  initialActions = [],
  initialAiBriefing = DEFAULT_AI_BRIEFING,
  onRefreshAi,
}: DailyBriefingWorkspaceProps) {
  const router = useRouter();

  // State
  const [stats, setStats] = useState<BriefingSummaryStats>(initialStats);
  const [actions, setActions] = useState<BriefingActionItem[]>(initialActions);
  const [aiBriefing, setAiBriefing] = useState<AiBriefingData>(initialAiBriefing);
  const [isAiRefreshing, setIsAiRefreshing] = useState(false);
  const [selectedCard, setSelectedCard] = useState<BriefingCardId | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");
  const [forceEmptyState, setForceEmptyState] = useState(false);

  // Modal State




  // Toggle Action Done
  const handleToggleDone = (itemId: string) => {
    setActions((prev: BriefingActionItem[]) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const newDone = !item.isDone;
          return { ...item, isDone: newDone };
        }
        return item;
      })
    );
  };

  // Handle Open Lead
  const handleOpenLead = (item: BriefingActionItem) => {
    if (item.leadId) {
      router.push(`/leads/${item.leadId}`);
    }
  };

  // Handle Call
  const handleCall = (item: BriefingActionItem) => {
    if (item.phone) {
      window.location.href = `tel:${item.phone}`;
    }
  };

  // Handle WhatsApp
  const handleWhatsApp = (item: BriefingActionItem) => {
    if (item.phone) {
      window.open(`https://wa.me/${item.phone.replace(/[^0-9]/g, "")}`, "_blank");
    }
  };

  // Handle Add Follow-up modal trigger
  const handleOpenAddFollowUp = (item: BriefingActionItem) => {
    if (item.leadId) {
      router.push(`/leads/${item.leadId}`);
    }
  };

  // Handle AI Refresh callback
  const handleRefreshAi = async () => {
    if (onRefreshAi) {
      onRefreshAi();
      return;
    }
    setIsAiRefreshing(true);
    try {
      const res = await refreshDailyBriefingAi();
      if (res.success && res.data) {
        if (res.data.aiBriefing) setAiBriefing(res.data.aiBriefing);
        if (res.data.summaryStats) setStats(res.data.summaryStats);
        if (res.data.priorityActions) setActions(res.data.priorityActions);
      }
    } finally {
      setIsAiRefreshing(false);
    }
  };

  // Reset checklist
  const handleResetActions = () => {
    setActions(initialActions);
    setForceEmptyState(false);
  };

  // Stats calculation
  const totalActions = actions.length;
  const completedActions = actions.filter((a) => a.isDone).length;
  const pendingActions = actions.filter((a) => !a.isDone);
  const criticalCount = actions.filter((a) => a.priority === "Critical" && !a.isDone).length;
  const importantCount = actions.filter((a) => a.priority === "Important" && !a.isDone).length;
  const normalCount = actions.filter((a) => a.priority === "Normal" && !a.isDone).length;

  // Filter actions
  const filteredActions = actions.filter((action) => {
    if (forceEmptyState) return false;

    // Card-based filter if a summary card is clicked
    if (selectedCard === "overdue_followups") {
      if (!action.tag?.toLowerCase().includes("overdue") && !action.dueTime?.toLowerCase().includes("overdue")) {
        return false;
      }
    } else if (selectedCard === "hot_leads") {
      if ((action.score ?? 0) < 85) return false;
    } else if (selectedCard === "new_leads") {
      if (!action.tag?.toLowerCase().includes("new")) return false;
    } else if (selectedCard === "stale_leads") {
      if (!action.tag?.toLowerCase().includes("stale")) return false;
    }

    // Priority filter
    if (priorityFilter === "ALL") return true;
    if (priorityFilter === "PENDING") return !action.isDone;
    if (priorityFilter === "COMPLETED") return action.isDone;
    return action.priority === priorityFilter;
  });

  const isAllUrgentDone =
    forceEmptyState ||
    (pendingActions.length === 0 && totalActions > 0) ||
    filteredActions.length === 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-16">


      {/* Briefing Header: Mobile-First, Scan in under 30 seconds */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 uppercase tracking-wider">
              ⚡ 30-Sec Daily Scan
            </span>
            <span className="text-xs font-medium text-slate-500">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl lg:text-3xl">
            Daily Sales Briefing
          </h1>
          <p className="mt-0.5 text-xs text-slate-600 sm:text-sm">
            What matters today: 3 high-impact leads, 8 follow-ups, and ₹4.85L in active pipeline.
          </p>
        </div>

        {/* Header Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
          <button
            type="button"
            onClick={() => setForceEmptyState((prev) => !prev)}
            aria-pressed={forceEmptyState}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
              forceEmptyState
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>{forceEmptyState ? "Exit Empty State" : "Preview Empty State"}</span>
          </button>

          <button
            type="button"
            onClick={handleResetActions}
            aria-label="Reset checklist"
            className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <RotateCcw size={13} />
            <span className="hidden xs:inline">Reset</span>
          </button>
        </div>
      </header>

      {/* AI Daily Intelligence Briefing Section */}
      <AiBriefingBanner
        data={aiBriefing}
        isLoading={isAiRefreshing}
        onRefresh={handleRefreshAi}
      />

      {/* Summary Cards: 6 core metrics */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Pipeline Snapshot
          </h2>
          {selectedCard && (
            <button
              type="button"
              onClick={() => setSelectedCard(null)}
              className="text-[11px] font-medium text-blue-600 hover:text-blue-800"
            >
              Clear Card Filter
            </button>
          )}
        </div>

        <BriefingSummaryCards
          stats={stats}
          selectedCard={selectedCard}
          onSelectCard={(id: BriefingCardId | null) => setSelectedCard(id)}
        />
      </div>

      {/* Most Important Actions Section */}
      <section aria-labelledby="actions-section-title" className="space-y-3 pt-2">
        {/* Section Title & Progress Bar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2
                id="actions-section-title"
                className="text-base font-bold tracking-tight text-slate-950 sm:text-lg"
              >
                Most Important Actions Today
              </h2>
              <span className="grid size-5 place-items-center rounded-full bg-rose-100 text-[11px] font-bold text-rose-700">
                {pendingActions.length}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Prioritized by deal value, urgency score, and customer responsiveness.
            </p>
          </div>

          {/* Progress badge */}
          <div className="flex items-center gap-2 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700">
            <span>Progress:</span>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{
                  width: `${
                    totalActions > 0
                      ? Math.round((completedActions / totalActions) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <span className="font-semibold text-slate-900">
              {completedActions}/{totalActions}
            </span>
          </div>
        </div>

        {/* Priority Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2.5">
          <span className="mr-1 text-xs font-medium text-slate-500 flex items-center gap-1">
            <Filter size={13} /> Filter:
          </span>

          <button
            type="button"
            onClick={() => setPriorityFilter("ALL")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              priorityFilter === "ALL"
                ? "bg-slate-900 text-white font-semibold"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            All ({totalActions})
          </button>

          <button
            type="button"
            onClick={() => setPriorityFilter("Critical")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              priorityFilter === "Critical"
                ? "bg-rose-600 text-white font-semibold shadow-2xs"
                : "bg-white text-rose-700 border border-rose-200 hover:bg-rose-50"
            }`}
          >
            Critical ({criticalCount})
          </button>

          <button
            type="button"
            onClick={() => setPriorityFilter("Important")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              priorityFilter === "Important"
                ? "bg-amber-600 text-white font-semibold shadow-2xs"
                : "bg-white text-amber-800 border border-amber-200 hover:bg-amber-50"
            }`}
          >
            Important ({importantCount})
          </button>

          <button
            type="button"
            onClick={() => setPriorityFilter("Normal")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              priorityFilter === "Normal"
                ? "bg-slate-700 text-white font-semibold shadow-2xs"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Normal ({normalCount})
          </button>

          <button
            type="button"
            onClick={() => setPriorityFilter("COMPLETED")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              priorityFilter === "COMPLETED"
                ? "bg-emerald-600 text-white font-semibold shadow-2xs"
                : "bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
            }`}
          >
            Done ({completedActions})
          </button>
        </div>

        {/* Priority Actions List or Empty State */}
        {isAllUrgentDone ? (
          <BriefingEmptyState
            onResetActions={handleResetActions}
            completedCount={completedActions}
          />
        ) : (
          <div role="list" className="space-y-2.5">
            {filteredActions.map((item, index) => (
              <div key={item.id} role="listitem">
                <PriorityActionItem
                  item={item}
                  rankIndex={index + 1}
                  onOpenLead={handleOpenLead}
                  onCall={handleCall}
                  onWhatsApp={handleWhatsApp}
                  onAddFollowUp={handleOpenAddFollowUp}
                  onToggleDone={handleToggleDone}
                />
              </div>
            ))}
          </div>
        )}
      </section>


    </div>
  );
}
