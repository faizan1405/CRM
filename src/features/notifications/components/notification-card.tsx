"use client";

import {
  Phone,
  MessageCircle,
  CalendarPlus,
  CheckCircle2,
  X,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { ActionCard } from "@/components/action-card";
import type { SmartNotification } from "../types";
import { NotificationPriorityBadge } from "./notification-priority-badge";
import { getTelephoneHref } from "@/features/leads/contact-links";
import { WhatsAppButton } from "@/components/whatsapp-button";

interface NotificationCardProps {
  notification: SmartNotification;
  onOpenLead: (leadId: string) => void;
  onMarkDone: (id: string) => void;
  onDismiss: (id: string) => void;
  onAddFollowUp: (notification: SmartNotification) => void;
  onMarkRead?: (id: string) => void;
  className?: string;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  } catch {
    return dateString;
  }
}

export function NotificationCard({
  notification,
  onOpenLead,
  onMarkDone,
  onDismiss,
  onAddFollowUp,
  onMarkRead,
  className = "",
}: NotificationCardProps) {
  const isUnread = notification.status === "unread";
  const isResolved = notification.status === "resolved";
  const isCritical = notification.priority === "critical";

  const handleCardClick = () => {
    if (isUnread && onMarkRead) {
      onMarkRead(notification.id);
    }
  };

  return (
    <ActionCard
      aria-label={notification.leadId ? `Open lead ${notification.leadName}` : "Read notification"}
      onActivate={() => { handleCardClick(); if (notification.leadId) onOpenLead(notification.leadId); }}
      className={`group relative rounded-2xl border p-4 transition-all duration-150 ${
        isResolved
          ? "border-slate-200 bg-slate-50/70 opacity-75"
          : isCritical
          ? "border-rose-200/90 bg-gradient-to-br from-rose-50/30 via-white to-white shadow-xs hover:border-rose-300 hover:shadow-sm"
          : isUnread
          ? "border-blue-200/90 bg-blue-50/20 shadow-xs hover:border-blue-300 hover:shadow-sm"
          : "border-slate-200 bg-white shadow-2xs hover:border-slate-300 hover:shadow-sm"
      } ${className}`}
    >
      {/* Top Header: Unread Indicator + Priority + Type + Timestamp + Dismiss */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          {isUnread && (
            <span
              className="flex size-2 rounded-full bg-blue-600 ring-4 ring-blue-100 shrink-0"
              title="Unread notification"
              aria-label="Unread"
            />
          )}

          <NotificationPriorityBadge priority={notification.priority} size="sm" />

          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
            {notification.typeLabel}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          <span className="text-[11px] font-medium text-slate-400">
            {formatRelativeTime(notification.timestamp)}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(notification.id);
            }}
            className="grid size-7 place-items-center rounded-lg hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Dismiss notification"
            aria-label="Dismiss notification"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Main Lead Info & AI Explanation (WHY) */}
      <div className="mt-2.5 space-y-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h3 className="text-sm font-bold text-slate-950 truncate">
            {notification.leadName}
          </h3>
          {notification.business && (
            <span className="text-xs text-slate-500 truncate">
              · {notification.business}
            </span>
          )}
          {notification.amount && (
            <span className="text-xs font-semibold text-slate-700">
              · ₹{notification.amount.toLocaleString("en-IN")}
            </span>
          )}
        </div>

        {/* AI Reason / Explanation */}
        <p className="text-xs text-slate-700 leading-relaxed font-sans break-words">
          {notification.reason}
        </p>
      </div>

      {/* Recommended Action Pill */}
      {notification.recommendedAction && !isResolved && (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50/70 px-2.5 py-1.5 text-xs text-blue-900 font-medium">
          <Sparkles size={13} className="text-blue-600 shrink-0" aria-hidden="true" />
          <span className="font-semibold">Recommended:</span>
          <span className="truncate">{notification.recommendedAction}</span>
        </div>
      )}

      {/* Quick Action Buttons Toolbar */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        {/* Left Quick Contact Actions */}
        <div className="flex items-center gap-1">
          {notification.phone && (
            <>
              <a
                href={getTelephoneHref(notification.phone)}
                className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                aria-label={`Call ${notification.leadName}`}
                title="Call"
              >
                <Phone size={13} className="text-slate-500" aria-hidden="true" />
                <span className="hidden sm:inline">Call</span>
              </a>

              <WhatsAppButton
                lead={{ id: notification.leadId, name: notification.leadName, phone: notification.phone }}
                className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                aria-label={`WhatsApp ${notification.leadName}`}
                title="WhatsApp"
              >
                <MessageCircle size={13} className="text-emerald-600" aria-hidden="true" />
                <span className="hidden sm:inline">WhatsApp</span>
              </WhatsAppButton>
            </>
          )}

          <button
            type="button"
            disabled={!notification.leadId}
            onClick={() => onAddFollowUp(notification)}
            className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            title="Add Follow-up"
            aria-label="Add Follow-up"
          >
            <CalendarPlus size={13} className="text-slate-500" aria-hidden="true" />
            <span className="hidden sm:inline">Follow-up</span>
          </button>
        </div>

        {/* Right Status Actions */}
        <div className="flex items-center gap-1.5">
          {!isResolved && (
            <button
              type="button"
              onClick={() => onMarkDone(notification.id)}
              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200 transition-colors"
              title="Mark as resolved"
              aria-label="Mark done"
            >
              <CheckCircle2 size={13} aria-hidden="true" />
              <span>Done</span>
            </button>
          )}

          <button
            type="button"
            disabled={!notification.leadId}
            onClick={() => onOpenLead(notification.leadId)}
            className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800 transition-colors"
            aria-label={`Open lead record for ${notification.leadName}`}
          >
            <span>Open</span>
            <ExternalLink size={12} aria-hidden="true" />
          </button>
        </div>
      </div>
    </ActionCard>
  );
}
