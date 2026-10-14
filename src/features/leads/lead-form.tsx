"use client";

import { useDialogAccessibility } from "@/components/use-dialog-accessibility";
import {
  ChevronDown,
  CopyPlus,
  Keyboard,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AILeadEntry } from "@/features/leads/ai-lead-entry";
import type { DuplicateLeadCandidate, StructuredLeadDraft } from "@/features/leads/ai-entry-types";
import type { BulkStructureLeadCallback } from "./bulk-review-types";
import { leadStatuses, type Lead, type LeadStatus } from "@/features/leads/types";
import { checkLeadDuplicate } from "@/app/actions/leads";
import { DuplicateLeadWarning } from "./duplicate-lead-warning";
import { MergeLeadsModal } from "./merge-leads-modal";
import { AiNoteEditor } from "@/components/ui/ai-note-editor";
import { cn } from "@/lib/utils";

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

// Lovable input styling
const fieldInputClass =
  "w-full rounded-lg bg-card text-[13.5px] text-foreground shadow-[inset_0_0_0_1px_var(--input)] outline-none transition-[box-shadow,background-color] duration-150 placeholder:text-subtle hover:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_22%,var(--input))] focus:shadow-[inset_0_0_0_1px_var(--ring),0_0_0_3px_color-mix(in_oklab,var(--ring)_16%,transparent)] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-[invalid=true]:shadow-[inset_0_0_0_1px_var(--destructive),0_0_0_3px_color-mix(in_oklab,var(--destructive)_12%,transparent)] h-10 px-3 md:h-9";

const LEAD_SOURCES = [
  "Website",
  "Referral",
  "WhatsApp",
  "Instagram",
  "Trade Show",
  "Cold Call",
  "LinkedIn",
  "Other",
];

function FieldWrapper({
  label,
  optional = false,
  error,
  className,
  children,
}: {
  label: string;
  optional?: boolean;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <label className="flex items-baseline justify-between text-[12.5px] font-medium text-foreground">
        <span>
          {label} {!optional && <span className="text-destructive">*</span>}
        </span>
        {optional && <span className="font-normal text-subtle text-xs">Optional</span>}
      </label>
      {children}
      {error && <p className="text-[12px] text-destructive">{error}</p>}
    </div>
  );
}

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
  const [source, setSource] = useState(lead?.source ?? "");
  const [budget, setBudget] = useState(lead?.budget ? String(lead.budget) : "");
  const [quotedAmount, setQuotedAmount] = useState(lead?.quotedAmount ? String(lead.quotedAmount) : "");
  const [status, setStatus] = useState<LeadStatus>(lead?.status ?? "New");
  const [lastContactDate, setLastContactDate] = useState(lead?.lastContactDate ?? "");
  const [nextFollowUpDate, setNextFollowUpDate] = useState(lead?.nextFollowUpDate ?? "");
  const [notes, setNotes] = useState(lead?.notes ?? "");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateCandidate, setDuplicateCandidate] = useState<DuplicateLeadCandidate | null>(null);
  const [showCreateAnywayModal, setShowCreateAnywayModal] = useState(false);
  const [enrichModalOpen, setEnrichModalOpen] = useState(false);
  const duplicateTimer = useRef<NodeJS.Timeout | null>(null);

  // Debounced duplicate detection on phone or email change
  useEffect(() => {
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
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (!phone.trim()) {
      newErrors.phone = "Phone is required";
    } else if (phone.replace(/\D/g, "").length < 10) {
      newErrors.phone = "Enter a valid phone number (at least 10 digits)";
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Enter a valid email address";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    if (duplicateCandidate && !duplicateCandidate.isDeleted) {
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
      <form ref={formRef} onSubmit={handleFormSubmit} noValidate className="flex flex-col flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {duplicateCandidate && (
            <div className="mb-4">
              <DuplicateLeadWarning
                candidate={duplicateCandidate}
                onOpenExisting={() => onOpenDuplicate?.(duplicateCandidate)}
                onUpdateExisting={() => setEnrichModalOpen(true)}
                onCreateAnyway={() => setShowCreateAnywayModal(true)}
                onCancel={() => setDuplicateCandidate(null)}
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Row 1: Name & Phone */}
            <FieldWrapper label="Name" error={errors.name}>
              <input
                className={fieldInputClass}
                name="name"
                required
                maxLength={120}
                autoComplete="name"
                placeholder="Full name"
                value={name}
                aria-invalid={!!errors.name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
                }}
              />
            </FieldWrapper>

            <FieldWrapper label="Phone" error={errors.phone}>
              <input
                className={fieldInputClass}
                name="phone"
                type="tel"
                inputMode="tel"
                required
                maxLength={40}
                autoComplete="tel"
                placeholder="+91 98xxx xxxxx"
                value={phone}
                aria-invalid={!!errors.phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) setErrors((prev) => ({ ...prev, phone: "" }));
                }}
              />
            </FieldWrapper>

            {/* Row 2: Email & Business */}
            <FieldWrapper label="Email" optional error={errors.email}>
              <input
                className={fieldInputClass}
                name="email"
                type="email"
                maxLength={254}
                autoComplete="email"
                placeholder="name@company.com"
                value={email}
                aria-invalid={!!errors.email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                }}
              />
            </FieldWrapper>

            <FieldWrapper label="Business" optional>
              <input
                className={fieldInputClass}
                name="business"
                maxLength={160}
                autoComplete="organization"
                placeholder="Company name"
                value={business}
                onChange={(e) => setBusiness(e.target.value)}
              />
            </FieldWrapper>

            {/* Row 3: Industry & Lead Source */}
            <FieldWrapper label="Industry" optional>
              <input
                className={fieldInputClass}
                name="industry"
                maxLength={100}
                placeholder="e.g. Retail"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              />
            </FieldWrapper>

            <FieldWrapper label="Lead source" optional>
              <div className="relative">
                <select
                  name="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className={cn(fieldInputClass, "appearance-none pr-8 cursor-pointer")}
                >
                  <option value="">Select source</option>
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  {source && !LEAD_SOURCES.includes(source) && (
                    <option value={source}>{source}</option>
                  )}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              </div>
            </FieldWrapper>

            {/* Row 4: Budget & Quoted Amount */}
            <FieldWrapper label="Budget" optional>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13.5px] text-muted-foreground font-medium">
                  ₹
                </span>
                <input
                  name="budget"
                  type="number"
                  min="0"
                  max="9999999999.99"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className={cn(fieldInputClass, "pl-7 tabular")}
                />
              </div>
            </FieldWrapper>

            <FieldWrapper label="Quoted amount" optional>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13.5px] text-muted-foreground font-medium">
                  ₹
                </span>
                <input
                  name="quotedAmount"
                  type="number"
                  min="0"
                  max="9999999999.99"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0"
                  value={quotedAmount}
                  onChange={(e) => setQuotedAmount(e.target.value)}
                  className={cn(fieldInputClass, "pl-7 tabular")}
                />
              </div>
            </FieldWrapper>

            {/* Row 5: Status & Next Follow-up */}
            <FieldWrapper label="Status">
              <div className="relative">
                <select
                  name="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LeadStatus)}
                  className={cn(fieldInputClass, "appearance-none pr-8 cursor-pointer")}
                >
                  {leadStatuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
              </div>
            </FieldWrapper>

            <FieldWrapper label="Next follow-up" optional>
              <input
                className={fieldInputClass}
                name="nextFollowUpDate"
                type="date"
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
              />
            </FieldWrapper>

            {/* Additional Field: Last Contact Date */}
            <FieldWrapper label="Last contact date" optional className="sm:col-span-2">
              <input
                className={fieldInputClass}
                name="lastContactDate"
                type="date"
                value={lastContactDate}
                onChange={(e) => setLastContactDate(e.target.value)}
              />
            </FieldWrapper>

            {/* Final Section: Notes */}
            <div className="sm:col-span-2">
              <AiNoteEditor
                label="Notes"
                labelClassName="text-[12.5px] font-medium text-foreground block mb-1.5"
                name="notes"
                maxLength={5000}
                placeholder="Context, requirements, decision-makers…"
                value={notes}
                onChange={(val) => setNotes(val)}
                disabled={saving}
                rows={4}
                textareaClassName={cn(
                  fieldInputClass,
                  "min-h-[88px] resize-y py-2.5 leading-relaxed"
                )}
              />
            </div>
          </div>
        </div>

        {/* Sticky Lovable Footer */}
        <footer className="flex justify-end gap-2 rounded-b-2xl border-t border-border bg-muted/40 px-6 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-[13px] font-medium text-foreground shadow-xs hover:bg-muted transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            aria-busy={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground shadow-[inset_0_1px_0_oklch(1_0_0/18%),0_1px_2px_oklch(0.2_0.05_160/30%)] hover:bg-primary/92 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-wait cursor-pointer font-semibold"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
            <span>{saving ? (lead ? "Saving…" : "Adding…") : lead ? "Save changes" : "Add lead"}</span>
          </button>
        </footer>
      </form>

      {/* Explicit Create Duplicate Confirmation Modal */}
      {showCreateAnywayModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-[var(--shadow-float)] border border-border space-y-4">
            <h3 className="text-base font-bold text-foreground">Create Duplicate Record?</h3>
            <p className="text-sm text-muted-foreground">
              Another lead already uses this phone number or email address.
              Are you sure you want to create a separate lead anyway?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateAnywayModal(false)}
                className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCreateAnyway}
                className="rounded-lg bg-warning px-4 py-2 text-xs font-semibold text-warning-foreground hover:bg-warning/90 cursor-pointer"
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
    <div className="flex flex-col flex-1 min-h-0">
      {/* Segmented Mode Selector: Quick AI Entry vs Manual Entry */}
      <div className="border-b border-border bg-muted/30 px-6 py-2.5 shrink-0">
        <div
          role="group"
          aria-label="Lead entry method"
          className="mx-auto grid max-w-sm grid-cols-2 rounded-lg bg-muted p-1"
        >
          <button
            type="button"
            disabled={saving}
            aria-pressed={mode === "ai"}
            onClick={() => setMode("ai")}
            className={cn(
              "press inline-flex h-8 items-center justify-center gap-2 rounded-md px-3 text-[13px] font-medium transition-all duration-150 cursor-pointer",
              mode === "ai"
                ? "bg-card text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
            <span>Quick AI Entry</span>
          </button>
          <button
            type="button"
            disabled={saving}
            aria-pressed={mode === "manual"}
            onClick={() => setMode("manual")}
            className={cn(
              "press inline-flex h-8 items-center justify-center gap-2 rounded-md px-3 text-[13px] font-medium transition-all duration-150 cursor-pointer",
              mode === "manual"
                ? "bg-card text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Keyboard aria-hidden="true" className="h-3.5 w-3.5" />
            <span>Manual Entry</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Quick AI Entry - 100% UNTOUCHED BEHAVIOR */}
        <div hidden={mode !== "ai"} className="flex-1 overflow-y-auto">
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

        {/* Manual Entry - Lovable Design */}
        <div hidden={mode !== "manual"} className="flex-1 min-h-0 flex flex-col">
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
    </div>
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
        className="fixed inset-0 bg-foreground/30 backdrop-blur-[2px] transition-opacity"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-form-title"
        className="relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[22px] bg-card text-foreground shadow-[var(--shadow-float)] border border-border motion-safe:animate-[lead-panel-in_180ms_ease-out] sm:max-h-[88dvh] sm:max-w-2xl sm:rounded-2xl"
      >
        {/* Header */}
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-6 py-4.5">
          <div className="space-y-0.5">
            <h2 id="lead-form-title" className="text-[17px] font-semibold tracking-tight text-foreground">
              {lead ? "Edit lead" : "New lead"}
            </h2>
            <p className="text-[13px] text-muted-foreground">
              {lead
                ? (lead.business ? `${lead.name} · ${lead.business}` : lead.name)
                : "Add the essentials now — you can fill in the rest later."}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={modalSaving}
            aria-label="Close lead form"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 cursor-pointer"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>

        {/* Content Body */}
        {lead ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
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

export { LeadForm as LeadFormModal };
