"use client";

import { useEffect, useRef, useState } from "react";
import type { FollowUp, FollowUpType, NewFollowUpInput } from "./types";
import { followUpTypes } from "./types";

type FollowUpFormProps = {
  isOpen: boolean;
  followUp?: FollowUp | null;
  defaultLeadId?: string;
  leads?: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (data: NewFollowUpInput) => void;
  saving?: boolean;
};

const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

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
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, onClose, saving]);

  useEffect(() => {
    if (isOpen && followUp) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setType(followUp.type);
      setNote(followUp.note);
      setLeadId(followUp.leadId);
      if (followUp.scheduledAt) {
        const d = new Date(followUp.scheduledAt);
        setScheduledDate(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
        setScheduledTime(d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }));
      }
    } else if (isOpen && !followUp) {
      setType("Call");
      setScheduledDate(todayStr);
      setScheduledTime("09:00");
      setNote("");
      setLeadId(defaultLeadId ?? (leads.length > 0 ? leads[0].id : ""));
    }
  }, [isOpen, followUp, defaultLeadId, leads]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!leadId) return;
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
    onSubmit({
      leadId,
      type,
      scheduledAt,
      note: note.trim(),
    });
  };

  const inputClass =
    "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm";

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="followup-form-title">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        disabled={saving}
        className="absolute inset-0 bg-slate-950/45"
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-[var(--background)] shadow-2xl sm:max-w-md">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
          <h2 id="followup-form-title" className="text-lg font-semibold tracking-tight text-slate-950">
            {followUp ? "Edit Follow-up" : "New Follow-up"}
          </h2>
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
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Lead <span className="text-red-500">*</span>
              </label>
              <select
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
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className={inputClass}
                  required
                  disabled={saving}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className={inputClass}
                  required
                  disabled={saving}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Type
              </label>
              <div className="flex flex-wrap gap-2">
                {followUpTypes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    disabled={saving}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      type === t
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Note
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className={`${inputClass} resize-none`}
                placeholder="Add a note about this follow-up..."
                disabled={saving}
              />
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
              onClick={handleSubmit}
              disabled={saving || !leadId}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : followUp ? "Update" : "Create"}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
