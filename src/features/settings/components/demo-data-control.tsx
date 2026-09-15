"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, AlertTriangle, Check, X, Users, Trash2, Bomb } from "lucide-react";
import { populateDemoDataAction, clearDemoDataAction } from "@/app/actions/demo-data";
import { deleteAllLeadsAction } from "@/app/actions/leads";

export interface DemoDataControlProps {
  onCreateDemoLeads?: () => Promise<{ success: boolean; message?: string; count?: number }> | { success: boolean; message?: string; count?: number } | void;
  onClearDemoLeads?: () => Promise<{ success: boolean; message?: string; count?: number }> | { success: boolean; message?: string; count?: number } | void;
}

export function DemoDataControl({ onCreateDemoLeads, onClearDemoLeads }: DemoDataControlProps) {
  const [modalMode, setModalMode] = useState<"create" | "clear" | "purge" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!modalMode) return;
    confirmBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        setModalMode(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalMode, isLoading]);

  const handleCreateConfirm = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      if (onCreateDemoLeads) {
        const res = await onCreateDemoLeads();
        if (res && typeof res === "object" && "success" in res && !res.success) {
          setFeedback({
            type: "error",
            message: res.message || "Failed to generate demo leads.",
          });
          setModalMode(null);
          return;
        }
      } else {
        const res = await populateDemoDataAction();
        if (!res.success) {
          setFeedback({
            type: "error",
            message: res.error || "Failed to generate demo leads.",
          });
          setModalMode(null);
          return;
        }
      }
      setFeedback({
        type: "success",
        message: "Demo leads created successfully (10 realistic leads with AI insights).",
      });
      setModalMode(null);
    } catch {
      setFeedback({
        type: "error",
        message: "An error occurred while creating demo leads.",
      });
      setModalMode(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearConfirm = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      if (onClearDemoLeads) {
        const res = await onClearDemoLeads();
        if (res && typeof res === "object" && "success" in res && !res.success) {
          setFeedback({
            type: "error",
            message: res.message || "Failed to clear demo leads.",
          });
          setModalMode(null);
          return;
        }
      } else {
        const res = await clearDemoDataAction();
        if (!res.success) {
          setFeedback({
            type: "error",
            message: res.error || "Failed to clear demo leads.",
          });
          setModalMode(null);
          return;
        }
      }
      setFeedback({
        type: "success",
        message: "All demo leads and associated tasks have been safely cleaned up.",
      });
      setModalMode(null);
    } catch {
      setFeedback({
        type: "error",
        message: "An error occurred while cleaning demo leads.",
      });
      setModalMode(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurgeConfirm = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await deleteAllLeadsAction();
      if (!res.success) {
        setFeedback({
          type: "error",
          message: res.error || "Failed to purge all leads.",
        });
        setModalMode(null);
        return;
      }
      const parts = [`Purged ${res.leadCount} leads`];
      if (res.followUpCount) parts.push(`${res.followUpCount} follow-ups`);
      if (res.activityCount) parts.push(`${res.activityCount} activities`);
      if (res.insightCount) parts.push(`${res.insightCount} AI insights`);
      if (res.notificationCount) parts.push(`${res.notificationCount} notifications`);
      if (res.lossEventCount) parts.push(`${res.lossEventCount} loss events`);
      setFeedback({
        type: "success",
        message: parts.join(", ") + ". Production workspace is now clean.",
      });
      setModalMode(null);
    } catch {
      setFeedback({
        type: "error",
        message: "An error occurred while purging leads.",
      });
      setModalMode(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section
      aria-labelledby="demo-data-heading"
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4"
    >
      <div className="border-b border-slate-100 pb-3">
        <h2 id="demo-data-heading" className="text-base sm:text-lg font-bold text-slate-950">
          Demo &amp; Testing Pipeline
        </h2>
        <p className="text-xs text-slate-500">
          Populate and clean realistic demo records for team onboarding, workflow testing, and sales training.
        </p>
      </div>

      {/* Warning Box */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
        <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-amber-950">
            Demo data isolation guarantee
          </h3>
          <p className="text-xs text-amber-800 leading-relaxed">
            Demo records are explicitly tagged with <span className="font-mono font-semibold">[DEMO]</span> prefixes so they can be isolated, explored, and purged anytime without affecting real client data.
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

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => setModalMode("create")}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 active:bg-slate-100 transition-colors"
        >
          <Users size={16} className="text-blue-600" aria-hidden="true" />
          <span>Create Demo Leads (10)</span>
        </button>

        <button
          type="button"
          onClick={() => setModalMode("clear")}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-rose-700 shadow-2xs hover:bg-rose-50 active:bg-rose-100 transition-colors"
        >
          <Trash2 size={16} className="text-rose-600" aria-hidden="true" />
          <span>Clean Demo Leads</span>
        </button>

        <button
          type="button"
          onClick={() => setModalMode("purge")}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 shadow-2xs hover:bg-red-50 active:bg-red-100 transition-colors"
        >
          <Bomb size={16} className="text-red-600" aria-hidden="true" />
          <span>Purge All Leads</span>
        </button>
      </div>

      {/* Confirmation Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
            onClick={isLoading ? undefined : () => setModalMode(null)}
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
              onClick={() => setModalMode(null)}
              disabled={isLoading}
              className="absolute right-4 top-4 grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
              aria-label="Close dialog"
            >
              <X size={18} aria-hidden="true" />
            </button>

            <div className="flex items-start gap-4">
              <div className={`grid size-11 shrink-0 place-items-center rounded-xl border ${
                modalMode === "purge"
                  ? "bg-red-50 text-red-600 border-red-100"
                  : modalMode === "create"
                  ? "bg-amber-50 text-amber-600 border-amber-100"
                  : "bg-rose-50 text-rose-600 border-rose-100"
              }`}>
                {modalMode === "purge" ? (
                  <Bomb size={22} aria-hidden="true" />
                ) : modalMode === "create" ? (
                  <Sparkles size={22} aria-hidden="true" />
                ) : (
                  <Trash2 size={22} aria-hidden="true" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h3 id="confirm-demo-title" className="text-base font-bold text-slate-950">
                  {modalMode === "purge"
                    ? "Purge ALL Leads?"
                    : modalMode === "create"
                    ? "Create Demo Leads?"
                    : "Clear All Demo Leads?"}
                </h3>
                <p id="confirm-demo-desc" className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  {modalMode === "purge" ? (
                    <>
                      <span className="font-semibold text-red-700">This will permanently delete every lead</span> in the workspace, including follow-ups, activities, AI insights, notifications, and loss events. Users, personal notes, WhatsApp templates, and settings are NOT affected. This action cannot be undone.
                    </>
                  ) : modalMode === "create" ? (
                    <>
                      <span className="font-semibold text-slate-900">Demo data is for testing and training.</span> This will generate 10 realistic leads with activity histories and AI insights.
                    </>
                  ) : (
                    <>
                      This will remove all generated demo leads and their associated tasks from your workspace. Real client data will not be touched.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                disabled={isLoading}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                ref={confirmBtnRef}
                type="button"
                onClick={modalMode === "create" ? handleCreateConfirm : modalMode === "clear" ? handleClearConfirm : handlePurgeConfirm}
                disabled={isLoading}
                className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white shadow-xs disabled:opacity-50 ${
                  modalMode === "purge"
                    ? "bg-red-600 hover:bg-red-700 active:bg-red-800"
                    : modalMode === "create"
                    ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
                    : "bg-rose-600 hover:bg-rose-700 active:bg-rose-800"
                }`}
              >
                {modalMode === "purge" ? (
                  <>
                    <Bomb size={15} aria-hidden="true" />
                    <span>{isLoading ? "Purging..." : "Confirm & Purge"}</span>
                  </>
                ) : modalMode === "create" ? (
                  <>
                    <Sparkles size={15} aria-hidden="true" />
                    <span>{isLoading ? "Generating..." : "Confirm & Create"}</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={15} aria-hidden="true" />
                    <span>{isLoading ? "Cleaning..." : "Confirm & Delete"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
