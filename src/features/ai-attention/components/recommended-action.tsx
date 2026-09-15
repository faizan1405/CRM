import { PhoneCall, CalendarClock, AlertOctagon, MessageSquare, Sparkles, ArrowRight } from "lucide-react";
import { type RecommendedAction } from "../types";

interface RecommendedActionProps {
  action: RecommendedAction;
  variant?: "compact" | "banner" | "button-card";
  onActionClick?: () => void;
  className?: string;
}

export function AIRecommendedAction({
  action,
  variant = "compact",
  onActionClick,
  className = "",
}: RecommendedActionProps) {
  const { title, type = "call", reason } = action;

  // Choose icon based on type or title keywords
  let Icon = Sparkles;
  let colorStyle = "text-blue-700 bg-blue-50 border-blue-200";
  let iconColor = "text-blue-600";

  const lowerTitle = title.toLowerCase();
  if (type === "warning" || lowerTitle.includes("cold") || lowerTitle.includes("overdue") || lowerTitle.includes("urgent")) {
    Icon = AlertOctagon;
    colorStyle = "text-rose-800 bg-rose-50 border-rose-200";
    iconColor = "text-rose-600";
  } else if (type === "call" || lowerTitle.includes("call")) {
    Icon = PhoneCall;
    colorStyle = "text-blue-800 bg-blue-50/80 border-blue-200";
    iconColor = "text-blue-600";
  } else if (type === "followup" || lowerTitle.includes("follow up") || lowerTitle.includes("tomorrow") || lowerTitle.includes("schedule")) {
    Icon = CalendarClock;
    colorStyle = "text-indigo-800 bg-indigo-50 border-indigo-200";
    iconColor = "text-indigo-600";
  } else if (type === "whatsapp" || lowerTitle.includes("whatsapp") || lowerTitle.includes("message")) {
    Icon = MessageSquare;
    colorStyle = "text-emerald-800 bg-emerald-50 border-emerald-200";
    iconColor = "text-emerald-600";
  }

  if (variant === "compact") {
    return (
      <div
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${colorStyle} ${className}`}
      >
        <Icon size={13} className={`shrink-0 ${iconColor}`} aria-hidden="true" />
        <span className="font-semibold tracking-tight truncate">{title}</span>
      </div>
    );
  }

  if (variant === "button-card") {
    return (
      <div
        className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-all ${colorStyle} ${className}`}
      >
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="rounded-lg bg-white p-1.5 shadow-xs shrink-0">
            <Icon size={16} className={iconColor} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">
                AI Next Action
              </span>
            </div>
            <p className="font-semibold text-slate-900 text-sm truncate">{title}</p>
            {reason && <p className="mt-0.5 text-xs text-slate-600">{reason}</p>}
          </div>
        </div>

        {onActionClick && (
          <button
            type="button"
            onClick={onActionClick}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-xs hover:bg-slate-50 border border-slate-200 cursor-pointer"
          >
            Act <ArrowRight size={13} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }

  // Default banner variant
  return (
    <div
      role="region"
      aria-label="AI Recommended Next Action"
      className={`rounded-xl border p-3.5 ${colorStyle} ${className}`}
    >
      <div className="flex items-center gap-2">
        <Icon size={16} className={`shrink-0 ${iconColor}`} aria-hidden="true" />
        <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">
          Recommended Next Action
        </span>
      </div>
      <p className="mt-1 font-semibold text-slate-950 text-sm">{title}</p>
      {reason && <p className="mt-0.5 text-xs text-slate-600">{reason}</p>}
    </div>
  );
}
