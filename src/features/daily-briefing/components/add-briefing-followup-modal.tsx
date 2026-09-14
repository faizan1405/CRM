"use client";

import { useEffect, useRef, useState } from "react";
import type { AddFollowUpData, BriefingActionItem } from "../types";
import { X, MessageCircle, Phone, Mail, Users } from "lucide-react";

type AddBriefingFollowUpModalProps = {
  isOpen: boolean;
  item: BriefingActionItem | null;
  onClose: () => void;
  onSubmit: (data: AddFollowUpData) => void;
};

const FOLLOWUP_TYPES = [
  { id: "Call", label: "Call", icon: Phone },
  { id: "WhatsApp", label: "WhatsApp", icon: MessageCircle },
  { id: "Email", label: "Email", icon: Mail },
  { id: "Meeting", label: "Meeting", icon: Users },
] as const;

function getDefaultDateString(): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function AddBriefingFollowUpModal({
  isOpen,
  item,
  onClose,
  onSubmit,
}: AddBriefingFollowUpModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [selectedType, setSelectedType] = useState<"Call" | "WhatsApp" | "Email" | "Meeting">(() =>
    item?.suggestedActionType === "whatsapp" ? "WhatsApp" : "Call"
  );
  const [date, setDate] = useState<string>(() => getDefaultDateString());
  const [time, setTime] = useState("11:00");
  const [notes, setNotes] = useState<string>(() =>
    item ? `Follow-up regarding ${item.title}` : ""
  );

  // Focus management & Escape key handling
  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      actionItemId: item.id,
      leadName: item.leadName || item.title,
      date,
      time,
      type: selectedType,
      note: notes,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="followup-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2
              id="followup-modal-title"
              className="text-base font-bold text-slate-900 sm:text-lg"
            >
              Schedule Follow-up
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 sm:text-sm">
              For: <span className="font-semibold text-slate-900">{item.leadName || item.title}</span>
              {item.formattedValue && ` (${item.formattedValue})`}
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Follow-up Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Follow-up Channel
            </label>
            <div className="grid grid-cols-4 gap-2">
              {FOLLOWUP_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setSelectedType(type.id)}
                    className={`flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-xs font-medium transition-all ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/70 text-blue-700 font-semibold ring-1 ring-blue-600"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Icon size={16} />
                    <span>{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="followup-date" className="block text-xs font-semibold text-slate-700 mb-1">
                Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="followup-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label htmlFor="followup-time" className="block text-xs font-semibold text-slate-700 mb-1">
                Time <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="followup-time"
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="followup-notes" className="block text-xs font-semibold text-slate-700 mb-1">
              Follow-up Agenda / Note
            </label>
            <textarea
              id="followup-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Call to discuss revised pricing..."
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Save Follow-up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
