import { Flame, Sparkles, Snowflake } from "lucide-react";
import { type LeadScoreCategory, getScoreCategory } from "../types";

interface AIScoreBadgeProps {
  score: number;
  category?: LeadScoreCategory;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  scoreReason?: string;
  className?: string;
}

export function AIScoreBadge({
  score,
  category,
  size = "md",
  showLabel = true,
  scoreReason,
  className = "",
}: AIScoreBadgeProps) {
  // Clamp score between 0 and 100
  const normalizedScore = Math.min(100, Math.max(0, Math.round(score)));
  const scoreCategory = category || getScoreCategory(normalizedScore);

  const config = {
    hot: {
      label: "Hot",
      icon: Flame,
      bg: "bg-rose-50 text-rose-700 border-rose-200",
      accent: "text-rose-600",
      ariaLabel: `AI Lead Score: ${normalizedScore} out of 100, Hot lead`,
    },
    warm: {
      label: "Warm",
      icon: Sparkles,
      bg: "bg-amber-50 text-amber-700 border-amber-200",
      accent: "text-amber-600",
      ariaLabel: `AI Lead Score: ${normalizedScore} out of 100, Warm lead`,
    },
    cold: {
      label: "Cold",
      icon: Snowflake,
      bg: "bg-slate-100 text-slate-700 border-slate-200",
      accent: "text-slate-500",
      ariaLabel: `AI Lead Score: ${normalizedScore} out of 100, Cold lead`,
    },
  }[scoreCategory];

  const Icon = config.icon;

  if (size === "sm") {
    return (
      <span
        title={scoreReason || config.ariaLabel}
        aria-label={config.ariaLabel}
        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold tracking-tight ${config.bg} ${className}`}
      >
        <Icon size={12} className={config.accent} aria-hidden="true" />
        <span>{normalizedScore}</span>
        {showLabel && <span className="opacity-90">{config.label}</span>}
      </span>
    );
  }

  if (size === "lg") {
    return (
      <div
        title={scoreReason || config.ariaLabel}
        aria-label={config.ariaLabel}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 ${config.bg} ${className}`}
      >
        <Icon size={18} className={config.accent} aria-hidden="true" />
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold leading-none">{normalizedScore}</span>
          <span className="text-xs font-semibold uppercase tracking-wider opacity-85">/ 100</span>
        </div>
        {showLabel && (
          <span className="rounded bg-white/70 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider">
            {config.label}
          </span>
        )}
      </div>
    );
  }

  // Default "md"
  return (
    <span
      title={scoreReason || config.ariaLabel}
      aria-label={config.ariaLabel}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold ${config.bg} ${className}`}
    >
      <Icon size={14} className={config.accent} aria-hidden="true" />
      <span className="font-bold">{normalizedScore}</span>
      {showLabel && <span className="opacity-90 font-medium">{config.label}</span>}
    </span>
  );
}
