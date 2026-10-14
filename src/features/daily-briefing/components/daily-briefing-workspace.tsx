"use client";

import { useState } from "react";
import { useLeadNavigation } from "@/features/leads/lead-navigation-provider";
import { useRouter } from "next/navigation";
import type {
  AiBriefingData,
  BriefingActionItem,
  BriefingCardId,
  BriefingCallItem,
  BriefingPaymentItem,
  BriefingPriority,
  BriefingProposalItem,
  BriefingSummaryStats,
} from "../types";
import { refreshDailyBriefingAi } from "@/app/actions/daily-briefing";
import { BriefingHero } from "./briefing-hero";
import { BriefingSummaryCards } from "./briefing-summary-cards";
import { AiBriefingBanner } from "./ai-briefing-banner";
import { PriorityActionItem } from "./priority-action-item";
import { BriefingEmptyState } from "./briefing-empty-state";
import { TodaysCallList } from "./todays-call-list";
import { ProposalsAwaitingReply } from "./proposals-awaiting-reply";
import { PaymentToChase } from "./payment-to-chase";
import { Filter, RotateCcw } from "lucide-react";

export type DailyBriefingWorkspaceProps = {
  initialStats?: BriefingSummaryStats;
  initialActions?: BriefingActionItem[];
  initialAiBriefing?: AiBriefingData;
  initialCalls?: BriefingCallItem[];
  initialProposals?: BriefingProposalItem[];
  initialPayment?: BriefingPaymentItem | null;
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
  summary:
    "No AI briefing summary generated yet for today. Click Refresh to analyze your priority leads.",
  keyPoints: [],
  recommendation:
    "Focus on leads with scheduled follow-ups and active attention status.",
};

type PriorityFilter = "ALL" | BriefingPriority | "PENDING" | "COMPLETED";

export function DailyBriefingWorkspace({
  initialStats = DEFAULT_STATS,
  initialActions = [],
  initialAiBriefing = DEFAULT_AI_BRIEFING,
  initialCalls = [],
  initialProposals = [],
  initialPayment = null,
  onRefreshAi,
}: DailyBriefingWorkspaceProps) {
  const router = useRouter();
  const navigation = useLeadNavigation();

  // State
  const [stats, setStats] = useState<BriefingSummaryStats>(initialStats);
  const [actions, setActions] = useState<BriefingActionItem[]>(initialActions);
  const [aiBriefing, setAiBriefing] = useState<AiBriefingData>(initialAiBriefing);
  const [calls, setCalls] = useState<BriefingCallItem[]>(initialCalls);
  const [proposals, setProposals] = useState<BriefingProposalItem[]>(initialProposals);
  const [payment, setPayment] = useState<BriefingPaymentItem | null>(initialPayment);
  const [isAiRefreshing, setIsAiRefreshing] = useState(false);
  const [selectedCard, setSelectedCard] = useState<BriefingCardId | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");

  // Toggle Action Done (local checklist persistence semantics preserved)
  const handleToggleDone = (itemId: string) => {
    setActions((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return { ...item, isDone: !item.isDone };
        }
        return item;
      })
    );
  };

  // Open Lead in standard Lead Details drawer
  const handleOpenLead = (item: BriefingActionItem) => {
    if (item.leadId) {
      if (navigation) navigation.openLead(item.leadId);
      else router.push(`/leads?selected=${encodeURIComponent(item.leadId)}`);
    }
  };

  const handleOpenLeadById = (leadId: string) => {
    if (navigation) navigation.openLead(leadId);
    else router.push(`/leads?selected=${encodeURIComponent(leadId)}`);
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
      window.open(
        `https://wa.me/${item.phone.replace(/[^0-9]/g, "")}`,
        "_blank"
      );
    }
  };

  // Handle Add Follow-up modal trigger
  const handleOpenAddFollowUp = (item: BriefingActionItem) => {
    if (!item.leadId) return;
    if (navigation) {
      navigation.openFollowUp({
        id: item.leadId,
        name: item.leadName || item.title,
      });
    } else {
      router.push(`/follow-ups?new=true&leadId=${encodeURIComponent(item.leadId)}`);
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
        if (res.data.todayCalls) setCalls(res.data.todayCalls);
        if (res.data.awaitingProposals) setProposals(res.data.awaitingProposals);
        if (res.data.paymentToChase !== undefined) {
          setPayment(res.data.paymentToChase);
        }
      }
    } finally {
      setIsAiRefreshing(false);
    }
  };

  // Reset checklist
  const handleResetActions = () => {
    setActions(initialActions);
    setSelectedCard(null);
    setPriorityFilter("ALL");
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
    // Card-based filter if a summary card is clicked
    if (selectedCard === "overdue_followups") {
      if (
        !action.tag?.toLowerCase().includes("overdue") &&
        !action.dueTime?.toLowerCase().includes("overdue")
      ) {
        return false;
      }
    } else if (selectedCard === "hot_leads") {
      if ((action.score ?? 0) < 80) return false;
    } else if (selectedCard === "followups_today") {
      if (
        !action.tag?.toLowerCase().includes("due today") &&
        !action.dueTime?.toLowerCase().includes("today")
      ) {
        return false;
      }
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
    (pendingActions.length === 0 && totalActions > 0) ||
    (filteredActions.length === 0 && actions.length > 0 && priorityFilter !== "ALL");

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-3 sm:px-6 lg:px-8 pb-16 pt-2">
      {/* SECTION 1: Premium Dark Daily Briefing Hero */}
      <BriefingHero
        stats={stats}
        onResetActions={handleResetActions}
      />

      {/* SECTION 2: AI Daily Intelligence Briefing Section */}
      <AiBriefingBanner
        data={aiBriefing}
        isLoading={isAiRefreshing}
        onRefresh={handleRefreshAi}
      />

      {/* SECTION 3: Original Six Pipeline Snapshot Cards */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Pipeline Snapshot
          </h2>
          {selectedCard && (
            <button
              type="button"
              onClick={() => setSelectedCard(null)}
              className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
            >
              Clear Card Filter
            </button>
          )}
        </div>

        <BriefingSummaryCards
          stats={stats}
          selectedCard={selectedCard}
          onSelectCard={(id) => setSelectedCard(id)}
        />
      </div>

      {/* SECTION 4: Two-column Daily Action Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 pt-2">
        {/* Left Column: Top Priorities (7 cols on lg, 8 cols on xl) */}
        <section
          aria-labelledby="top-priorities-title"
          className="lg:col-span-7 xl:col-span-8 space-y-3"
        >
          {/* Top Priorities Card Container */}
          <div className="rounded-2xl border border-slate-200 dark:border-border bg-white dark:bg-card p-4 sm:p-5 shadow-xs">
            {/* Header: Title, Subtitle, Pending Badge & Progress */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3.5 border-b border-slate-100 dark:border-border/60">
              <div>
                <div className="flex items-center gap-2">
                  <h2
                    id="top-priorities-title"
                    className="text-base font-bold tracking-tight text-foreground sm:text-lg"
                  >
                    Top priorities
                  </h2>
                  <span className="text-xs font-normal text-muted-foreground">
                    by urgency
                  </span>
                  <span className="grid size-5 place-items-center rounded-full bg-rose-100 dark:bg-rose-950/60 text-[11px] font-bold text-rose-700 dark:text-rose-400">
                    {pendingActions.length}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Highest impact on closing deals and keeping pipeline fresh today.
                </p>
              </div>

              {/* Progress indicator */}
              <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 dark:bg-muted/30 border border-slate-100 dark:border-border/60 px-3 py-1.5 text-xs font-medium text-foreground self-start sm:self-auto">
                <span className="text-muted-foreground">Progress:</span>
                <div className="h-2 w-20 sm:w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-muted">
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
                <span className="font-bold tabular text-foreground">
                  {completedActions}/{totalActions}
                </span>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 py-3 border-b border-slate-100 dark:border-border/60">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Filter size={12} /> Filter:
                </span>

                <button
                  type="button"
                  onClick={() => setPriorityFilter("ALL")}
                  className={`press rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    priorityFilter === "ALL"
                      ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold shadow-2xs"
                      : "bg-slate-50 dark:bg-muted/40 text-muted-foreground border border-slate-200 dark:border-border hover:bg-slate-100"
                  }`}
                >
                  All ({totalActions})
                </button>

                <button
                  type="button"
                  onClick={() => setPriorityFilter("Critical")}
                  className={`press rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    priorityFilter === "Critical"
                      ? "bg-rose-600 text-white font-semibold shadow-2xs"
                      : "bg-white dark:bg-card text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50"
                  }`}
                >
                  Critical ({criticalCount})
                </button>

                <button
                  type="button"
                  onClick={() => setPriorityFilter("Important")}
                  className={`press rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    priorityFilter === "Important"
                      ? "bg-amber-600 text-white font-semibold shadow-2xs"
                      : "bg-white dark:bg-card text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 hover:bg-amber-50"
                  }`}
                >
                  Important ({importantCount})
                </button>

                <button
                  type="button"
                  onClick={() => setPriorityFilter("Normal")}
                  className={`press rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    priorityFilter === "Normal"
                      ? "bg-slate-700 dark:bg-slate-300 text-white dark:text-slate-900 font-semibold shadow-2xs"
                      : "bg-white dark:bg-card text-slate-700 dark:text-muted-foreground border border-slate-200 dark:border-border hover:bg-slate-50"
                  }`}
                >
                  Normal ({normalCount})
                </button>

                <button
                  type="button"
                  onClick={() => setPriorityFilter("COMPLETED")}
                  className={`press rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    priorityFilter === "COMPLETED"
                      ? "bg-emerald-600 text-white font-semibold shadow-2xs"
                      : "bg-white dark:bg-card text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-50"
                  }`}
                >
                  Done ({completedActions})
                </button>
              </div>

              {/* Reset button in toolbar */}
              <button
                type="button"
                onClick={handleResetActions}
                title="Reset checklist"
                aria-label="Reset checklist"
                className="press inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <RotateCcw size={11} />
                <span>Reset</span>
              </button>
            </div>

            {/* Priority Actions List or Empty State */}
            <div className="pt-3">
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
            </div>
          </div>
        </section>

        {/* Right Column: Three Stacked Lovable Widgets (5 cols on lg, 4 cols on xl) */}
        <aside
          aria-label="Daily Briefing Quick Widgets"
          className="lg:col-span-5 xl:col-span-4 space-y-5"
        >
          {/* Widget 1: Today's Call List */}
          <TodaysCallList
            calls={calls}
            onOpenLead={handleOpenLeadById}
          />

          {/* Widget 2: Proposals Awaiting Reply */}
          <ProposalsAwaitingReply
            proposals={proposals}
            onOpenLead={handleOpenLeadById}
          />

          {/* Widget 3: Payment to Chase */}
          <PaymentToChase
            payment={payment}
            onOpenLead={handleOpenLeadById}
          />
        </aside>
      </div>
    </div>
  );
}
