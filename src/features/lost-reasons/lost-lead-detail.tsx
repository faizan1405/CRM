"use client";

import React from "react";
import {
  DollarSign,
  PhoneOff,
  Clock,
  Users,
  ShieldAlert,
  UserX,
  RefreshCw,
  Hourglass,
  HelpCircle,
  XCircle,
  Calendar,
  FileText,
} from "lucide-react";
import type { LostLeadDetailProps, LostReason } from "./types";
import { LOST_REASON_DETAILS } from "./types";

function getReasonIcon(reason: LostReason | string) {
  const meta = LOST_REASON_DETAILS[reason as LostReason];
  if (!meta) return <XCircle className="size-4 shrink-0 text-rose-600" aria-hidden="true" />;

  switch (meta.iconName) {
    case "DollarSign":
      return <DollarSign className="size-4 shrink-0 text-rose-600" aria-hidden="true" />;
    case "PhoneOff":
      return <PhoneOff className="size-4 shrink-0 text-rose-600" aria-hidden="true" />;
    case "Clock":
      return <Clock className="size-4 shrink-0 text-rose-600" aria-hidden="true" />;
    case "Users":
      return <Users className="size-4 shrink-0 text-rose-600" aria-hidden="true" />;
    case "ShieldAlert":
      return <ShieldAlert className="size-4 shrink-0 text-rose-600" aria-hidden="true" />;
    case "UserX":
      return <UserX className="size-4 shrink-0 text-rose-600" aria-hidden="true" />;
    case "RefreshCw":
      return <RefreshCw className="size-4 shrink-0 text-rose-600" aria-hidden="true" />;
    case "Hourglass":
      return <Hourglass className="size-4 shrink-0 text-rose-600" aria-hidden="true" />;
    case "HelpCircle":
    default:
      return <HelpCircle className="size-4 shrink-0 text-rose-600" aria-hidden="true" />;
  }
}

export function LostLeadDetail({
  reason,
  lostAt,
  notes,
  leadName,
  className = "",
  compact = false,
}: LostLeadDetailProps) {
  const formattedDate = React.useMemo(() => {
    if (!lostAt) return null;
    if (typeof lostAt === "string") return lostAt;
    try {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(lostAt);
    } catch {
      return String(lostAt);
    }
  }, [lostAt]);

  const meta = LOST_REASON_DETAILS[reason as LostReason];
  const shortCode = meta?.shortCode ?? "LOST";

  if (compact) {
    return (
      <div
        className={`inline-flex flex-wrap items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50/70 px-2.5 py-1 text-xs font-medium text-rose-900 ${className}`}
        role="status"
        aria-label={`Lost lead. Reason: ${reason}${formattedDate ? `, on ${formattedDate}` : ""}`}
      >
        <span className="flex items-center gap-1">
          {getReasonIcon(reason)}
          <span className="font-semibold tracking-tight">Lost — {reason}</span>
        </span>
        {formattedDate && (
          <span className="text-rose-700/80">· {formattedDate}</span>
        )}
      </div>
    );
  }

  return (
    <article
      className={`rounded-xl border border-rose-200/90 bg-gradient-to-br from-rose-50/60 to-white p-4 shadow-sm transition-all sm:p-5 ${className}`}
      aria-labelledby="lost-detail-heading"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-rose-100 text-rose-700 ring-1 ring-rose-200">
            {getReasonIcon(reason)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4
                id="lost-detail-heading"
                className="text-base font-bold tracking-tight text-rose-950 sm:text-lg"
              >
                Lost — {reason}
              </h4>
              <span
                className="rounded border border-rose-200 bg-rose-100/70 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-rose-800 uppercase"
                aria-hidden="true"
              >
                {shortCode}
              </span>
            </div>
            {leadName && (
              <p className="text-xs text-slate-600">Lead: {leadName}</p>
            )}
          </div>
        </div>

        {formattedDate && (
          <div className="flex items-center gap-1 text-xs font-medium text-slate-600 sm:text-sm">
            <Calendar className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <time dateTime={typeof lostAt === "string" ? lostAt : lostAt?.toISOString()}>
              {formattedDate}
            </time>
          </div>
        )}
      </header>

      {notes ? (
        <div className="mt-3.5 rounded-lg border border-slate-200/80 bg-white/90 p-3 shadow-xs">
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <p className="break-words text-sm leading-relaxed text-slate-800">
              {notes}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs italic text-slate-400">
          No additional notes recorded.
        </p>
      )}
    </article>
  );
}
