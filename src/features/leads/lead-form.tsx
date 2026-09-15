"use client";

import { Keyboard, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AILeadEntry } from "@/features/leads/ai-lead-entry";
import type { DuplicateLeadCandidate, StructuredLeadDraft, StructureLeadCallback } from "@/features/leads/ai-entry-types";
import { leadStatuses, type Lead } from "@/features/leads/types";

type LeadFormProps = {
  open: boolean;
  lead: Lead | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
  onStructureLead?: StructureLeadCallback;
  onOpenDuplicate?: (candidate: DuplicateLeadCandidate) => void;
  onUpdateDuplicate?: (candidate: DuplicateLeadCandidate, draft: StructuredLeadDraft) => void;
};

const inputClass =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-sm";

function ManualLeadEntry({
  lead,
  saving,
  onClose,
  onSubmit,
}: Pick<LeadFormProps, "lead" | "saving" | "onClose" | "onSubmit">) {
  return (
    <form action={onSubmit} className="overflow-y-auto">
      <div className="mx-auto max-w-2xl">
        <input type="hidden" name="source" value={lead?.source ?? ""} />
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <label className="text-sm font-medium text-slate-700">
            Name <span className="text-rose-600">*</span>
            <input
              className={inputClass}
              name="name"
              required
              maxLength={120}
              autoComplete="name"
              placeholder="Lead name"
              defaultValue={lead?.name ?? ""}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Phone <span className="text-rose-600">*</span>
            <input
              className={inputClass}
              name="phone"
              type="tel"
              required
              maxLength={40}
              autoComplete="tel"
              placeholder="Phone number"
              defaultValue={lead?.phone ?? ""}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Email
            <input
              className={inputClass}
              name="email"
              type="email"
              maxLength={254}
              autoComplete="email"
              placeholder="Email address"
              defaultValue={lead?.email ?? ""}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Business / Company
            <input
              className={inputClass}
              name="business"
              maxLength={160}
              autoComplete="organization"
              placeholder="Business name"
              defaultValue={lead?.business ?? ""}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Industry / Requirement
            <input
              className={inputClass}
              name="industry"
              maxLength={100}
              placeholder="Industry or website requirement"
              defaultValue={lead?.industry ?? ""}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Budget
            <input
              className={inputClass}
              name="budget"
              type="number"
              min="0"
              max="9999999999.99"
              step="0.01"
              inputMode="decimal"
              placeholder="Estimated budget"
              defaultValue={lead?.budget ?? ""}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Status
            <select className={inputClass} name="status" defaultValue={lead?.status ?? "New"}>
              {leadStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Quoted amount
            <input
              className={inputClass}
              name="quotedAmount"
              type="number"
              min="0"
              max="9999999999.99"
              step="0.01"
              inputMode="decimal"
              placeholder="Quoted amount"
              defaultValue={lead?.quotedAmount ?? ""}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Last contact date
            <input
              className={inputClass}
              name="lastContactDate"
              type="date"
              defaultValue={lead?.lastContactDate ?? ""}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Next follow-up date
            <input
              className={inputClass}
              name="nextFollowUpDate"
              type="date"
              defaultValue={lead?.nextFollowUpDate ?? ""}
            />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Notes
            <textarea
              className={`${inputClass} min-h-28 resize-y py-3`}
              name="notes"
              maxLength={5000}
              placeholder="Context, requirements or next steps"
              defaultValue={lead?.notes ?? ""}
            />
          </label>
        </div>
        <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-11 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? "Saving…" : lead ? "Save changes" : "Add lead"}
          </button>
        </footer>
      </div>
    </form>
  );
}

function NewLeadEntry({
  saving,
  onClose,
  onSubmit,
  onStructureLead,
  onOpenDuplicate,
  onUpdateDuplicate,
}: Omit<LeadFormProps, "open" | "lead">) {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  return (
    <>
      <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-6">
        <div
          role="group"
          aria-label="Lead entry method"
          className="mx-auto grid max-w-md grid-cols-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
        >
          <button
            type="button"
            aria-pressed={mode === "ai"}
            onClick={() => setMode("ai")}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${
              mode === "ai" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Sparkles aria-hidden="true" size={16} />
            Quick AI Entry
          </button>
          <button
            type="button"
            aria-pressed={mode === "manual"}
            onClick={() => setMode("manual")}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${
              mode === "manual" ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Keyboard aria-hidden="true" size={16} />
            Manual Entry
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div hidden={mode !== "ai"}>
          <AILeadEntry
            saving={saving}
            onSubmit={onSubmit}
            onStructureLead={onStructureLead}
            onOpenDuplicate={onOpenDuplicate}
            onUpdateDuplicate={onUpdateDuplicate}
          />
        </div>
        <div hidden={mode !== "manual"}>
          <ManualLeadEntry lead={null} saving={saving} onClose={onClose} onSubmit={onSubmit} />
        </div>
      </div>
    </>
  );
}

export function LeadForm({
  open,
  lead,
  saving,
  onClose,
  onSubmit,
  onStructureLead,
  onOpenDuplicate,
  onUpdateDuplicate,
}: LeadFormProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (lead) closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [lead, onClose, open, saving]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close lead form"
        onClick={onClose}
        disabled={saving}
        className="absolute inset-0 bg-slate-950/50"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-form-title"
        className="relative flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl motion-safe:animate-[lead-panel-in_180ms_ease-out] sm:max-h-[92dvh] sm:max-w-5xl sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id="lead-form-title" className="text-xl font-semibold tracking-tight text-slate-950">
              {lead ? "Edit lead" : "Add lead"}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {lead ? "Update the lead’s saved information." : "Paste what you know or enter details manually."}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close lead form"
            className="grid size-11 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>
        {lead ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ManualLeadEntry lead={lead} saving={saving} onClose={onClose} onSubmit={onSubmit} />
          </div>
        ) : (
          <NewLeadEntry
            saving={saving}
            onClose={onClose}
            onSubmit={onSubmit}
            onStructureLead={onStructureLead}
            onOpenDuplicate={onOpenDuplicate}
            onUpdateDuplicate={onUpdateDuplicate}
          />
        )}
      </section>
    </div>
  );
}
