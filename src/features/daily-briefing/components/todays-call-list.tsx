"use client";

import type { BriefingCallItem } from "../types";
import { PhoneCall, Phone, MessageCircle, Clock, CheckCircle } from "lucide-react";
import { getTelephoneHref } from "@/features/leads/contact-links";
import { useWhatsApp } from "@/components/whatsapp-context";

export type TodaysCallListProps = {
  calls?: BriefingCallItem[];
  onOpenLead?: (leadId: string) => void;
  className?: string;
};

export function TodaysCallList({
  calls = [],
  onOpenLead,
  className = "",
}: TodaysCallListProps) {
  const { openWhatsApp } = useWhatsApp();

  return (
    <section
      aria-label="Today's Call List"
      className={`rounded-2xl border border-slate-200 dark:border-border bg-white dark:bg-card p-4 sm:p-5 shadow-xs ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-border/60">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <PhoneCall size={13} />
          </span>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Today&apos;s Call List
          </h2>
        </div>
        <span className="rounded-full bg-slate-100 dark:bg-muted px-2 py-0.5 text-xs font-semibold tabular text-slate-700 dark:text-muted-foreground">
          {calls.length}
        </span>
      </div>

      {/* List or Empty State */}
      {calls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="grid size-9 place-items-center rounded-full bg-slate-100 dark:bg-muted text-slate-400">
            <CheckCircle size={18} />
          </div>
          <p className="mt-2 text-xs font-semibold text-foreground">
            No calls scheduled for today
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            All pending follow-ups are up to date.
          </p>
        </div>
      ) : (
        <ol className="divide-y divide-slate-100 dark:divide-border/60">
          {calls.map((call) => {
            const telHref = call.phone ? getTelephoneHref(call.phone) : undefined;

            return (
              <li
                key={call.id}
                onClick={() => onOpenLead && onOpenLead(call.leadId)}
                className="group flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-slate-50/80 dark:hover:bg-muted/30 px-1 rounded-lg cursor-pointer"
              >
                {/* Left: Time and Client Info */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* Time pill */}
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-semibold tabular flex items-center gap-1 ${
                      call.isOverdue
                        ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"
                        : "bg-slate-100 dark:bg-muted text-slate-700 dark:text-muted-foreground"
                    }`}
                  >
                    <Clock size={10} />
                    <span>{call.timeFormatted}</span>
                  </span>

                  {/* Name and context */}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      {call.leadName}
                    </div>
                    {call.context && (
                      <div className="truncate text-[11px] text-muted-foreground">
                        {call.context}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Quick action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {call.phone && (
                    <a
                      href={telHref}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Call ${call.leadName}`}
                      className="press grid size-7 place-items-center rounded-md border border-slate-200 dark:border-border bg-white dark:bg-card text-foreground hover:bg-slate-100 dark:hover:bg-muted cursor-pointer transition-colors"
                    >
                      <Phone size={12} className="text-slate-700 dark:text-slate-300" />
                    </a>
                  )}

                  {call.phone && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openWhatsApp({
                          id: call.leadId,
                          name: call.leadName,
                          phone: call.phone,
                        });
                      }}
                      aria-label={`WhatsApp ${call.leadName}`}
                      className="press grid size-7 place-items-center rounded-md bg-emerald-600 dark:bg-emerald-700 text-white hover:bg-emerald-700 dark:hover:bg-emerald-600 cursor-pointer transition-colors"
                    >
                      <MessageCircle size={12} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
