"use client";

import { useDialogAccessibility } from "@/components/use-dialog-accessibility";

import { useEffect, useId, useRef, useState } from "react";
import type { FollowUp, FollowUpType, NewFollowUpInput } from "./types";
import { followUpTypes } from "./types";
import { getPresetDate, FOLLOW_UP_PRESETS, DEFAULT_TIME } from "@/lib/date-presets";
import { BottomSheet } from "@/components/ui/bottom-sheet";

type FollowUpFormProps = {
  isOpen: boolean;
  followUp?: FollowUp | null;
  defaultLeadId?: string;
  leads?: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (data: NewFollowUpInput) => void;
  saving?: boolean;
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
}: FollowUpFormProps) {
  const [type, setType] = useState<FollowUpType>(followUp?.type ?? "Call");
  const [scheduledDate, setScheduledDate] = useState(todayStr);
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [note, setNote] = useState("");
  const [leadId, setLeadId] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const submissionIdRef = useRef<string>("");
  const firstLeadId = leads[0]?.id || "";
  const formId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useDialogAccessibility(isOpen, onClose, saving, closeButtonRef);

  useEffect(() => {
    if (isOpen) {
      submissionIdRef.current = `fu-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      setSelectedPreset(null);
    }
    if (isOpen && followUp) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setType(followUp.type);
      setNote(followUp.leadNote || followUp.note);
      setLeadId(followUp.leadId);
      if (followUp.scheduledAt) {
        const d = new Date(followUp.scheduledAt);
        setScheduledDate(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
        setScheduledTime(d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }));
      }
    } else if (isOpen && !followUp) {
      setType("Call");
      setScheduledDate(todayStr());
      setScheduledTime(DEFAULT_TIME);
      setNote("");
      setLeadId(defaultLeadId ?? firstLeadId);
    }
  }, [isOpen, followUp, defaultLeadId, firstLeadId]);

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

  const handleSubmit = () => {
    if (!leadId) return;
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00+05:30`).toISOString();
    onSubmit({
      ...(followUp?.id ? { id: followUp.id } : {}),
      leadId,
      type,
      scheduledAt,
      note: note.trim(),
      submissionId: submissionIdRef.current,
    });
  };

  const inputClass =
    "mt-1.5 h-11 min-w-0 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm";

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={followUp ? "Edit Follow-up" : "New Follow-up"}
      saving={saving}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[15px] font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            disabled={saving || !leadId || !scheduledDate || !scheduledTime}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 text-[15px] font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : followUp ? "Update" : "Create"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={event => { event.preventDefault(); handleSubmit(); }} className="space-y-5">
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
            disabled={saving || !!followUp}
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

        <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2">
          <div>
            <label htmlFor={`${formId}-date`} className="mb-1.5 block text-[13px] font-semibold text-slate-700">
              Date <span className="text-red-500">*</span>
            </label>
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
              Time <span className="text-red-500">*</span>
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
