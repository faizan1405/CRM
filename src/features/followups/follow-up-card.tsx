"use client";

import { useMemo } from "react";
import { ActionCard } from "@/components/action-card";
import { Phone, CalendarClock, Star } from "lucide-react";
import type { FollowUp } from "./types";
import { formatFollowUpDate, formatTime, getFollowUpStatusInfo } from "./formatters";
import { getTypeIcon, typeStyles } from "./follow-up-types";
import { statusFromDatabase } from "@/features/leads/types";
import { cleanLeadName } from "@/features/leads/formatters";

const statusConfig: Record<
  string,
  { label: string; badgeClass: string; cardBg: string; leftBorder: string; hoverBorder: string }
> = {
  Overdue: {
    label: "Overdue",
    badgeClass: "bg-rose-50 text-rose-700 ring-1 ring-rose-300/70 border border-rose-200/60 font-semibold",
    cardBg: "bg-white",
    leftBorder: "border-l-[3.5px] border-l-rose-500",
    hoverBorder: "hover:border-rose-300/80",
  },
  Today: {
    label: "Follow up now",
    badgeClass: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300/70 border border-emerald-200/60 font-semibold",
    cardBg: "bg-white",
    leftBorder: "border-l-[3.5px] border-l-emerald-500",
    hoverBorder: "hover:border-emerald-300/80",
  },
  Upcoming: {
    label: "Future follow-up",
    badgeClass: "bg-blue-50 text-blue-700 ring-1 ring-blue-300/70 border border-blue-200/60 font-semibold",
    cardBg: "bg-white",
    leftBorder: "border-l-[3.5px] border-l-blue-400",
    hoverBorder: "hover:border-blue-300/80",
  },
  Cancelled: {
    label: "Cancelled",
    badgeClass: "bg-slate-100 text-slate-600 ring-1 ring-slate-200 font-semibold",
    cardBg: "bg-slate-50/40",
    leftBorder: "border-l-[3.5px] border-l-slate-300",
    hoverBorder: "hover:border-slate-300",
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
  onTogglePin,
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
  onTogglePin?: () => void;
  isCompleting?: boolean;
}) {
  const typeInfo = typeStyles[followUp.type] ?? typeStyles.Other;

  // Explicitly calculate timing status from actual scheduledAt date/time and status
  const timingKey = useMemo(() => {
    return getFollowUpStatusInfo(followUp);
  }, [followUp]);

  const status = statusConfig[timingKey] ?? statusConfig.Upcoming;
  const isPast = timingKey === "Overdue" || timingKey === "Cancelled";

  const isSystemNote = (n?: string) => {
    if (!n) return false;
    return n.includes("Imported from latest lead sheet") || n.includes("date supplied without exact time");
  };
  const displayNote = followUp.leadNote || (isSystemNote(followUp.note) ? "" : followUp.note);

  const rawLeadStatus = followUp.lead?.status;
  const canonicalStatus = rawLeadStatus
    ? (statusFromDatabase[rawLeadStatus as keyof typeof statusFromDatabase] ?? rawLeadStatus)
    : null;

  const railColor = timingKey === "Overdue" ? "bg-destructive" : timingKey === "Today" ? "bg-primary" : "bg-border";

  return (
    <ActionCard
      onActivate={onOpenLead}
      aria-label={`Open follow-up context for ${followUp.lead?.name || "lead"}`}
      className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all duration-200 card-hover ${
        isPast ? "opacity-95" : ""
      }`}
    >
      {/* Visual Accent Rail */}
      <span className={`absolute bottom-0 left-0 top-0 w-1 ${railColor}`} />

      {/* Top: Checkbox, Name, Status badges */}
      <div className="flex items-start justify-between gap-2.5 pl-2">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {onComplete && (
            followUp.status === "Completed" ? (
              <button
                type="button"
                aria-label="Move back to pending"
                onClick={(e) => {
                  e.stopPropagation();
                  onReschedule();
                }}
                className="press grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground ring-1 ring-inset ring-input hover:text-foreground mt-0.5"
              >
                <CalendarClock className="h-3 w-3" />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Mark completed"
                onClick={(e) => {
                  e.stopPropagation();
                  onComplete();
                }}
                className="press group/c grid h-6 w-6 shrink-0 place-items-center rounded-full ring-1 ring-inset ring-input transition-all duration-200 hover:bg-accent hover:ring-primary mt-0.5"
              >
                <svg className="h-3.5 w-3.5 scale-0 text-primary transition-transform duration-200 group-hover/c:scale-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            )
          )}

          {onTogglePin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
              aria-label={followUp.lead?.isPinned ? `Unpin ${followUp.lead?.name}` : `Pin ${followUp.lead?.name}`}
              title={followUp.lead?.isPinned ? "Unpin lead" : "Pin lead"}
              className="press inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 active:scale-95 transition-all shrink-0 mt-0.5 cursor-pointer"
            >
              <Star
                size={14}
                className={followUp.lead?.isPinned ? "fill-amber-400 text-amber-500" : "text-muted-foreground hover:text-amber-500"}
              />
            </button>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-foreground text-[14.5px] leading-snug">
              {cleanLeadName(followUp.lead?.name) || "Unknown"}
            </h3>
            {followUp.lead?.business && (
              <p className="truncate text-xs text-muted-foreground mt-0.5">
                {followUp.lead.business}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 flex-wrap justify-end">
          {canonicalStatus && (
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
                canonicalStatusStyles[canonicalStatus] ?? "bg-muted text-muted-foreground ring-border"
              }`}
            >
              {canonicalStatus}
            </span>
          )}
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${status.badgeClass}`}
          >
            {status.label}
          </span>
        </div>
      </div>

      {/* Middle: Schedule, Type & Phone */}
      <div className="mt-2.5 flex flex-col gap-2 pl-2">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-xs">
          {followUp.lead?.phone ? (
            <a
              href={`tel:${followUp.lead.phone}`}
              onClick={(e) => {
                e.stopPropagation();
                onCall();
              }}
              className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors"
              aria-label={`Call ${followUp.lead.phone}`}
            >
              <Phone aria-hidden="true" size={13} className="text-muted-foreground" />
              <span className="tabular">{followUp.lead.phone}</span>
            </a>
          ) : (
            <span className="text-muted-foreground text-xs italic">No phone</span>
          )}

          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-medium text-foreground tabular">
              <CalendarClock aria-hidden="true" size={13} className="text-muted-foreground" />
              <span>{formatFollowUpDate(followUp.scheduledAt)} · {formatTime(followUp.scheduledAt)}</span>
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
          <div className="rounded-lg bg-muted/60 border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground leading-relaxed">
            <p className="line-clamp-2" title={displayNote}>
              {displayNote}
            </p>
          </div>
        ) : null}
      </div>

      {/* Bottom Actions: Call, WhatsApp, Reschedule */}
      {timingKey !== "Cancelled" ? (
        <div
          className="mt-3 flex items-center gap-2 border-t border-border/60 pt-2.5 pl-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onCall();
            }}
            className="flex-1 press inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-ink px-3 text-[12px] font-medium text-ink-foreground hover:opacity-90 cursor-pointer"
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
            className="flex-1 press inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-whatsapp px-3 text-[12px] font-medium text-whatsapp-foreground hover:opacity-90 cursor-pointer"
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
            className="flex-1 press inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[12px] font-medium text-foreground hover:bg-muted cursor-pointer"
            aria-label={`Reschedule follow-up for ${followUp.lead?.name || "lead"}`}
          >
            <CalendarClock aria-hidden="true" size={13} className="text-muted-foreground" />
            <span>Reschedule</span>
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onCancel();
              }}
              title="Cancel follow-up"
              className="press grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive cursor-pointer"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 border-t border-border/60 pt-2.5 pl-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onOpenLead();
            }}
            className="w-full press inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted"
          >
            Open Lead
          </button>
        </div>
      )}
    </ActionCard>
  );
}
