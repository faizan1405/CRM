"use client";

import { useDialogAccessibility } from "@/components/use-dialog-accessibility";
import { useEffect, useId, useRef, useState } from "react";
import type { Lead } from "@/features/leads/types";
import { FOLLOW_UP_PRESETS, getPresetDate, DEFAULT_TIME } from "@/lib/date-presets";
import { logActivity } from "@/app/actions/activities";
import { BottomSheet } from "@/components/ui/bottom-sheet";

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
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Call Outcome"
      saving={saving}
    >
      {!showPresets ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleOutcome("PICKED")}
            className="flex min-h-[52px] items-center justify-center rounded-xl border border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Picked
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleOutcome("NOT_PICKED")}
            className="flex min-h-[52px] items-center justify-center rounded-xl border border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Not Picked
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleOutcome("CALL_BACK")}
            className="flex min-h-[52px] items-center justify-center rounded-xl border border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Call Back
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => handleOutcome("INTERESTED")}
            className="flex min-h-[52px] items-center justify-center rounded-xl border border-blue-200 bg-blue-50 font-medium text-blue-700 shadow-sm hover:bg-blue-100 disabled:opacity-50"
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
                className="flex min-h-[52px] items-center justify-center rounded-xl border border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
