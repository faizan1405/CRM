"use client";

import { useMemo } from "react";
import { ActionCard } from "@/components/action-card";
import { Phone, CalendarClock } from "lucide-react";
import type { FollowUp } from "./types";
import { formatFollowUpDate, formatTime, getFollowUpStatusInfo } from "./formatters";
import { getTypeIcon, typeStyles } from "./follow-up-types";
import { statusFromDatabase } from "@/features/leads/types";

const statusConfig: Record<
  string,
  { label: string; badgeClass: string; cardBg: string; leftBorder: string; hoverBorder: string }
> = {
  Overdue: {
    label: "Overdue",
    badgeClass: "bg-red-100 text-red-800 ring-red-200",
    cardBg: "bg-red-50/50",
    leftBorder: "border-l-4 border-l-red-500",
    hoverBorder: "hover:border-red-300",
  },
  Today: {
    label: "Follow up now",
    badgeClass: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    cardBg: "bg-emerald-50/50",
    leftBorder: "border-l-4 border-l-emerald-500",
    hoverBorder: "hover:border-emerald-300",
  },
  Upcoming: {
    label: "Future follow-up",
    badgeClass: "bg-amber-100 text-amber-800 ring-amber-200",
    cardBg: "bg-amber-50/50",
    leftBorder: "border-l-4 border-l-amber-500",
    hoverBorder: "hover:border-amber-300",
  },
  Completed: {
    label: "Done",
    badgeClass: "bg-slate-100 text-slate-700 ring-slate-200",
    cardBg: "bg-slate-50/60",
    leftBorder: "border-l-4 border-l-slate-400",
    hoverBorder: "hover:border-slate-300",
  },
  Cancelled: {
    label: "Cancelled",
    badgeClass: "bg-slate-100 text-slate-600 ring-slate-200",
    cardBg: "bg-slate-50/60",
    leftBorder: "border-l-4 border-l-slate-300",
    hoverBorder: "hover:border-slate-200",
  },
};

const canonicalStatusStyles: Record<string, string> = {
  New: "bg-blue-50 text-blue-700 ring-blue-600/20",
  Contacted: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  Qualified: "bg-purple-50 text-purple-700 ring-purple-600/20",
  "Proposal Sent": "bg-amber-50 text-amber-700 ring-amber-600/20",
  Won: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Lost: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

export function FollowUpCard({
  followUp,
  statusInfo: initialStatusInfo,
  onCall,
  onWhatsApp,
  onComplete,
  onReschedule,
  onCancel,
  onOpenLead,
  isCompleting = false,
}: {
  followUp: FollowUp;
  statusInfo?: string;
  onCall: () => void;
  onWhatsApp: () => void;
  onComplete?: () => void;
  onReschedule: () => void;
  onCancel?: () => void;
  onOpenLead: () => void;
  isCompleting?: boolean;
}) {
  const typeInfo = typeStyles[followUp.type] ?? typeStyles.Other;

  // Explicitly calculate timing status from actual scheduledAt date/time and status
  const timingKey = useMemo(() => {
    return getFollowUpStatusInfo(followUp);
  }, [followUp]);

  const status = statusConfig[timingKey] ?? statusConfig.Upcoming;
  const isPast = timingKey === "Overdue" || timingKey === "Completed" || timingKey === "Cancelled";

  const isSystemNote = (n?: string) => {
    if (!n) return false;
    return n.includes("Imported from latest lead sheet") || n.includes("date supplied without exact time");
  };
  const displayNote = followUp.leadNote || (isSystemNote(followUp.note) ? "" : followUp.note);

  const rawLeadStatus = followUp.lead?.status;
  const canonicalStatus = rawLeadStatus
    ? (statusFromDatabase[rawLeadStatus as keyof typeof statusFromDatabase] ?? rawLeadStatus)
    : null;

  return (
    <ActionCard
      onActivate={onOpenLead}
      aria-label={`Open follow-up context for ${followUp.lead?.name || "lead"}`}
      className={`rounded-xl border ${status.cardBg} ${status.leftBorder} ${status.hoverBorder} border-slate-200/80 p-3.5 sm:p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all ${
        isPast ? "opacity-90" : ""
      }`}
    >
      {/* Top: Lead name, timing badge, canonical status */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-slate-900 text-[15px] leading-snug">
            {followUp.lead?.name || "Unknown"}
          </h3>
          {followUp.lead?.business && (
            <p className="truncate text-xs text-slate-500 mt-0.5">
              {followUp.lead.business}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 flex-wrap justify-end">
          {canonicalStatus && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                canonicalStatusStyles[canonicalStatus] ?? "bg-slate-100 text-slate-700 ring-slate-200"
              }`}
            >
              {canonicalStatus}
            </span>
          )}
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${status.badgeClass}`}
          >
            {status.label}
          </span>
        </div>
      </div>

      {/* Middle: phone number, follow-up date/time, follow-up type, short latest meaningful note */}
      <div className="mt-2.5 flex flex-col gap-2">
        {/* Schedule, Type & Phone */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-xs">
          {followUp.lead?.phone ? (
            <a
              href={`tel:${followUp.lead.phone}`}
              onClick={(e) => {
                e.stopPropagation();
                onCall();
              }}
              className="inline-flex items-center gap-1.5 font-medium text-slate-700 hover:text-blue-600 transition-colors"
              aria-label={`Call ${followUp.lead.phone}`}
            >
              <Phone aria-hidden="true" size={13} className="text-slate-400" />
              <span>{followUp.lead.phone}</span>
            </a>
          ) : (
            <span className="text-slate-400 text-xs italic">No phone</span>
          )}

          <div className="flex items-center gap-2 text-slate-600">
            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
              <CalendarClock aria-hidden="true" size={13} className="text-slate-400" />
              <span>{formatFollowUpDate(followUp.scheduledAt)} &middot; {formatTime(followUp.scheduledAt)}</span>
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${typeInfo.bg} ${typeInfo.text}`}
            >
              {getTypeIcon(followUp.type)}
              {followUp.type}
            </span>
          </div>
        </div>

        {/* Short latest meaningful note */}
        {displayNote ? (
          <div className="rounded-lg bg-slate-900/[0.03] border border-slate-900/[0.05] px-2.5 py-1.5 text-xs text-slate-600 leading-relaxed">
            <p className="line-clamp-2" title={displayNote}>
              {displayNote}
            </p>
          </div>
        ) : null}
      </div>

      {/* Bottom: Call, WhatsApp, Reschedule */}
      {timingKey !== "Completed" && timingKey !== "Cancelled" ? (
        <div
          className="mt-3 flex items-center gap-2 border-t border-slate-100/90 pt-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onCall();
            }}
            className="flex-1 inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 active:bg-blue-200 transition-colors"
            aria-label={`Call ${followUp.lead?.name || "lead"}`}
          >
            <Phone aria-hidden="true" size={13} />
            <span>Call</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onWhatsApp();
            }}
            className="flex-1 inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 active:bg-emerald-200 transition-colors"
            aria-label={`WhatsApp ${followUp.lead?.name || "lead"}`}
          >
            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            <span>WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onReschedule();
            }}
            className="flex-1 inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-slate-200/90 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-sm"
            aria-label={`Reschedule follow-up for ${followUp.lead?.name || "lead"}`}
          >
            <CalendarClock aria-hidden="true" size={13} className="text-slate-500" />
            <span>Reschedule</span>
          </button>
        </div>
      ) : (
        <div className="mt-3 border-t border-slate-100/90 pt-2.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onOpenLead();
            }}
            className="w-full inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-slate-200/90 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-sm"
          >
            Open Lead
          </button>
        </div>
      )}
    </ActionCard>
  );
}
