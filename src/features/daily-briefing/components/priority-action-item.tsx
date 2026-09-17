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
      className={`group relative rounded-xl border transition-all duration-150 ${
        item.isDone
          ? "border-slate-200 bg-slate-50/70 opacity-70"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
      }`}
    >
      <div className="p-3.5 sm:p-4">
        {/* Top bar: Rank, Title, Priority, Opportunity Value */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {/* Rank badge */}
            <span
              aria-hidden="true"
              className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold sm:size-7 sm:text-sm ${
                item.isDone
                  ? "bg-slate-200 text-slate-600"
                  : item.priority === "Critical"
                  ? "bg-rose-600 text-white"
                  : item.priority === "Important"
                  ? "bg-amber-500 text-white"
                  : "bg-blue-600 text-white"
              }`}
            >
              {rankIndex}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3
                  className={`text-sm font-semibold tracking-tight text-slate-900 sm:text-base ${
                    item.isDone ? "line-through text-slate-500" : ""
                  }`}
                >
                  {item.title}
                </h3>

                {/* Priority Badge */}
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border ${priority.bg} ${priority.text} ${priority.border}`}
                >
                  <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${priority.indicator}`}
                  />
                  {priority.label}
                </span>

                {/* Value pill if available */}
                {item.formattedValue && (
                  <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200/80">
                    {item.formattedValue}
                  </span>
                )}
              </div>

              {/* Subtitle & context */}
              <p className="mt-0.5 text-xs font-medium text-slate-600 sm:text-sm">
                {item.subtitle}
              </p>

              {/* Description */}
              {item.description && (
                <p className="mt-1 text-xs text-slate-500 line-clamp-2 sm:line-clamp-1">
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
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-100 pt-2.5 sm:gap-2">
          {/* Left: Quick contact actions */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            {/* Open Lead */}
            <button
              type="button"
              disabled={!item.leadId}
              onClick={() => onOpenLead(item)}
              aria-label={`Open lead profile for ${item.leadName || item.title}`}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <ExternalLink size={13} className="text-slate-500" />
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
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/70 px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-100/80 active:bg-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <Phone size={13} className="text-blue-600" />
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
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100/80 active:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <MessageCircle size={13} className="text-emerald-600" />
              <span>WhatsApp</span>
            </button>}

            {/* Add Follow-up */}
            <button
              type="button"
              disabled={!item.leadId}
              onClick={() => onAddFollowUp(item)}
              aria-label={`Add follow-up for ${item.leadName || item.title}`}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 px-2.5 text-xs font-medium text-amber-800 hover:bg-amber-100/80 active:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
            >
              <CalendarPlus size={13} className="text-amber-600" />
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
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                item.isDone
                  ? "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  : "bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 shadow-2xs"
              }`}
            >
              {item.isDone ? (
                <>
                  <RotateCcw size={13} />
                  <span>Undo</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} className="text-emerald-400" />
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
