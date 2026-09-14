"use client";

import { useEffect, useRef, useState } from "react";
import type { FollowUp } from "./types";
import { formatTime } from "./formatters";

type RescheduleDialogProps = {
  isOpen: boolean;
  followUp: FollowUp | null;
  onClose: () => void;
  onConfirm: (data: { date: string; time: string }) => void;
  saving?: boolean;
};

export function RescheduleDialog({
  isOpen,
  followUp,
  onClose,
  onConfirm,
  saving = false,
}: RescheduleDialogProps) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (followUp?.scheduledAt) {
      const d = new Date(followUp.scheduledAt);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDate(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTime(d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }));
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, followUp, onClose, saving]);

  if (!isOpen || !followUp) return null;

  const handleConfirm = () => {
    if (!date || !time) return;
    onConfirm({ date, time });
  };

  const inputClass =
    "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm";

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="reschedule-title">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        disabled={saving}
        className="absolute inset-0 bg-slate-950/45"
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-[var(--background)] shadow-2xl sm:max-w-xs">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
          <div>
            <h2 id="reschedule-title" className="text-lg font-semibold tracking-tight text-slate-950">
              Reschedule
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {followUp.lead?.name || "Unknown"} &middot; {followUp.type}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close dialog"
            className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="space-y-5">
            {followUp.note && (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-500">Current note</p>
                <p className="mt-1 text-sm text-slate-700">{followUp.note}</p>
              </div>
            )}
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <span className="text-[var(--muted)]">Currently:</span>
              <span className="font-medium text-slate-900">
                {followUp.scheduledAt ? new Date(followUp.scheduledAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : ""} at {followUp.scheduledAt ? formatTime(followUp.scheduledAt) : ""}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  New Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass}
                  required
                  disabled={saving}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  New Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={inputClass}
                  required
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-white p-4 sm:px-6">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving || !date || !time}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Reschedule"}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
