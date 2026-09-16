"use client";

import { ActionCard } from "@/components/action-card";

import { Phone } from "lucide-react";
import type { FollowUp } from "./types";
import { formatFollowUpDate, formatTime } from "./formatters";
import { getTypeIcon, typeStyles } from "./follow-up-types";

const statusConfig: Record<string, { label: string; className: string; cardBg: string; leftBorder: string; hoverBorder: string }> = {
  Overdue: {
    label: "Follow up now",
    className: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    cardBg: "bg-emerald-50/40",
    leftBorder: "border-l-4 border-l-emerald-500",
    hoverBorder: "hover:border-emerald-300",
  },
  Today: {
    label: "Follow up now",
    className: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    cardBg: "bg-emerald-50/40",
    leftBorder: "border-l-4 border-l-emerald-500",
    hoverBorder: "hover:border-emerald-300",
  },
  Upcoming: {
    label: "Future follow-up",
    className: "bg-amber-100 text-amber-800 ring-amber-200",
    cardBg: "bg-amber-50/40",
    leftBorder: "border-l-4 border-l-amber-500",
    hoverBorder: "hover:border-amber-300",
  },
  Completed: {
    label: "Done",
    className: "bg-emerald-100 text-emerald-800 ring-emerald-300",
    cardBg: "bg-emerald-50/50",
    leftBorder: "border-l-4 border-l-emerald-600",
    hoverBorder: "hover:border-emerald-400",
  },
  Cancelled: {
    label: "Cancelled",
    className: "bg-slate-100 text-slate-600 ring-slate-200",
    cardBg: "bg-slate-50/70",
    leftBorder: "border-l-4 border-l-slate-400",
    hoverBorder: "hover:border-slate-300",
  },
};

export function FollowUpCard({
  followUp,
  statusInfo,
  onCall,
  onWhatsApp,
  onComplete,
  onReschedule,
  onCancel,
  onOpenLead,
  isCompleting = false,
}: {
  followUp: FollowUp;
  statusInfo: string;
  onCall: () => void;
  onWhatsApp: () => void;
  onComplete: () => void;
  onReschedule: () => void;
  onCancel: () => void;
  onOpenLead: () => void;
  isCompleting?: boolean;
}) {
  const typeInfo = typeStyles[followUp.type] ?? typeStyles.Other;
  const status = statusConfig[statusInfo] ?? statusConfig.Upcoming;
  const isPast = statusInfo === "Overdue" || statusInfo === "Completed" || statusInfo === "Cancelled";

  return (
    <ActionCard onActivate={onOpenLead} aria-label={`Open follow-up context for ${followUp.lead?.name || "lead"}`}
      className={`rounded-xl border ${status.cardBg} ${status.leftBorder} ${status.hoverBorder} border-slate-200/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all ${isPast ? "opacity-80" : ""}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-slate-900 text-[15px]">
            {followUp.lead?.name || "Unknown"}
          </h3>
          <p className="truncate text-sm text-[var(--muted)]">
            {followUp.lead?.business || ""}
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      {/* Meta info */}
      <div className="mt-3 flex flex-col gap-1.5">
        {/* Phone */}
        {(followUp.lead?.phone || followUp.lead?.status) && (
          <div className="flex items-center justify-between gap-2 text-sm">
            {followUp.lead?.phone && (
              <a
                href={`tel:${followUp.lead.phone}`}
                onClick={(e) => { e.stopPropagation(); onCall(); }}
                className="flex items-center gap-1.5 text-slate-700 hover:text-blue-600 transition-colors"
              >
                <Phone aria-hidden="true" size={14} className="text-slate-400" />
                <span className="font-medium">{followUp.lead.phone}</span>
              </a>
            )}
            {followUp.lead?.status && (
              <span className="text-xs text-[var(--muted)]">{followUp.lead.status}</span>
            )}
          </div>
        )}

        {/* Date/time/type row */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-1">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-medium">
              {formatFollowUpDate(followUp.scheduledAt)}
            </span>
            <span className="text-slate-400">&middot;</span>
            <span>{formatTime(followUp.scheduledAt)}</span>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${typeInfo.bg} ${typeInfo.text}`}
          >
            {getTypeIcon(followUp.type)}
            {followUp.type}
          </span>
        </div>

        {/* Note */}
        {followUp.note && (
          <p className="mt-2 text-xs leading-relaxed text-slate-600 line-clamp-2">
            {followUp.note}
          </p>
        )}
      </div>

      {/* Actions */}
      {statusInfo !== "Completed" && statusInfo !== "Cancelled" && (
        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCall(); }}
            className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
            aria-label={`Call ${followUp.lead?.name || "Unknown"}`}
          >
            <Phone aria-hidden="true" size={14} />
            Call
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onWhatsApp(); }}
            className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors"
            aria-label={`WhatsApp ${followUp.lead?.name || "Unknown"}`}
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onComplete(); }}
            disabled={isCompleting}
            className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 active:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            aria-label={`Mark ${followUp.lead?.name || "Unknown"} follow-up as complete`}
          >
            {isCompleting ? "..." : "Complete"}
          </button>
        </div>
      )}

      {statusInfo === "Completed" && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenLead(); }}
            className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Open Lead
          </button>
        </div>
      )}

      {(statusInfo === "Overdue" || statusInfo === "Upcoming" || statusInfo === "Today") && (
        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onReschedule(); }}
            className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            aria-label={`Reschedule follow-up with ${followUp.lead?.name || "Unknown"}`}
          >
            Reschedule
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCancel(); }}
            className="inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            aria-label={`Cancel follow-up with ${followUp.lead?.name || "Unknown"}`}
          >
            Cancel
          </button>
        </div>
      )}
    </ActionCard>
  );
}
