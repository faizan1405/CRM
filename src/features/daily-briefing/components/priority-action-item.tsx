"use client";

import { ActionCard } from "@/components/action-card";
import type { BriefingActionItem, BriefingPriority } from "../types";
import {
  Phone,
  MessageCircle,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  Clock,
  Sparkles,
} from "lucide-react";
import { getTelephoneHref } from "@/features/leads/contact-links";
import { useWhatsApp } from "@/components/whatsapp-context";

type PriorityActionItemProps = {
  item: BriefingActionItem;
  rankIndex: number;
  onOpenLead: (item: BriefingActionItem) => void;
  onCall: (item: BriefingActionItem) => void;
  onWhatsApp: (item: BriefingActionItem) => void;
  onAddFollowUp: (item: BriefingActionItem) => void;
  onToggleDone: (itemId: string) => void;
};

const PRIORITY_CONFIG: Record<
  BriefingPriority,
  { label: string; bg: string; text: string; border: string; indicator: string }
> = {
  Critical: {
    label: "Critical",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-900/50",
    indicator: "bg-rose-500",
  },
  Important: {
    label: "Important",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-800 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-900/50",
    indicator: "bg-amber-500",
  },
  Normal: {
    label: "Normal",
    bg: "bg-slate-100 dark:bg-slate-800/40",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-200 dark:border-border",
    indicator: "bg-slate-400",
  },
};

export function PriorityActionItem({
  item,
  rankIndex,
  onOpenLead,
  onCall,
  onWhatsApp,
  onAddFollowUp,
  onToggleDone,
}: PriorityActionItemProps) {
  const priority = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.Normal;
  const telHref = item.phone ? getTelephoneHref(item.phone) : undefined;
  const { openWhatsApp } = useWhatsApp();

  const isOverdue =
    Boolean(item.dueTime?.toLowerCase().includes("overdue")) ||
    Boolean(item.tag?.toLowerCase().includes("overdue"));

  return (
    <ActionCard
      onActivate={item.leadId ? () => onOpenLead(item) : undefined}
      aria-label={`${rankIndex}. ${item.title} - ${item.priority} priority`}
      className={`group relative rounded-xl border transition-all duration-200 ${
        item.isDone
          ? "border-slate-200/60 dark:border-border/60 bg-slate-50/60 dark:bg-muted/20 opacity-70"
          : "border-slate-200 dark:border-border bg-white dark:bg-card hover:border-slate-300 dark:hover:border-border/80 hover:shadow-xs"
      }`}
    >
      <div className="p-3.5 sm:p-4">
        {/* Main top row: Rank, Lead Name, Badges, Due Time */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Rank number in Lovable subtle font */}
            <span
              aria-hidden="true"
              className={`text-[20px] sm:text-[24px] font-bold leading-none tracking-tight tabular shrink-0 select-none ${
                item.isDone
                  ? "text-muted-foreground/30"
                  : "text-slate-300 dark:text-muted-foreground/40 group-hover:text-foreground/40 transition-colors"
              }`}
            >
              {String(rankIndex).padStart(2, "0")}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3
                  className={`text-[14px] sm:text-[15px] font-semibold tracking-tight text-foreground ${
                    item.isDone ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {item.title}
                </h3>

                {/* Priority Badge */}
                <span
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium border ${priority.bg} ${priority.text} ${priority.border}`}
                >
                  <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${priority.indicator}`}
                  />
                  {priority.label}
                </span>

                {/* Opportunity Value badge if available */}
                {item.formattedValue && (
                  <span className="inline-flex items-center rounded bg-slate-100 dark:bg-muted px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-800 dark:text-muted-foreground tabular">
                    {item.formattedValue}
                  </span>
                )}
              </div>

              {/* Subtitle / context description */}
              {item.subtitle && (
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                  {item.subtitle}
                </p>
              )}

              {/* Recommended action note */}
              {item.recommendedAction && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  <Sparkles size={11} className="shrink-0 text-emerald-500" />
                  <span className="truncate">{item.recommendedAction}</span>
                </div>
              )}
            </div>
          </div>

          {/* Due time tag */}
          {item.dueTime && (
            <div className="shrink-0 text-right">
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                  isOverdue
                    ? "text-rose-600 dark:text-rose-400 font-semibold"
                    : "text-slate-500 dark:text-muted-foreground"
                }`}
              >
                <Clock size={11} aria-hidden="true" />
                <span>{item.dueTime}</span>
              </span>
            </div>
          )}
        </div>

        {/* Action button bar */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-border/60 pt-2.5">
          {/* Left: Quick contact actions */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            {/* Open Lead */}
            <button
              type="button"
              disabled={!item.leadId}
              onClick={(e) => {
                e.stopPropagation();
                onOpenLead(item);
              }}
              aria-label={`Open lead profile for ${item.leadName || item.title}`}
              className="press inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 dark:border-border bg-white dark:bg-card px-2 text-[11.5px] font-medium text-foreground hover:bg-slate-50 dark:hover:bg-muted cursor-pointer"
            >
              <ExternalLink size={11} className="text-muted-foreground" />
              <span>Open Lead</span>
            </button>

            {/* Call */}
            {item.phone && (
              <a
                href={telHref}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!item.phone) {
                    e.preventDefault();
                    onCall(item);
                  }
                }}
                aria-label={`Call ${item.leadName || item.title} at ${item.phone}`}
                className="press inline-flex h-7 items-center gap-1 rounded-md bg-slate-900 dark:bg-slate-800 text-white px-2 text-[11.5px] font-medium hover:bg-slate-800 dark:hover:bg-slate-700 cursor-pointer"
              >
                <Phone size={11} />
                <span>Call</span>
              </a>
            )}

            {/* WhatsApp */}
            {item.phone && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!item.phone) {
                    onWhatsApp(item);
                  } else {
                    openWhatsApp({
                      id: item.leadId,
                      name: item.leadName || item.title,
                      phone: item.phone,
                    });
                  }
                }}
                aria-label={`WhatsApp message ${item.leadName || item.title}`}
                className="press inline-flex h-7 items-center gap-1 rounded-md bg-emerald-600 dark:bg-emerald-700 text-white px-2 text-[11.5px] font-medium hover:bg-emerald-700 dark:hover:bg-emerald-600 cursor-pointer"
              >
                <MessageCircle size={11} />
                <span>WhatsApp</span>
              </button>
            )}

            {/* Add Follow-up */}
            <button
              type="button"
              disabled={!item.leadId}
              onClick={(e) => {
                e.stopPropagation();
                onAddFollowUp(item);
              }}
              aria-label={`Add follow-up for ${item.leadName || item.title}`}
              className="press inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 dark:border-border bg-white dark:bg-card px-2 text-[11.5px] font-medium text-foreground hover:bg-slate-50 dark:hover:bg-muted cursor-pointer"
            >
              <CalendarPlus size={11} className="text-muted-foreground" />
              <span>Follow-up</span>
            </button>
          </div>

          {/* Right: Mark Done Toggle */}
          <div className="shrink-0 ml-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleDone(item.id);
              }}
              aria-label={
                item.isDone
                  ? `Mark ${item.title} as incomplete`
                  : `Mark ${item.title} as completed`
              }
              className={`press inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11.5px] font-medium cursor-pointer transition-all ${
                item.isDone
                  ? "border border-slate-200 dark:border-border bg-white dark:bg-card text-muted-foreground hover:text-foreground"
                  : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 shadow-2xs"
              }`}
            >
              {item.isDone ? (
                <>
                  <RotateCcw size={11} />
                  <span>Undo</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  <span>Mark Done</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </ActionCard>
  );
}
