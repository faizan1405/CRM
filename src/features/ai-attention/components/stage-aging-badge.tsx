import { History } from "lucide-react";
import { type StageAging } from "../types";

interface StageAgingBadgeProps {
  stageAging: StageAging;
  variant?: "inline" | "pill" | "detailed";
  className?: string;
}

export function StageAgingBadge({
  stageAging,
  variant = "inline",
  className = "",
}: StageAgingBadgeProps) {
  const { currentStage, timeInStage, isStagnant, stageAgeEstimated } = stageAging;

  const text = `${currentStage} — ${timeInStage}${stageAgeEstimated ? " (est.)" : ""}`;

  if (variant === "pill") {
    return (
      <span
        title={`In stage ${currentStage} for ${timeInStage}${stageAgeEstimated ? " (Estimated from legacy data)" : ""}`}
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${
          isStagnant
            ? "border-amber-200 bg-amber-50/70 text-amber-800"
            : "border-slate-200 bg-slate-50 text-slate-700"
        } ${className}`}
      >
        <History size={12} className={isStagnant ? "text-amber-600" : "text-slate-400"} aria-hidden="true" />
        <span className="truncate">{text}</span>
      </span>
    );
  }

  if (variant === "detailed") {
    return (
      <div className={`flex items-center justify-between gap-2 text-xs ${className}`}>
        <span className="text-slate-500 font-medium">Stage Aging</span>
        <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
          <History size={12} className={isStagnant ? "text-amber-500" : "text-slate-400"} aria-hidden="true" />
          {text}
        </span>
      </div>
    );
  }

  // Default inline
  return (
    <span
      title={`Time spent in current stage: ${timeInStage}${stageAgeEstimated ? " (Estimated)" : ""}`}
      className={`inline-flex items-center gap-1 text-xs font-medium text-slate-600 ${className}`}
    >
      <History size={12} className="text-slate-400 shrink-0" aria-hidden="true" />
      <span className="truncate">{text}</span>
    </span>
  );
}
