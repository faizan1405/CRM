import { Sparkles, Info, TrendingUp, History } from "lucide-react";
import { type AIAttentionLeadData } from "../types";
import { AIScoreBadge } from "./ai-score-badge";
import { AttentionPriorityBadge } from "./attention-priority-badge";
import { StaleIndicator } from "./stale-indicator";
import { AIRecommendedAction } from "./recommended-action";

interface LeadDetailAIInsightsProps {
  data: AIAttentionLeadData;
  onRecommendedAction?: () => void;
  className?: string;
}

export function LeadDetailAIInsights({
  data,
  onRecommendedAction,
  className = "",
}: LeadDetailAIInsightsProps) {
  const { score, scoreCategory, scoreReason, priority, staleStatus, stageAging, recommendedAction } = data;

  // Score bar width percentage
  const scorePercent = Math.min(100, Math.max(0, score));

  // Determine progress bar color gradient
  const progressBg =
    scoreCategory === "hot"
      ? "bg-gradient-to-r from-rose-500 to-red-600"
      : scoreCategory === "warm"
      ? "bg-gradient-to-r from-amber-400 to-amber-600"
      : "bg-gradient-to-r from-slate-400 to-slate-600";

  return (
    <section
      aria-label="AI Lead Insights"
      className={`rounded-xl border border-blue-200/80 bg-gradient-to-b from-blue-50/40 via-white to-white p-5 shadow-xs ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
            <Sparkles size={15} aria-hidden="true" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-950 text-base">AI Insights</h3>
            <p className="text-[11px] font-medium text-slate-500">Automated prioritization & next steps</p>
          </div>
        </div>
        <AttentionPriorityBadge priority={priority} size="md" />
      </div>

      {/* Score and Reason Grid */}
      <div className="mt-4 space-y-4">
        {/* Score & Category Gauge */}
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Lead Score
              </span>
              <div className="mt-1 flex items-center gap-2">
                <AIScoreBadge score={score} category={scoreCategory} size="lg" />
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-medium text-slate-500">Conversion Quality</span>
              <p className="mt-0.5 text-sm font-bold text-slate-900 capitalize">
                {scoreCategory === "hot" ? "🔥 High Intent (Hot)" : scoreCategory === "warm" ? "⚡ Nurturing (Warm)" : "❄️ Low Intent (Cold)"}
              </p>
            </div>
          </div>

          {/* Visual Progress Gauge */}
          <div className="mt-3">
            <div
              role="progressbar"
              aria-valuenow={scorePercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Lead score ${score} out of 100`}
              className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${progressBg}`}
                style={{ width: `${scorePercent}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] font-medium text-slate-400">
              <span>0 Cold</span>
              <span>50 Warm</span>
              <span>80 Hot</span>
              <span>100</span>
            </div>
          </div>

          {/* Score Explanation / Reason */}
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
            <Info size={14} className="text-blue-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-semibold text-slate-900">Score Reason: </span>
              <span>{scoreReason}</span>
            </div>
          </div>
        </div>

        {/* Stage Aging & Stale Status Row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Stage Aging */}
          <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider">Stage Aging</span>
              <History size={14} className="text-slate-400" aria-hidden="true" />
            </div>
            <p className="mt-2 text-sm font-bold text-slate-900">
              {stageAging.currentStage} — {stageAging.timeInStage}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {stageAging.stageAgeEstimated ? "Estimated time in pipeline stage." : "Time spent in current pipeline stage."}
            </p>
          </div>

          {/* Stale Status */}
          <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold uppercase tracking-wider">Stale Status</span>
              <TrendingUp size={14} className="text-slate-400" aria-hidden="true" />
            </div>
            <div className="mt-2">
              <StaleIndicator staleStatus={staleStatus} variant="detailed" />
            </div>
          </div>
        </div>

        {/* AI Recommended Next Action */}
        <div>
          <AIRecommendedAction
            action={recommendedAction}
            variant="button-card"
            onActionClick={onRecommendedAction}
          />
        </div>
      </div>
    </section>
  );
}
