"use client";

import { useDialogAccessibility } from "@/components/use-dialog-accessibility";
import { useEffect, useId, useRef, useState } from "react";
import type { FollowUp, FollowUpType, NewFollowUpInput } from "./types";
import { followUpTypes } from "./types";
import { getPresetDate, FOLLOW_UP_PRESETS, DEFAULT_TIME } from "@/lib/date-presets";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  formatFollowUpWarning,
  type FollowUpSuggestion,
} from "@/lib/follow-up-suggestions";

type ExistingFollowUpData = {
  id: string;
  scheduledAt: string | Date;
  status?: string;
  type?: string;
};

export type FollowUpFormProps = {
  isOpen: boolean;
  followUp?: FollowUp | null;
  defaultLeadId?: string;
  leads?: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (data: NewFollowUpInput & { mode?: "reschedule" | "create" }) => void;
  saving?: boolean;
  suggestion?: FollowUpSuggestion | null;
  existingFollowUp?: ExistingFollowUpData | null;
  initialPreset?: string | null;
};

const todayStr = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export function FollowUpForm({
  isOpen,
  followUp,
  defaultLeadId,
  leads = [],
  onClose,
  onSubmit,
  saving = false,
  suggestion = null,
  existingFollowUp = null,
  initialPreset = null,
}: FollowUpFormProps) {
  const [type, setType] = useState<FollowUpType>(followUp?.type ?? "Call");
  const [scheduledDate, setScheduledDate] = useState(todayStr);
  const [scheduledTime, setScheduledTime] = useState(DEFAULT_TIME);
  const [note, setNote] = useState("");
  const [leadId, setLeadId] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [isChanging, setIsChanging] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState<"reschedule" | "create">("reschedule");
  const submissionIdRef = useRef<string>("");
  const firstLeadId = leads[0]?.id || "";
  const formId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useDialogAccessibility(isOpen, onClose, saving, closeButtonRef);

  // Detect active existing follow-up for duplicate warning
  const effectiveExisting =
    existingFollowUp ||
    (followUp && String(followUp.status).toUpperCase() === "PENDING" ? followUp : null);

  useEffect(() => {
    if (isOpen) {
      submissionIdRef.current = `fu-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setDuplicateMode("reschedule");
    }

    if (isOpen && suggestion) {
      setType(suggestion.defaultType || "Call");
      setNote("");
      setLeadId(defaultLeadId ?? firstLeadId);
      setIsChanging(suggestion.requiresExactDateTime);

      if (suggestion.requiresExactDateTime) {
        setSelectedPreset(null);
        setScheduledDate("");
        setScheduledTime("");
      } else {
        setSelectedPreset(suggestion.presetId);
        setScheduledDate(suggestion.suggestedDate);
        setScheduledTime(suggestion.suggestedTime || DEFAULT_TIME);
      }
    } else if (isOpen && followUp && !suggestion) {
      setType(followUp.type);
      setNote(followUp.leadNote || followUp.note);
      setLeadId(followUp.leadId);
      setIsChanging(true);
      if (followUp.scheduledAt) {
        const d = new Date(followUp.scheduledAt);
        setScheduledDate(d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
        setScheduledTime(
          d.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })
        );
      }
    } else if (isOpen && !followUp && !suggestion) {
      setType("Call");
      setIsChanging(true);
      setNote("");
      setLeadId(defaultLeadId ?? firstLeadId);
      if (initialPreset) {
        setSelectedPreset(initialPreset);
        const preset = FOLLOW_UP_PRESETS.find((p) => p.id === initialPreset);
        if (preset) {
          setScheduledDate(getPresetDate(preset.days));
          setScheduledTime(DEFAULT_TIME);
        } else {
          setScheduledDate(todayStr());
          setScheduledTime(DEFAULT_TIME);
        }
      } else {
        setSelectedPreset(null);
        setScheduledDate(todayStr());
        setScheduledTime(DEFAULT_TIME);
      }
    }
  }, [isOpen, followUp, suggestion, defaultLeadId, firstLeadId, initialPreset]);

  if (!isOpen) return null;

  const handlePresetClick = (preset: (typeof FOLLOW_UP_PRESETS)[number]) => {
    setSelectedPreset(preset.id);
    if (preset.id === "instant") {
      const now = new Date();
      const istDate = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const istTime = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
      setScheduledDate(istDate);
      setScheduledTime(istTime);
    } else {
      setScheduledDate(getPresetDate(preset.days));
      if (!scheduledTime || selectedPreset === "instant") {
        setScheduledTime(DEFAULT_TIME);
      }
    }
  };

  const handleSubmit = (overrideMode?: "reschedule" | "create") => {
    if (!leadId || !scheduledDate || !scheduledTime) return;
    const finalMode = overrideMode || duplicateMode || (effectiveExisting ? "reschedule" : undefined);
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00+05:30`).toISOString();
    onSubmit({
      ...(finalMode === "reschedule" && effectiveExisting?.id
        ? { id: effectiveExisting.id }
        : followUp?.id && !effectiveExisting
        ? { id: followUp.id }
        : {}),
      leadId,
      type,
      scheduledAt,
      note: note.trim(),
      submissionId: submissionIdRef.current,
      mode: finalMode,
    });
  };

  const inputClass =
    "mt-1.5 h-11 min-w-0 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm";

  const title = suggestion
    ? suggestion.requiresExactDateTime
      ? "Choose Callback Date & Time"
      : "Suggested follow-up"
    : followUp
    ? "Edit Follow-up"
    : "New Follow-up";

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      saving={saving}
      footer={
        effectiveExisting ? (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
              >
                Keep Existing
              </button>
              <button
                type="button"
                onClick={() => handleSubmit("reschedule")}
                disabled={saving || !leadId || !scheduledDate || !scheduledTime}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-amber-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {saving && duplicateMode === "reschedule" ? "Saving..." : "Replace/Reschedule"}
              </button>
            </div>
          </div>
        ) : suggestion && !isChanging ? (
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[15px] font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => setIsChanging(true)}
              disabled={saving}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 text-[15px] font-semibold text-blue-700 hover:bg-blue-100 active:bg-blue-200 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={saving || !leadId || !scheduledDate || !scheduledTime}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 text-[15px] font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {saving ? "Saving..." : "Schedule"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 w-full">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[15px] font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form={formId}
              disabled={saving || !leadId || !scheduledDate || !scheduledTime}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 text-[15px] font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {saving ? "Saving..." : followUp ? "Update" : "Schedule"}
            </button>
          </div>
        )
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
        className="space-y-4"
      >
        {/* Existing Follow-up Duplicate Warning */}
        {effectiveExisting && (
          <div
            role="alert"
            className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-amber-900 shadow-xs space-y-2"
          >
            <p className="text-xs sm:text-[13px] font-semibold flex items-center gap-1.5">
              <span>⚠️</span>
              <span>{formatFollowUpWarning(effectiveExisting.scheduledAt)}</span>
            </p>
            <p className="text-[11px] text-amber-800">
              A follow-up is already active for this lead. A lead can only have one active follow-up at a time. Choose to keep existing or replace/reschedule it.
            </p>
          </div>
        )}

        {/* Suggestion Card (when suggestion active) */}
        {suggestion && !suggestion.requiresExactDateTime && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 shadow-xs flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Suggested follow-up</p>
              <p className="text-base font-bold text-blue-950 mt-0.5">{suggestion.displayFullLabel}</p>
            </div>
            {!isChanging && (
              <button
                type="button"
                onClick={() => setIsChanging(true)}
                className="text-xs font-bold text-blue-700 underline underline-offset-2 hover:text-blue-900 cursor-pointer"
              >
                Change
              </button>
            )}
          </div>
        )}

        {/* Lead Selector */}
        <div>
          <label htmlFor={`${formId}-lead`} className="mb-1.5 block text-[13px] font-semibold text-slate-700">
            Lead <span className="text-red-500">*</span>
          </label>
          <select
            id={`${formId}-lead`}
            value={leadId}
            onChange={(e) => setLeadId(e.target.value)}
            className={inputClass}
            required
            disabled={saving || (!!followUp && !suggestion)}
          >
            <option value="" disabled>Select a lead</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
            {followUp?.lead && !leads.some((l) => l.id === followUp.leadId) && (
              <option value={followUp.leadId}>{followUp.lead.name}</option>
            )}
          </select>
        </div>

        {/* Call Back explicit instruction */}
        {suggestion?.requiresExactDateTime && (
          <div className="rounded-xl border border-violet-200 bg-violet-50/80 p-3 text-xs text-violet-900 font-medium">
            Please choose an exact callback date and time before confirming.
          </div>
        )}

        {/* Date & Time Section */}
        <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
          <div>
            <label htmlFor={`${formId}-date`} className="mb-1.5 block text-[13px] font-semibold text-slate-700">
              {suggestion?.requiresExactDateTime ? "Choose callback date" : "Date"} <span className="text-red-500">*</span>
            </label>
            {!suggestion?.requiresExactDateTime && (
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {FOLLOW_UP_PRESETS.map((preset) => {
                  const isSelected = selectedPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      data-preset={preset.id}
                      aria-pressed={isSelected}
                      aria-label={preset.id === "instant" ? "Instant follow-up" : preset.label}
                      onClick={() => handlePresetClick(preset)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all shadow-sm ${
                        isSelected
                          ? "border-2 border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/25"
                          : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            )}
            <input
              id={`${formId}-date`}
              type="date"
              value={scheduledDate}
              onChange={(e) => {
                setScheduledDate(e.target.value);
                setSelectedPreset(null);
              }}
              className={inputClass}
              required
              disabled={saving}
            />
          </div>
          <div>
            <label htmlFor={`${formId}-time`} className="mb-1.5 block text-[13px] font-semibold text-slate-700">
              {suggestion?.requiresExactDateTime ? "Choose callback time" : "Time"} <span className="text-red-500">*</span>
            </label>
            <input
              id={`${formId}-time`}
              type="time"
              value={scheduledTime}
              onChange={(e) => {
                setScheduledTime(e.target.value);
                setSelectedPreset(null);
              }}
              className={inputClass}
              required
              disabled={saving}
            />
          </div>
        </div>

        {/* Type Selection */}
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
            Type
          </label>
          <div className="flex flex-wrap gap-2">
            {followUpTypes.map((t) => (
              <button
                key={t}
                aria-pressed={type === t}
                type="button"
                onClick={() => setType(t)}
                disabled={saving}
                className={`rounded-xl border px-3 py-2 text-[13px] font-semibold transition-colors ${
                  type === t
                    ? "border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Note */}
        <div>
          <label htmlFor={`${formId}-note`} className="mb-1.5 block text-[13px] font-semibold text-slate-700">
            Note
          </label>
          <textarea
            id={`${formId}-note`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className={`${inputClass} h-auto resize-none py-3`}
            placeholder="Add a note about this follow-up..."
            disabled={saving}
          />
        </div>
      </form>
    </BottomSheet>
  );
}
