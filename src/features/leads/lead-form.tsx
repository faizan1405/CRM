"use client";

import { useDialogAccessibility } from "@/components/use-dialog-accessibility";
import { CopyPlus, Keyboard, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AILeadEntry } from "@/features/leads/ai-lead-entry";
import type { DuplicateLeadCandidate, StructuredLeadDraft } from "@/features/leads/ai-entry-types";
import type { BulkStructureLeadCallback } from "./bulk-review-types";
import { leadStatuses, type Lead, type LeadStatus } from "@/features/leads/types";
import { checkLeadDuplicate } from "@/app/actions/leads";
import { DuplicateLeadWarning } from "./duplicate-lead-warning";
import { MergeLeadsModal } from "./merge-leads-modal";

type LeadFormProps = {
  open: boolean;
  lead: Lead | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
  onStructureLead?: BulkStructureLeadCallback;
  onBulkSaved?: (leads: Lead[]) => void;
  onBusyChange?: (busy: boolean) => void;
  onOpenDuplicate?: (candidate: DuplicateLeadCandidate) => void;
  onUpdateDuplicate?: (candidate: DuplicateLeadCandidate, draft: StructuredLeadDraft) => void;
  onLeadEnriched?: (updatedLead: Lead) => void;
};

const inputClass =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-sm";

function ManualLeadEntry({
  lead,
  saving,
  onClose,
  onSubmit,
  onOpenDuplicate,
  onLeadEnriched,
}: Pick<LeadFormProps, "lead" | "saving" | "onClose" | "onSubmit" | "onOpenDuplicate" | "onLeadEnriched">) {
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(lead?.name ?? "");
  const [phone, setPhone] = useState(lead?.phone ?? "");
  const [email, setEmail] = useState(lead?.email ?? "");
  const [business, setBusiness] = useState(lead?.business ?? "");
  const [industry, setIndustry] = useState(lead?.industry ?? "");
  const [quotedAmount, setQuotedAmount] = useState(lead?.quotedAmount ? String(lead.quotedAmount) : "");
  const [status, setStatus] = useState<LeadStatus>(lead?.status ?? "New");
  const [notes, setNotes] = useState(lead?.notes ?? "");

  const [duplicateCandidate, setDuplicateCandidate] = useState<DuplicateLeadCandidate | null>(null);
  const [showCreateAnywayModal, setShowCreateAnywayModal] = useState(false);
  const [enrichModalOpen, setEnrichModalOpen] = useState(false);
  const duplicateTimer = useRef<NodeJS.Timeout | null>(null);

  // Debounced duplicate detection on phone or email change
  useEffect(() => {
    // Only check duplicates if we're adding a new lead or editing phone/email
    if (duplicateTimer.current) clearTimeout(duplicateTimer.current);

    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    if (!trimmedPhone && !trimmedEmail) {
      setDuplicateCandidate(null);
      return;
    }

    duplicateTimer.current = setTimeout(async () => {
      try {
        const candidate = await checkLeadDuplicate(lead?.id, trimmedPhone, trimmedEmail || null);
        setDuplicateCandidate(candidate);
      } catch {
        // Safe in network errors
      }
    }, 450);

    return () => {
      if (duplicateTimer.current) clearTimeout(duplicateTimer.current);
    };
  }, [phone, email, lead?.id]);

  function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (duplicateCandidate && !duplicateCandidate.isDeleted) {
      // Prompt user explicitly before creating duplicate
      setShowCreateAnywayModal(true);
      return;
    }

    const formData = new FormData(e.currentTarget);
    void onSubmit(formData);
  }

  function handleConfirmCreateAnyway() {
    setShowCreateAnywayModal(false);
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    formData.set("allowDuplicate", "true");
    void onSubmit(formData);
  }

  return (
    <>
      <form ref={formRef} onSubmit={handleFormSubmit} className="min-w-0">
        <div className="mx-auto max-w-2xl">
          <input type="hidden" name="budget" value={lead?.budget ?? ""} />
          <input type="hidden" name="source" value={lead?.source ?? ""} />

          {duplicateCandidate && (
            <div className="px-5 pt-5 sm:px-6">
              <DuplicateLeadWarning
                candidate={duplicateCandidate}
                onOpenExisting={() => onOpenDuplicate?.(duplicateCandidate)}
                onUpdateExisting={() => setEnrichModalOpen(true)}
                onCreateAnyway={() => setShowCreateAnywayModal(true)}
                onCancel={() => setDuplicateCandidate(null)}
              />
            </div>
          )}

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
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                value={business}
                onChange={(e) => setBusiness(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Industry / Requirement
              <input
                className={inputClass}
                name="industry"
                maxLength={100}
                placeholder="Industry or website requirement"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Status
              <select
                className={inputClass}
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as LeadStatus)}
              >
                {leadStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
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
                value={quotedAmount}
                onChange={(e) => setQuotedAmount(e.target.value)}
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
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
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
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>
          <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6 sm:pb-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-[15px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 active:bg-slate-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-xl bg-blue-600 px-5 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? "Saving…" : lead ? "Save changes" : "Add lead"}
            </button>
          </footer>
        </div>
      </form>

      {/* Explicit Create Anyway confirmation dialog */}
      {showCreateAnywayModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Create Duplicate Record?</h3>
            <p className="text-sm text-slate-600">
              Another lead already uses this phone number or email address.
              Are you sure you want to create a separate lead anyway?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateAnywayModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCreateAnyway}
                className="rounded-xl bg-amber-800 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-900"
              >
                Create Separate Lead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enrich Existing Lead Modal */}
      {enrichModalOpen && duplicateCandidate && (
        <MergeLeadsModal
          mode="enrich"
          isOpen={enrichModalOpen}
          existingCandidate={duplicateCandidate}
          enteredLead={{
            name,
            phone,
            email: email || undefined,
            business: business || undefined,
            industry: industry || undefined,
            quotedAmount: quotedAmount ? Number(quotedAmount) : undefined,
            status,
            notes: notes || undefined,
          }}
          onClose={() => setEnrichModalOpen(false)}
          onSuccess={(enrichedLead) => {
            setEnrichModalOpen(false);
            onClose();
            onLeadEnriched?.(enrichedLead);
          }}
        />
      )}
    </>
  );
}

function NewLeadEntry({
  saving,
  onClose,
  onSubmit,
  onStructureLead,
  onOpenDuplicate,
  onUpdateDuplicate,
  onBulkSaved,
  onBusyChange,
  onLeadEnriched,
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
            disabled={saving}
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
            disabled={saving}
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
            onBulkSaved={onBulkSaved}
            onBusyChange={onBusyChange}
          />
        </div>
        <div hidden={mode !== "manual"}>
          <ManualLeadEntry
            lead={null}
            saving={saving}
            onClose={onClose}
            onSubmit={onSubmit}
            onOpenDuplicate={onOpenDuplicate}
            onLeadEnriched={onLeadEnriched}
          />
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
  onBulkSaved,
  onBusyChange,
  onLeadEnriched,
}: LeadFormProps) {
  const [entryBusy, setEntryBusy] = useState(false);
  const modalSaving = saving || entryBusy;
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useDialogAccessibility(open, onClose, modalSaving, closeButtonRef);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close lead form"
        onClick={onClose}
        disabled={modalSaving}
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
            disabled={modalSaving}
            aria-label="Close lead form"
            className="grid size-11 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>
        {lead ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ManualLeadEntry
              lead={lead}
              saving={modalSaving}
              onClose={onClose}
              onSubmit={onSubmit}
              onOpenDuplicate={onOpenDuplicate}
              onLeadEnriched={onLeadEnriched}
            />
          </div>
        ) : (
          <NewLeadEntry
            saving={modalSaving}
            onClose={onClose}
            onSubmit={onSubmit}
            onStructureLead={onStructureLead}
            onOpenDuplicate={onOpenDuplicate}
            onUpdateDuplicate={onUpdateDuplicate}
            onBulkSaved={onBulkSaved}
            onBusyChange={(value) => {
              setEntryBusy(value);
              onBusyChange?.(value);
            }}
            onLeadEnriched={onLeadEnriched}
          />
        )}
      </section>
    </div>
  );
}
