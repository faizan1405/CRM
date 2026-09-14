"use client";

import React, { useState } from "react";
import {
  LostReasonDialog,
  LostLeadDetail,
  LostReasonsAnalytics,
  MOCK_LOST_REASONS_ANALYTICS,
  MOCK_LOST_LEAD_SAMPLE,
  MOCK_LOST_LEADS_LIST,
  type LostReasonSubmission,
} from "@/features/lost-reasons";
import {
  CheckCircle2,
  Smartphone,
  Eye,
  RotateCcw,
} from "lucide-react";

export default function LostReasonsDemoPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentLeadName, setCurrentLeadName] = useState("Rahul");
  const [lastSubmission, setLastSubmission] = useState<LostReasonSubmission | null>(null);
  const [simulatedWidth, setSimulatedWidth] = useState<"full" | "360" | "390">("full");
  const [showEmptyAnalytics, setShowEmptyAnalytics] = useState(false);

  const handleOpenDialog = (name: string) => {
    setCurrentLeadName(name);
    setDialogOpen(true);
  };

  const handleConfirmLost = (data: LostReasonSubmission) => {
    setLastSubmission(data);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Page Title & Controls */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-rose-800">
              Feature Preview
            </span>
            <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
              Lost Reason Tracking UI
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Interactive verification sandbox for Lost Reason Dialog, Detail, &amp; Analytics UI.
          </p>
        </div>

        {/* Viewport Simulation Switches for quick 360px / 390px inspection */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
          <button
            type="button"
            onClick={() => setSimulatedWidth("full")}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              simulatedWidth === "full"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Responsive
          </button>
          <button
            type="button"
            onClick={() => setSimulatedWidth("390")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              simulatedWidth === "390"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Smartphone className="size-3" aria-hidden="true" />
            <span>390px</span>
          </button>
          <button
            type="button"
            onClick={() => setSimulatedWidth("360")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              simulatedWidth === "360"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Smartphone className="size-3" aria-hidden="true" />
            <span>360px</span>
          </button>
        </div>
      </header>

      {/* Main Container constrained when simulated */}
      <div
        className={`mx-auto transition-all ${
          simulatedWidth === "360"
            ? "max-w-[360px] rounded-2xl border-4 border-slate-300 p-2 shadow-xl"
            : simulatedWidth === "390"
            ? "max-w-[390px] rounded-2xl border-4 border-slate-300 p-2 shadow-xl"
            : "w-full"
        }`}
      >
        {/* Section 1: Lost Reason Dialog Trigger */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950">1. Lost Reason Dialog</h2>
              <p className="text-xs text-slate-500">
                Trigger confirmation modal with 9 fast-tap reasons, Other validation, and 2-step confirmation.
              </p>
            </div>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
              Ready
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => handleOpenDialog("Rahul")}
              className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-rose-700 transition-colors"
            >
              Mark Rahul as Lost &rarr;
            </button>
            <button
              type="button"
              onClick={() => handleOpenDialog("Priya Patel")}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-800 hover:bg-rose-100 transition-colors"
            >
              Mark Priya as Lost &rarr;
            </button>
            <button
              type="button"
              onClick={() => handleOpenDialog("Apex Logistics")}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Mark Apex Logistics as Lost &rarr;
            </button>
          </div>

          {/* Last Submission Callback Output */}
          {lastSubmission && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
                <span>Callback onConfirm Captured Payload:</span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-emerald-950 sm:grid-cols-2">
                <p>
                  <strong>Lead:</strong> {lastSubmission.leadName}
                </p>
                <p>
                  <strong>Reason:</strong> {lastSubmission.reason}
                </p>
                <p className="sm:col-span-2">
                  <strong>Notes:</strong> {lastSubmission.notes || "(None provided)"}
                </p>
                <p className="text-[10px] text-emerald-700 sm:col-span-2">
                  <strong>Timestamp:</strong> {lastSubmission.confirmedAt}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Section 2: Lost Lead Detail Component */}
        <section className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950">2. Lost Lead Detail Component</h2>
              <p className="text-xs text-slate-500">
                Compact reusable display for lost deal context and client notes.
              </p>
            </div>
            <Eye className="size-4 text-slate-400" aria-hidden="true" />
          </div>

          {/* Exact specification requirement sample:
              Lost — Price
              15 Sep 2026
              Client felt the quotation was above budget.
          */}
          <div className="space-y-3 pt-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Specification Standard Example:
              </p>
              <LostLeadDetail
                reason={MOCK_LOST_LEAD_SAMPLE.reason}
                lostAt={MOCK_LOST_LEAD_SAMPLE.lostAt}
                notes={MOCK_LOST_LEAD_SAMPLE.notes}
              />
            </div>

            {/* Compact Mode Badges */}
            <div className="pt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Compact Badge Mode:
              </p>
              <div className="flex flex-wrap gap-2">
                {MOCK_LOST_LEADS_LIST.slice(0, 3).map((item) => (
                  <LostLeadDetail
                    key={item.id}
                    reason={item.reason}
                    lostAt={item.lostAt}
                    compact
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Lost Reasons Analytics UI */}
        <section className="mt-6 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-base font-bold text-slate-950">3. Lost Reasons Analytics UI</h2>
            <button
              type="button"
              onClick={() => setShowEmptyAnalytics(!showEmptyAnalytics)}
              className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              <span>{showEmptyAnalytics ? "Show Populated Data" : "Test Empty State"}</span>
            </button>
          </div>

          <LostReasonsAnalytics
            data={
              showEmptyAnalytics
                ? {
                    totalLost: 0,
                    breakdown: [],
                    topReason: null,
                    period: "This Month",
                    aiInsight: null,
                  }
                : MOCK_LOST_REASONS_ANALYTICS
            }
          />
        </section>
      </div>

      {/* The Reusable Dialog */}
      <LostReasonDialog
        isOpen={dialogOpen}
        leadName={currentLeadName}
        onConfirm={handleConfirmLost}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  );
}
