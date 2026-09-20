"use client";

import { Check } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { LeadStatusBadge } from "@/features/leads/lead-status-badge";
import { leadStatuses, type LeadStatus } from "@/features/leads/types";

export type ChangeStatusSheetProps = {
  isOpen: boolean;
  currentStatus: LeadStatus;
  leadName?: string;
  saving?: boolean;
  onClose: () => void;
  onSelectStatus: (status: LeadStatus) => void;
};

export function ChangeStatusSheet({
  isOpen,
  currentStatus,
  saving = false,
  onClose,
  onSelectStatus,
}: ChangeStatusSheetProps) {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Change Status (Pipeline Status)"
      saving={saving}
      footer={
        <button
          type="button"
          disabled={saving}
          onClick={onClose}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[15px] font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
        >
          Cancel
        </button>
      }
    >
      <div className="flex items-center gap-2 mb-4 -mt-2">
        <span className="text-sm font-medium text-slate-600">Current:</span>
        <LeadStatusBadge status={currentStatus} />
        <span className="text-xs text-slate-400 font-medium">(Pipeline Status)</span>
      </div>

      <div
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
        role="group"
        aria-label="Pipeline status options"
      >
        {leadStatuses.map((status) => {
          const isCurrent = status === currentStatus;
          return (
            <button
              key={status}
              type="button"
              disabled={saving}
              onClick={() => {
                if (isCurrent) {
                  onClose();
                } else {
                  onSelectStatus(status);
                }
              }}
              className={`flex min-h-[48px] items-center justify-between rounded-xl border p-3.5 text-left font-medium transition-all disabled:opacity-50 cursor-pointer ${
                isCurrent
                  ? "border-blue-500 bg-blue-50/70 text-blue-900 ring-1 ring-blue-500 font-semibold shadow-xs"
                  : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100 shadow-xs"
              }`}
            >
              <span className="text-sm">{status}</span>
              {isCurrent && (
                <span className="flex items-center gap-1 text-xs font-semibold text-blue-700">
                  <Check size={16} aria-hidden="true" />
                  <span>Current</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
