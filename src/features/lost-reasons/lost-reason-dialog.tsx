"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Check,
  AlertCircle,
  ArrowLeft,
  DollarSign,
  PhoneOff,
  Clock,
  Users,
  ShieldAlert,
  UserX,
  RefreshCw,
  Hourglass,
  HelpCircle,
  CheckCircle2,
} from "lucide-react";
import {
  LOST_REASONS,
  LOST_REASON_DETAILS,
  type PrismaLeadLossReason,
  type LostReasonDialogProps,
} from "./types";

function renderReasonIcon(reason: PrismaLeadLossReason, isSelected: boolean) {
  const meta = LOST_REASON_DETAILS[reason];
  const className = `size-4 shrink-0 transition-colors ${
    isSelected ? "text-rose-600" : "text-slate-500"
  }`;

  switch (meta.iconName) {
    case "DollarSign":
      return <DollarSign className={className} aria-hidden="true" />;
    case "PhoneOff":
      return <PhoneOff className={className} aria-hidden="true" />;
    case "Clock":
      return <Clock className={className} aria-hidden="true" />;
    case "Users":
      return <Users className={className} aria-hidden="true" />;
    case "ShieldAlert":
      return <ShieldAlert className={className} aria-hidden="true" />;
    case "UserX":
      return <UserX className={className} aria-hidden="true" />;
    case "RefreshCw":
      return <RefreshCw className={className} aria-hidden="true" />;
    case "Hourglass":
      return <Hourglass className={className} aria-hidden="true" />;
    case "HelpCircle":
    default:
      return <HelpCircle className={className} aria-hidden="true" />;
  }
}

function LostReasonDialogInner({
  leadName = "Lead",
  leadId,
  initialReason = null,
  initialNotes = "",
  onConfirm,
  onCancel,
  isSubmitting = false,
}: Omit<LostReasonDialogProps, "isOpen">) {
  const [selectedReason, setSelectedReason] = useState<PrismaLeadLossReason | null>(
    initialReason || null
  );
  const [notes, setNotes] = useState(initialNotes || "");
  const [step, setStep] = useState<"select" | "confirm">("select");
  const [touchedOther, setTouchedOther] = useState(false);

  const dialogRef = useRef<HTMLElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const firstReasonBtnRef = useRef<HTMLButtonElement>(null);

  // Handle Focus trap, scroll lock, and Escape key
  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus initial element based on step
    const timer = setTimeout(() => {
      if (step === "confirm") {
        confirmBtnRef.current?.focus();
      } else if (firstReasonBtnRef.current) {
        firstReasonBtnRef.current.focus();
      } else {
        closeBtnRef.current?.focus();
      }
    }, 50);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        event.preventDefault();
        onCancel();
        return;
      }

      // Focus trap within modal
      if (event.key === "Tab" && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const focusable = Array.from(focusableElements).filter(
          (el) => el.offsetParent !== null
        );

        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElement?.focus?.();
    };
  }, [step, isSubmitting, onCancel]);

  const isOtherSelected = selectedReason === "OTHER";
  const isOtherInvalid = isOtherSelected && notes.trim().length === 0;
  const canProceedToConfirm = Boolean(selectedReason) && !isOtherInvalid;

  const handleSelectReason = (reason: PrismaLeadLossReason) => {
    setSelectedReason(reason);
    if (reason === "OTHER") {
      setTouchedOther(true);
    }
  };

  const handleContinueToConfirm = () => {
    if (!selectedReason) return;
    if (isOtherInvalid) {
      setTouchedOther(true);
      return;
    }
    setStep("confirm");
  };

  const handleFinalConfirm = async () => {
    if (!selectedReason || isOtherInvalid || isSubmitting) return;

    await onConfirm({
      reason: selectedReason,
      notes: notes.trim() ? notes.trim() : undefined,
      leadId,
      leadName,
      confirmedAt: new Date().toISOString(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:items-center sm:p-4 animate-in fade-in duration-200"
      aria-labelledby="lost-reason-dialog-title"
      role="presentation"
    >
      {/* Light dismiss backdrop */}
      <button
        type="button"
        className="fixed inset-0 h-full w-full cursor-default bg-transparent"
        onClick={!isSubmitting ? onCancel : undefined}
        aria-label="Close dialog overlay"
        tabIndex={-1}
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lost-reason-dialog-title"
        aria-describedby="lost-reason-dialog-desc"
        className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl transition-all sm:rounded-2xl"
      >
        {/* Dialog Header */}
        <header className="flex items-center justify-between border-b border-slate-200/90 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1 pr-2">
            <h2
              id="lost-reason-dialog-title"
              className="text-base font-bold tracking-tight text-slate-950 sm:text-lg"
            >
              {step === "confirm" ? "Confirm Lead Outcome" : `Mark ${leadName} as Lost`}
            </h2>
            <p
              id="lost-reason-dialog-desc"
              className="mt-0.5 truncate text-xs text-slate-500 sm:text-sm"
            >
              {step === "confirm"
                ? "Please review details before final submission"
                : "Select why this deal did not close to capture analytics"}
            </p>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Cancel and close dialog"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 transition-colors"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        {/* Dialog Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {step === "select" ? (
            <div className="space-y-4 sm:space-y-5">
              {/* Reason Selector Chips/Cards */}
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                  <span>
                    Select Lost Reason <span className="text-rose-600">*</span>
                  </span>
                  {selectedReason && (
                    <span className="text-[11px] font-medium text-rose-600">
                      Selected: {selectedReason}
                    </span>
                  )}
                </legend>

                {/* Mobile-first tap friendly chips grid */}
                <div
                  role="radiogroup"
                  aria-label="Lost Reasons"
                  className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                >
                  {LOST_REASONS.map((reason, index) => {
                    const meta = LOST_REASON_DETAILS[reason];
                    const isSelected = selectedReason === reason;

                    return (
                      <button
                        key={reason}
                        ref={index === 0 ? firstReasonBtnRef : undefined}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => handleSelectReason(reason)}
                        className={`group relative flex min-h-[52px] w-full items-center justify-between rounded-xl border p-3 text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-1 ${
                          isSelected
                            ? "border-rose-500 bg-rose-50/70 shadow-xs ring-1 ring-rose-500"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div
                            className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${
                              isSelected
                                ? "bg-rose-100 text-rose-700"
                                : "bg-slate-100 text-slate-600 group-hover:bg-slate-200/80"
                            }`}
                          >
                            {renderReasonIcon(reason, isSelected)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-sm font-semibold tracking-tight ${
                                  isSelected ? "text-rose-950" : "text-slate-900"
                                }`}
                              >
                                {reason}
                              </span>
                              <span
                                className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                  isSelected
                                    ? "bg-rose-200/70 text-rose-800"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                                aria-hidden="true"
                              >
                                {meta.shortCode}
                              </span>
                            </div>
                            <p
                              className={`line-clamp-1 text-[11px] leading-tight ${
                                isSelected ? "text-rose-700" : "text-slate-500"
                              }`}
                            >
                              {meta.description}
                            </p>
                          </div>
                        </div>

                        <div className="ml-2 shrink-0">
                          <div
                            className={`grid size-5 place-items-center rounded-full border transition-colors ${
                              isSelected
                                ? "border-rose-600 bg-rose-600 text-white"
                                : "border-slate-300 bg-white group-hover:border-slate-400"
                            }`}
                            aria-hidden="true"
                          >
                            {isSelected && <Check className="size-3 stroke-[3]" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Optional or Required Explanation */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="lost-reason-notes"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-600"
                  >
                    {isOtherSelected ? (
                      <span className="text-rose-600 font-bold">
                        Explanation (Required for &apos;Other&apos;) *
                      </span>
                    ) : (
                      "Additional Notes (Optional)"
                    )}
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {notes.length}/500
                  </span>
                </div>

                <textarea
                  id="lost-reason-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  rows={isOtherSelected ? 3 : 2}
                  placeholder={
                    isOtherSelected
                      ? "Please describe why this lead was marked as lost..."
                      : "Add context, client feedback, or objections encountered..."
                  }
                  className={`w-full resize-none rounded-xl border p-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus-visible:ring-2 ${
                    isOtherInvalid && touchedOther
                      ? "border-rose-500 bg-rose-50/30 focus-visible:ring-rose-400"
                      : "border-slate-200 bg-white focus:border-rose-500 focus-visible:ring-rose-100"
                  }`}
                  aria-required={isOtherSelected}
                  aria-invalid={isOtherInvalid && touchedOther}
                  aria-describedby={
                    isOtherInvalid && touchedOther ? "other-error" : undefined
                  }
                />

                {/* Validation error for Other */}
                {isOtherInvalid && touchedOther && (
                  <div
                    id="other-error"
                    role="alert"
                    className="flex items-center gap-1.5 text-xs font-medium text-rose-600 pt-0.5"
                  >
                    <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>Please provide a short explanation when choosing &apos;Other&apos;.</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Step 2: Explicit Confirmation Flow */
            <div className="space-y-5 py-2">
              <div
                className="rounded-2xl border-2 border-rose-200 bg-gradient-to-b from-rose-50/80 to-white p-5 text-center shadow-xs"
                role="region"
                aria-label="Lost confirmation prompt"
              >
                <div className="mx-auto grid size-12 place-items-center rounded-full bg-rose-100 text-rose-600 ring-4 ring-rose-50">
                  <AlertCircle className="size-6" aria-hidden="true" />
                </div>

                <h3 className="mt-3 text-lg font-bold tracking-tight text-slate-950 sm:text-xl">
                  Mark {leadName} as Lost?
                </h3>

                <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2.5 shadow-xs">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Reason:
                  </span>
                  <span className="flex items-center gap-1.5 text-base font-bold text-rose-600">
                    {selectedReason && renderReasonIcon(selectedReason, true)}
                    {selectedReason}
                  </span>
                  {selectedReason && (
                    <span
                      className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-700"
                      aria-hidden="true"
                    >
                      {LOST_REASON_DETAILS[selectedReason].shortCode}
                    </span>
                  )}
                </div>

                {notes.trim() && (
                  <div className="mt-4 text-left rounded-xl border border-slate-200 bg-white p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Note preview:
                    </p>
                    <p className="mt-1 text-sm text-slate-800 break-words italic">
                      &ldquo;{notes.trim()}&rdquo;
                    </p>
                  </div>
                )}

                <p className="mt-4 text-xs text-slate-500">
                  User must explicitly confirm. This will record this reason for sales analytics.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Dialog Footer Actions */}
        <footer className="flex flex-col-reverse gap-2.5 border-t border-slate-200/90 bg-slate-50/60 px-4 py-3 sm:flex-row sm:justify-end sm:gap-3 sm:px-6">
          {step === "select" ? (
            <>
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 sm:w-auto transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleContinueToConfirm}
                disabled={!canProceedToConfirm || isSubmitting}
                className="h-11 w-full rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Continue</span>
                <span aria-hidden="true">&rarr;</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep("select")}
                disabled={isSubmitting}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 sm:w-auto transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                <span>Back</span>
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={handleFinalConfirm}
                disabled={isSubmitting}
                className="h-11 w-full rounded-xl bg-rose-600 px-6 text-sm font-bold text-white shadow-md hover:bg-rose-700 disabled:opacity-50 sm:w-auto transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                <span>{isSubmitting ? "Confirming..." : "Confirm Lost"}</span>
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}

export function LostReasonDialog(props: LostReasonDialogProps) {
  if (!props.isOpen) return null;
  const dialogKey = `${props.leadId || "lead"}-${props.leadName || "name"}-${props.initialReason || "none"}`;
  return <LostReasonDialogInner key={dialogKey} {...props} />;
}
