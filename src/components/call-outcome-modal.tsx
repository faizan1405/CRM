"use client";

import { useDialogAccessibility } from "@/components/use-dialog-accessibility";
import { useEffect, useId, useRef, useState } from "react";
import type { Lead, LeadStatus } from "@/features/leads/types";
import { FOLLOW_UP_PRESETS, getPresetDate, DEFAULT_TIME } from "@/lib/date-presets";
import { logActivity } from "@/app/actions/activities";
import { scheduleLeadFollowUp } from "@/app/actions/follow-ups";
import { changeLeadStatus } from "@/app/actions/leads";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  getFollowUpSuggestion,
  getActiveFutureFollowUp,
  formatFollowUpWarning,
  type FollowUpSuggestion,
  type SalesOutcomeType,
} from "@/lib/follow-up-suggestions";
import { useToast } from "@/components/toast-provider";

type CallOutcomeModalProps = {
  isOpen: boolean;
  lead: Lead | null;
  onClose: () => void;
  onFollowUpScheduled?: (leadId: string, scheduledAt: string) => void;
  onStatusChanged?: (leadId: string, newStatus: LeadStatus) => void;
};

export function CallOutcomeModal({
  isOpen,
  lead,
  onClose,
  onFollowUpScheduled,
  onStatusChanged,
}: CallOutcomeModalProps) {
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<"PICKED" | "NOT_PICKED" | "CALL_BACK" | "INTERESTED" | null>(null);
  const [pipelineStep, setPipelineStep] = useState<"SUGGESTION" | "FOLLOWUP" | null>(null);
  const [suggestion, setSuggestion] = useState<FollowUpSuggestion | null>(null);
  const [isChanging, setIsChanging] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [note, setNote] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const submissionIdRef = useRef<string>("");
  const formId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { showToast } = useToast();

  useDialogAccessibility(isOpen, onClose, saving, closeButtonRef);

  useEffect(() => {
    if (isOpen) {
      setOutcome(null);
      setPipelineStep(null);
      setSuggestion(null);
      setIsChanging(false);
      setScheduledDate("");
      setScheduledTime("");
      setNote("");
      setSelectedPreset(null);
      submissionIdRef.current = `fu-call-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
  }, [isOpen]);

  if (!isOpen || !lead) return null;

  const activeExistingFollowUp = getActiveFutureFollowUp(lead);
  const isNewLead = lead.status?.toLowerCase() === "new";
  const isQualifiedLead = lead.status?.toLowerCase() === "qualified";

  const applyOutcomeSuggestion = (outcomeType: SalesOutcomeType) => {
    const sug = getFollowUpSuggestion(outcomeType);
    setSuggestion(sug);
    setSelectedPreset(sug.presetId);
    if (sug.requiresExactDateTime) {
      setIsChanging(true);
      setScheduledDate("");
      setScheduledTime("");
    } else {
      setIsChanging(false);
      setScheduledDate(sug.suggestedDate);
      setScheduledTime(sug.suggestedTime || DEFAULT_TIME);
    }
  };

  const handleOutcome = async (selectedOutcome: "PICKED" | "NOT_PICKED" | "CALL_BACK" | "INTERESTED") => {
    setOutcome(selectedOutcome);

    if (selectedOutcome === "PICKED") {
      setSaving(true);
      try {
        await logActivity(lead.id, "LEAD_UPDATED", "Call picked");
      } catch (e) {
        console.error("Failed to log call outcome", e);
      } finally {
        setSaving(false);
      }

      if (isNewLead) {
        setPipelineStep("SUGGESTION");
      } else {
        showToast("Call logged: Picked", "success");
        onClose();
      }
      return;
    }

    if (selectedOutcome === "NOT_PICKED") {
      setSaving(true);
      try {
        await logActivity(lead.id, "LEAD_UPDATED", "Call not picked");
      } catch (e) {
        console.error("Failed to log call outcome", e);
      } finally {
        setSaving(false);
      }
      applyOutcomeSuggestion("NOT_PICKED");
      setPipelineStep("FOLLOWUP");
      return;
    }

    if (selectedOutcome === "INTERESTED") {
      setSaving(true);
      try {
        await logActivity(lead.id, "LEAD_UPDATED", "Call picked — Interested");
      } catch (e) {
        console.error("Failed to log call outcome", e);
      } finally {
        setSaving(false);
      }
      applyOutcomeSuggestion("INTERESTED");
      if (!isQualifiedLead) {
        setPipelineStep("SUGGESTION");
      } else {
        setPipelineStep("FOLLOWUP");
      }
      return;
    }

    if (selectedOutcome === "CALL_BACK") {
      setSaving(true);
      try {
        await logActivity(lead.id, "LEAD_UPDATED", "Call Back");
      } catch (e) {
        console.error("Failed to log call outcome", e);
      } finally {
        setSaving(false);
      }
      applyOutcomeSuggestion("CALL_BACK");
      setPipelineStep("FOLLOWUP");
      return;
    }
  };

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

  const handleScheduleConfirm = async (mode: "reschedule" | "create" = "reschedule") => {
    if (!scheduledDate || !scheduledTime) return;

    setSaving(true);
    try {
      const scheduledAtIso = `${scheduledDate}T${scheduledTime}:00+05:30`;
      const noteContent = note.trim() || (outcome === "CALL_BACK" ? "Call back requested" : "Scheduled after call");

      const result = await scheduleLeadFollowUp({
        leadId: lead.id,
        scheduledAt: scheduledAtIso,
        type: "Call",
        note: noteContent,
        submissionId: submissionIdRef.current,
        mode,
        ...(mode === "reschedule" && activeExistingFollowUp ? { id: activeExistingFollowUp.id } : {}),
      });

      if (result.success) {
        showToast("Follow-up scheduled", "success");
        onFollowUpScheduled?.(lead.id, scheduledAtIso);
        onClose();
      } else {
        showToast(result.error || "Failed to schedule follow-up", "error");
      }
    } catch (e) {
      console.error("Error scheduling follow-up", e);
      showToast("Could not schedule follow-up. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "mt-1.5 h-11 min-w-0 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm";

  const isFormValid = Boolean(scheduledDate && scheduledTime);

  const getModalTitle = () => {
    if (!outcome) return "Call Outcome";
    if (outcome === "PICKED") return "Call Outcome: Picked";
    if (outcome === "NOT_PICKED") return "Call Outcome: Not Picked";
    if (outcome === "INTERESTED") return "Call Outcome: Interested";
    if (outcome === "CALL_BACK") return "Call Outcome: Call Back";
    return "Call Outcome";
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={getModalTitle()}
      saving={saving}
      footer={
        outcome && pipelineStep === "FOLLOWUP" ? (
          activeExistingFollowUp ? (
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
                  onClick={() => handleScheduleConfirm("reschedule")}
                  disabled={saving || !isFormValid}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-amber-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Replace/Reschedule
                </button>
              </div>
            </div>
          ) : !isChanging && suggestion ? (
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
                onClick={() => handleScheduleConfirm("reschedule")}
                disabled={saving || !isFormValid}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 text-[15px] font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {saving ? "Scheduling..." : "Schedule"}
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
                type="button"
                onClick={() => handleScheduleConfirm("reschedule")}
                disabled={saving || !isFormValid}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 text-[15px] font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {saving ? "Scheduling..." : "Confirm"}
              </button>
            </div>
          )
        ) : undefined
      }
    >
      {!outcome ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleOutcome("PICKED")}
            className="flex min-h-[52px] items-center justify-center rounded-xl border border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 cursor-pointer"
          >
            Picked
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleOutcome("NOT_PICKED")}
            className="flex min-h-[52px] items-center justify-center rounded-xl border border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 cursor-pointer"
          >
            Not Picked
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleOutcome("CALL_BACK")}
            className="flex min-h-[52px] items-center justify-center rounded-xl border border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 cursor-pointer"
          >
            Call Back
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleOutcome("INTERESTED")}
            className="flex min-h-[52px] items-center justify-center rounded-xl border border-blue-200 bg-blue-50 font-medium text-blue-700 shadow-sm hover:bg-blue-100 active:bg-blue-200 disabled:opacity-50 cursor-pointer"
          >
            Interested
          </button>
        </div>
      ) : outcome === "PICKED" && pipelineStep === "SUGGESTION" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 shadow-xs flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Call outcome</span>
            <span className="text-sm font-bold text-slate-800">Picked</span>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 shadow-xs space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Suggested pipeline update</p>
            <p className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>New</span>
              <span className="text-slate-400">→</span>
              <span className="text-blue-700 font-extrabold">Contacted</span>
            </p>
            <p className="text-xs text-slate-600">
              Would you like to update the pipeline status for this lead to Contacted?
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                showToast("Call logged: Picked", "success");
                onClose();
              }}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[15px] font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              Keep New
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const res = await changeLeadStatus(lead.id, "Contacted");
                  if (res.success) {
                    onStatusChanged?.(lead.id, "Contacted");
                    showToast("Pipeline status updated: Contacted", "success");
                  } else {
                    showToast(res.error || "Failed to update pipeline status", "error");
                  }
                  onClose();
                } catch (e) {
                  console.error(e);
                  showToast("Failed to update pipeline status", "error");
                } finally {
                  setSaving(false);
                }
              }}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 text-[15px] font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {saving ? "Updating..." : "Mark Contacted"}
            </button>
          </div>
        </div>
      ) : outcome === "INTERESTED" && pipelineStep === "SUGGESTION" ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 shadow-xs flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Call outcome</span>
            <span className="text-sm font-bold text-slate-800">Interested</span>
          </div>

          <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-4 shadow-xs space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-700">Suggested pipeline update</p>
            <p className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Current</span>
              <span className="text-slate-400">→</span>
              <span className="text-purple-700 font-extrabold">Qualified</span>
            </p>
            <p className="text-xs text-slate-600">
              Would you like to advance this lead to Qualified in the pipeline?
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setPipelineStep("FOLLOWUP");
              }}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              Keep Current Status
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const res = await changeLeadStatus(lead.id, "Qualified");
                  if (res.success) {
                    onStatusChanged?.(lead.id, "Qualified");
                    showToast("Pipeline status updated: Qualified", "success");
                  } else {
                    showToast(res.error || "Failed to update pipeline status", "error");
                  }
                } catch (e) {
                  console.error(e);
                  showToast("Failed to update pipeline status", "error");
                } finally {
                  setSaving(false);
                  setPipelineStep("FOLLOWUP");
                }
              }}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-purple-600 px-3 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {saving ? "Updating..." : "Mark Qualified"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Duplicate Follow-up Warning */}
          {activeExistingFollowUp && (
            <div
              role="alert"
              className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-amber-900 shadow-xs space-y-1"
            >
              <p className="text-xs sm:text-[13px] font-semibold flex items-center gap-1.5">
                <span>⚠️</span>
                <span>{formatFollowUpWarning(activeExistingFollowUp.scheduledAt)}</span>
              </p>
              <p className="text-[11px] text-amber-800">
                An active follow-up already exists for this lead. A lead can only have one active follow-up at a time. Choose whether to keep the existing one or replace/reschedule it.
              </p>
            </div>
          )}

          {/* Suggestion Summary */}
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

          {/* Call Back explicit prompt */}
          {suggestion?.requiresExactDateTime && (
            <div className="rounded-xl border border-violet-200 bg-violet-50/80 p-3 text-xs text-violet-900 font-medium">
              Please choose an exact callback date and time before confirming.
            </div>
          )}

          {/* Date & Time controls */}
          {(isChanging || suggestion?.requiresExactDateTime) && (
            <div className="space-y-3">
              {!suggestion?.requiresExactDateTime && (
                <div className="flex flex-wrap gap-1.5">
                  {FOLLOW_UP_PRESETS.map((preset) => {
                    const isSelected = selectedPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        data-preset={preset.id}
                        aria-pressed={isSelected}
                        onClick={() => handlePresetClick(preset)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all shadow-sm cursor-pointer ${
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

              <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
                <div>
                  <label htmlFor={`${formId}-cb-date`} className="mb-1 block text-xs font-semibold text-slate-700">
                    {suggestion?.requiresExactDateTime ? "Choose callback date" : "Date"} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id={`${formId}-cb-date`}
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
                  <label htmlFor={`${formId}-cb-time`} className="mb-1 block text-xs font-semibold text-slate-700">
                    {suggestion?.requiresExactDateTime ? "Choose callback time" : "Time"} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id={`${formId}-cb-time`}
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

              <div>
                <label htmlFor={`${formId}-cb-note`} className="mb-1 block text-xs font-semibold text-slate-700">
                  Note
                </label>
                <textarea
                  id={`${formId}-cb-note`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className={`${inputClass} h-auto resize-none py-2`}
                  placeholder="Optional follow-up note..."
                  disabled={saving}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
