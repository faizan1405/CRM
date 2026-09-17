"use client";

import { useDialogAccessibility } from "@/components/use-dialog-accessibility";
import { useEffect, useId, useRef, useState } from "react";
import type { Lead } from "@/features/leads/types";
import { FOLLOW_UP_PRESETS, getPresetDate, DEFAULT_TIME } from "@/lib/date-presets";
import { logActivity } from "@/app/actions/activities";

type CallOutcomeModalProps = {
  isOpen: boolean;
  lead: Lead | null;
  onClose: () => void;
  onFollowUpNeeded: (date: string, time: string) => void;
};

export function CallOutcomeModal({ isOpen, lead, onClose, onFollowUpNeeded }: CallOutcomeModalProps) {
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<"PICKED" | "NOT_PICKED" | "CALL_BACK" | "INTERESTED" | null>(null);
  const formId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useDialogAccessibility(isOpen, onClose, saving, closeButtonRef);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOutcome(null);
    }
  }, [isOpen]);

  if (!isOpen || !lead) return null;

  const handleOutcome = async (selectedOutcome: typeof outcome) => {
    setOutcome(selectedOutcome);
    if (!selectedOutcome) return;

    if (selectedOutcome === "CALL_BACK") {
      return;
    }

    setSaving(true);
    try {
      if (selectedOutcome === "PICKED") {
        await logActivity(lead.id, "LEAD_UPDATED", "Call picked");
        onClose();
      } else if (selectedOutcome === "NOT_PICKED") {
        await logActivity(lead.id, "LEAD_UPDATED", "Call not picked");
      } else if (selectedOutcome === "INTERESTED") {
        await logActivity(lead.id, "LEAD_UPDATED", "Call picked - Interested");
        onClose();
      }
    } catch (e) {
      console.error("Failed to log call outcome", e);
    } finally {
      setSaving(false);
    }
  };

  const showPresets = outcome === "NOT_PICKED" || outcome === "CALL_BACK";

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex h-dvh items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="call-outcome-title">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close dialog"
        onClick={onClose}
        disabled={saving}
        className="absolute inset-0 bg-slate-950/45"
      />
      <aside className="relative w-full max-w-lg rounded-t-2xl bg-[var(--background)] shadow-2xl sm:rounded-2xl border border-slate-200">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:rounded-t-2xl rounded-t-2xl">
          <h2 id="call-outcome-title" className="text-lg font-semibold tracking-tight text-slate-950">
            Call Outcome
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={saving}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="p-4 sm:p-6 bg-white sm:rounded-b-2xl rounded-b-none">
          {!showPresets ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleOutcome("PICKED")}
                className="flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Picked
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleOutcome("NOT_PICKED")}
                className="flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Not Picked
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleOutcome("CALL_BACK")}
                className="flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Call Back
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleOutcome("INTERESTED")}
                className="flex min-h-12 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 font-medium text-blue-700 shadow-sm hover:bg-blue-100 disabled:opacity-50"
              >
                Interested
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-700">Quick Follow-up</p>
              <div className="grid grid-cols-2 gap-3">
                {FOLLOW_UP_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      onFollowUpNeeded(getPresetDate(preset.days), DEFAULT_TIME);
                    }}
                    className="flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
