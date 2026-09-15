import { Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { type StaleStatus } from "../types";
import { formatDate } from "@/features/leads/formatters";

interface StaleIndicatorProps {
  staleStatus: StaleStatus;
  variant?: "compact" | "detailed" | "banner";
  className?: string;
}

export function StaleIndicator({
  staleStatus,
  variant = "compact",
  className = "",
}: StaleIndicatorProps) {
  const { isStale, lastActivityDate, durationWithoutContact, warningLevel = "normal", staleFor } = staleStatus;

  if (variant === "compact") {
    if (!isStale) {
      return (
        <span
          className={`inline-flex items-center gap-1 text-xs text-slate-500 ${className}`}
          title={lastActivityDate ? `Last contact: ${formatDate(lastActivityDate)}` : "Recently active"}
        >
          <Clock size={12} className="text-slate-400" aria-hidden="true" />
          <span>Active</span>
        </span>
      );
    }

    const badgeColors =
      warningLevel === "critical"
        ? "bg-rose-50 text-rose-700 border-rose-200"
        : "bg-amber-50 text-amber-800 border-amber-200";

    return (
      <span
        role="status"
        aria-label={`Warning: Stale lead, no contact for ${durationWithoutContact}`}
        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium ${badgeColors} ${className}`}
        title={`No contact for ${durationWithoutContact}. Last activity: ${formatDate(lastActivityDate || null)}`}
      >
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex size-1.5 rounded-full bg-rose-600" />
        </span>
        <span>Stale ({durationWithoutContact})</span>
      </span>
    );
  }

  if (variant === "banner" || variant === "detailed") {
    if (!isStale) {
      return (
        <div
          className={`flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 ${className}`}
        >
          <CheckCircle size={15} className="text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-emerald-950">Active Engagement</p>
            <p className="mt-0.5 text-emerald-800">
              {staleFor || `Last activity ${formatDate(lastActivityDate || null)} (${durationWithoutContact} ago)`}.
            </p>
          </div>
        </div>
      );
    }

    const isCritical = warningLevel === "critical";

    return (
      <div
        role="alert"
        className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs ${
          isCritical
            ? "border-red-200 bg-red-50 text-red-900"
            : "border-amber-200 bg-amber-50 text-amber-900"
        } ${className}`}
      >
        <AlertTriangle
          size={16}
          className={`${isCritical ? "text-red-600" : "text-amber-600"} shrink-0 mt-0.5`}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-900">
              {isCritical ? "Critical Stale Alert" : "Stale Lead Warning"}
            </span>
            <span className="rounded bg-white/80 px-1 py-0.2 text-[10px] font-semibold uppercase tracking-wider">
              {durationWithoutContact}
            </span>
          </div>
          <p className="mt-1 text-slate-700">
            No contact recorded for <span className="font-semibold">{durationWithoutContact}</span>.
            {lastActivityDate && (
              <> Last interaction was on {formatDate(lastActivityDate || null)}.</>
            )}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
