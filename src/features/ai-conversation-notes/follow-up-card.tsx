"use client";

import { CalendarClock, Check, Pencil, Plus } from "lucide-react";
import { useState, useRef } from "react";
import { formatFollowUpCombined } from "./formatters";

interface FollowUpCardProps {
  date: string | null;
  time: string | null;
  onDateChange: (date: string | null) => void;
  onTimeChange: (time: string | null) => void;
  disabled?: boolean;
}

export function FollowUpCard({
  date,
  time,
  onDateChange,
  onTimeChange,
  disabled = false,
}: FollowUpCardProps) {
  const [accepted, setAccepted] = useState<boolean>(Boolean(date || time));
  const [showEditInputs, setShowEditInputs] = useState<boolean>(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const formattedSummary = formatFollowUpCombined(date, time);
  const hasFollowUp = Boolean(date || time);

  const handleAccept = () => {
    if (disabled) return;
    setAccepted(true);
    setShowEditInputs(false);
  };

  const handleStartChange = () => {
    if (disabled) return;
    setShowEditInputs(true);
    setAccepted(false);
    setTimeout(() => {
      dateInputRef.current?.focus();
    }, 50);
  };

  const handleAddFollowUp = () => {
    if (disabled) return;
    // Set default tomorrow at 10:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];
    onDateChange(dateStr);
    onTimeChange("10:00");
    setShowEditInputs(true);
    setAccepted(false);
  };

  return (
    <section
      aria-labelledby="follow-up-suggestion-heading"
      className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
            <CalendarClock className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h4
              id="follow-up-suggestion-heading"
              className="text-xs font-semibold uppercase tracking-wider text-blue-900"
            >
              Suggested Follow-up
            </h4>
            {hasFollowUp ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-base font-semibold text-slate-900">
                  {formattedSummary}
                </span>
                {accepted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                    <Check className="size-3" aria-hidden="true" />
                    Accepted
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                    Suggested
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-slate-200/80 px-2 py-0.5 text-xs font-medium text-slate-600">
                  Not provided
                </span>
                <span className="text-xs text-slate-500">No follow-up mentioned in notes</span>
              </div>
            )}
          </div>
        </div>

        {!hasFollowUp && !showEditInputs && (
          <button
            type="button"
            onClick={handleAddFollowUp}
            disabled={disabled}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 active:bg-blue-100 disabled:opacity-50"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>Add Follow-up</span>
          </button>
        )}
      </div>

      {/* Date / Time editor row */}
      {showEditInputs && (
        <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-blue-200 bg-white p-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="suggested-followup-date"
              className="block text-xs font-medium text-slate-700"
            >
              Date
            </label>
            <input
              id="suggested-followup-date"
              ref={dateInputRef}
              type="date"
              value={date || ""}
              onChange={(e) => onDateChange(e.target.value || null)}
              disabled={disabled}
              className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
            />
          </div>
          <div>
            <label
              htmlFor="suggested-followup-time"
              className="block text-xs font-medium text-slate-700"
            >
              Time
            </label>
            <input
              id="suggested-followup-time"
              type="time"
              value={time || ""}
              onChange={(e) => onTimeChange(e.target.value || null)}
              disabled={disabled}
              className="mt-1 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      {hasFollowUp && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleAccept}
            disabled={disabled || accepted}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed ${
              accepted
                ? "bg-emerald-600 text-white cursor-default"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            <Check className="size-4" aria-hidden="true" />
            <span>{accepted ? "Follow-up Accepted" : "Accept Follow-up"}</span>
          </button>

          <button
            type="button"
            onClick={handleStartChange}
            disabled={disabled}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:bg-slate-100 active:scale-[0.98] disabled:opacity-50"
          >
            <Pencil className="size-4 text-slate-500" aria-hidden="true" />
            <span>Change Date/Time</span>
          </button>
        </div>
      )}
    </section>
  );
}
