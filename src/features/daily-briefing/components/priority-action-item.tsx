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
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    indicator: "bg-rose-500",
  },
  Important: {
    label: "Important",
    bg: "bg-amber-50",
    text: "text-amber-800",
    border: "border-amber-200",
    indicator: "bg-amber-500",
  },
  Normal: {
    label: "Normal",
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
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
  const priority = PRIORITY_CONFIG[item.priority];
  const telHref = item.phone ? getTelephoneHref(item.phone) : undefined;
  const { openWhatsApp } = useWhatsApp();

  return (
    <ActionCard onActivate={item.leadId ? () => onOpenLead(item) : undefined}
      aria-label={`${rankIndex}. ${item.title} - ${item.priority} priority`}
      className={`group relative rounded-2xl border transition-all duration-200 card-surface ${
        item.isDone
          ? "border-border/60 bg-muted/40 opacity-70"
          : "border-border bg-card card-hover"
      }`}
    >
      <div className="p-4 sm:p-5">
        {/* Top bar: Rank, Title, Priority, Opportunity Value */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            {/* Rank number in Lovable big tabular font */}
            <span
              aria-hidden="true"
              className={`text-[24px] sm:text-[28px] font-semibold leading-none tracking-tight tabular shrink-0 select-none ${
                item.isDone ? "text-muted-foreground/40" : "text-border group-hover:text-foreground/40 transition-colors"
              }`}
            >
              {String(rankIndex).padStart(2, "0")}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3
                  className={`text-[14.5px] font-semibold tracking-tight text-foreground sm:text-base ${
                    item.isDone ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {item.title}
                </h3>

                {/* Priority Badge */}
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium border ${priority.bg} ${priority.text} ${priority.border}`}
                >
                  <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${priority.indicator}`}
                  />
                  {priority.label}
                </span>

                {/* Value pill if available */}
                {item.formattedValue && (
                  <span className="inline-flex items-center rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-accent-foreground tabular">
                    {item.formattedValue}
                  </span>
                )}
              </div>

              {/* Subtitle & context */}
              <p className="mt-1 text-xs font-medium text-foreground/80 sm:text-sm">
                {item.subtitle}
              </p>

              {/* Description */}
              {item.description && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2 sm:line-clamp-1">
                  {item.description}
                </p>
              )}
            </div>
          </div>

          {/* Due indicator */}
          {item.dueTime && (
            <div className="shrink-0 text-right">
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                  item.dueTime.toLowerCase().includes("overdue")
                    ? "text-rose-600 font-semibold"
                    : "text-slate-500"
                }`}
              >
                <Clock size={12} aria-hidden="true" />
                <span>{item.dueTime}</span>
              </span>
            </div>
          )}
        </div>

        {/* Action button bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
          {/* Left: Quick contact actions */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Open Lead */}
            <button
              type="button"
              disabled={!item.leadId}
              onClick={() => onOpenLead(item)}
              aria-label={`Open lead profile for ${item.leadName || item.title}`}
              className="press inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[12px] font-medium text-foreground hover:bg-muted cursor-pointer"
            >
              <ExternalLink size={12} className="text-muted-foreground" />
              <span>Open Lead</span>
            </button>

            {/* Call */}
            {item.phone && <a
              href={telHref}
              onClick={(e) => {
                if (!item.phone) {
                  e.preventDefault();
                  onCall(item);
                }
              }}
              aria-label={`Call ${item.leadName || item.title} at ${item.phone || "phone"}`}
              className="press inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink px-2.5 text-[12px] font-medium text-ink-foreground hover:opacity-90 cursor-pointer"
            >
              <Phone size={12} />
              <span>Call</span>
            </a>}

            {/* WhatsApp */}
            {item.phone && <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!item.phone) {
                  e.preventDefault();
                  onWhatsApp(item);
                } else {
                  openWhatsApp({ id: item.leadId, name: item.leadName || item.title, phone: item.phone });
                }
              }}
              aria-label={`WhatsApp message ${item.leadName || item.title}`}
              className="press inline-flex h-8 items-center gap-1.5 rounded-lg bg-whatsapp px-2.5 text-[12px] font-medium text-whatsapp-foreground hover:opacity-90 cursor-pointer"
            >
              <MessageCircle size={12} />
              <span>WhatsApp</span>
            </button>}

            {/* Add Follow-up */}
            <button
              type="button"
              disabled={!item.leadId}
              onClick={() => onAddFollowUp(item)}
              aria-label={`Add follow-up for ${item.leadName || item.title}`}
              className="press inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[12px] font-medium text-foreground hover:bg-muted cursor-pointer"
            >
              <CalendarPlus size={12} className="text-muted-foreground" />
              <span>Add Follow-up</span>
            </button>
          </div>

          {/* Right: Mark Done Toggle */}
          <div className="shrink-0 ml-auto pt-1 sm:pt-0">
            <button
              type="button"
              onClick={() => onToggleDone(item.id)}
              aria-label={
                item.isDone
                  ? `Mark ${item.title} as incomplete`
                  : `Mark ${item.title} as completed`
              }
              className={`press inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium cursor-pointer transition-all ${
                item.isDone
                  ? "border border-border bg-card text-muted-foreground hover:text-foreground"
                  : "bg-ink text-ink-foreground hover:opacity-90 shadow-sm"
              }`}
            >
              {item.isDone ? (
                <>
                  <RotateCcw size={12} />
                  <span>Undo</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={13} className="text-sidebar-primary" />
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
