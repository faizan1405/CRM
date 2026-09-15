"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, AlertTriangle, Check, X, Users } from "lucide-react";

interface DemoDataControlProps {
  onCreateDemoLeads?: () => Promise<{ success: boolean; message?: string }> | { success: boolean; message?: string } | void;
}

export function DemoDataControl({ onCreateDemoLeads }: DemoDataControlProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isConfirmOpen) return;
    confirmBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isGenerating) {
        setIsConfirmOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isConfirmOpen, isGenerating]);

  const handleConfirmTrigger = async () => {
    setIsGenerating(true);
    setFeedback(null);
    try {
      if (onCreateDemoLeads) {
        const res = await onCreateDemoLeads();
        if (res && typeof res === "object" && "success" in res && !res.success) {
          setFeedback({
            type: "error",
            message: res.message || "Failed to generate demo leads.",
          });
          setIsConfirmOpen(false);
          return;
        }
      }
      setFeedback({
        type: "success",
        message: "Demo leads creation request triggered successfully.",
      });
      setIsConfirmOpen(false);
    } catch {
      setFeedback({
        type: "error",
        message: "An error occurred while creating demo leads.",
      });
      setIsConfirmOpen(false);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section
      aria-labelledby="demo-data-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4"
    >
      <div className="border-b border-slate-100 pb-3">
        <h2 id="demo-data-heading" className="text-base sm:text-lg font-bold text-slate-950">
          Demo &amp; Testing Controls
        </h2>
        <p className="text-xs text-slate-500">
          Populate realistic demo records for team onboarding and sales training.
        </p>
      </div>

      {/* Warning Box */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
        <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-amber-950">
            Demo data is for testing and training.
          </h3>
          <p className="text-xs text-amber-800 leading-relaxed">
            Generating demo leads will add sample contacts, call notes, and follow-up tasks into your workspace for training purposes.
          </p>
        </div>
      </div>

      {/* Status Feedback */}
      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-xl p-3 text-xs sm:text-sm ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-rose-50 text-rose-900 border border-rose-200"
          }`}
        >
          {feedback.type === "success" ? (
            <Check size={16} className="text-emerald-600 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle size={16} className="text-rose-600 shrink-0" aria-hidden="true" />
          )}
          <span className="font-medium">{feedback.message}</span>
        </div>
      )}

      {/* Action Button */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setIsConfirmOpen(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 active:bg-slate-100 transition-colors"
        >
          <Users size={16} className="text-blue-600" aria-hidden="true" />
          <span>Create Demo Leads</span>
        </button>
      </div>

      {/* Confirmation Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
            onClick={isGenerating ? undefined : () => setIsConfirmOpen(false)}
            aria-hidden="true"
          />

          {/* Modal Card */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-demo-title"
            aria-describedby="confirm-demo-desc"
            className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl transition-all"
          >
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              disabled={isGenerating}
              className="absolute right-4 top-4 grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
              aria-label="Close dialog"
            >
              <X size={18} aria-hidden="true" />
            </button>

            <div className="flex items-start gap-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                <Sparkles size={22} aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 id="confirm-demo-title" className="text-base font-bold text-slate-950">
                  Create Demo Leads?
                </h3>
                <p id="confirm-demo-desc" className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  <span className="font-semibold text-slate-900">Demo data is for testing and training.</span> Are you sure you want to proceed with generating sample leads in your workspace?
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isGenerating}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                ref={confirmBtnRef}
                type="button"
                onClick={handleConfirmTrigger}
                disabled={isGenerating}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
              >
                <Sparkles size={15} aria-hidden="true" />
                <span>{isGenerating ? "Generating..." : "Confirm & Create"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
