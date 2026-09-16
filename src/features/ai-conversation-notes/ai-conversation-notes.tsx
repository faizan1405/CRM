"use client";

import {
  AlertCircle,
  ArrowRightCircle,
  FileSpreadsheet,
  FileText,
  Info,
  Layers,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";
import { FollowUpCard } from "./follow-up-card";
import { formatStructuredCallNote } from "./formatters";

import { NoteOutputPreview } from "./note-output-preview";
import { OriginalNotePreservation } from "./original-note-preservation";
import { QuickTags } from "./quick-tags";
import { RawNotesInput } from "./raw-notes-input";
import { StructuredFieldRow } from "./structured-field-row";
import type {
  AIConversationNotesProps,
  CallNotesWorkflowResult,
  QuickTag,
  StructuredCallNotesData,
} from "./types";

export function AIConversationNotes({
  initialRawNote = "",
  availableTags,
  onStructureNotes = async () => ({} as StructuredCallNotesData),
  onApplyStructured,
  onKeepOriginal,
  className = "",
  disabled = false,
}: AIConversationNotesProps) {
  // 1. Raw Note State
  const [rawNote, setRawNote] = useState<string>(initialRawNote);
  const [isStructuring, setIsStructuring] = useState<boolean>(false);
  const [structureError, setStructureError] = useState<string | null>(null);

  // 2. Structured & Edited State
  const [structuredData, setStructuredData] = useState<StructuredCallNotesData | null>(null);

  // 3. Workflow Step: "input" | "review" | "applied"
  const [step, setStep] = useState<"input" | "review" | "applied">("input");
  const [lastResult, setLastResult] = useState<CallNotesWorkflowResult | null>(null);

  // Active view tab in Review step: "edit" | "preview"
  const [activeReviewTab, setActiveReviewTab] = useState<"edit" | "preview">("edit");

  // Handler: Structure Notes
  const handleStructure = async () => {
    if (!rawNote.trim() || isStructuring || disabled) return;
    setIsStructuring(true);
    setStructureError(null);

    try {
      const result = await onStructureNotes(rawNote.trim());
      setStructuredData({
        requirement: result.requirement ?? null,
        budget: result.budget ?? null,
        interestLevel: result.interestLevel ?? null,
        decisionFactor: result.decisionFactor ?? null,
        objections: result.objections ?? null,
        importantDetails: result.importantDetails ?? null,
        nextAction: result.nextAction ?? null,
        suggestedFollowUpDate: result.suggestedFollowUpDate ?? null,
        suggestedFollowUpTime: result.suggestedFollowUpTime ?? null,
        tags: result.tags ?? [],
      });
      setStep("review");
      setActiveReviewTab("edit");
    } catch {
      setStructureError("Failed to structure notes. Please check the text and try again.");
    } finally {
      setIsStructuring(false);
    }
  };

  // Field updater
  const updateField = <K extends keyof StructuredCallNotesData>(
    field: K,
    value: StructuredCallNotesData[K]
  ) => {
    if (!structuredData) return;
    setStructuredData((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  // Handler: Apply Structured Note
  const handleApplyStructured = () => {
    if (!structuredData || disabled) return;
    const formatted = formatStructuredCallNote(structuredData);
    const result: CallNotesWorkflowResult = {
      appliedType: "structured",
      formattedOutput: formatted,
      structuredData,
      rawNote,
      appliedAt: new Date().toISOString(),
    };
    setLastResult(result);
    setStep("applied");
    onApplyStructured?.(result);
  };

  // Handler: Keep Original Note
  const handleKeepOriginal = () => {
    if (disabled) return;
    const result: CallNotesWorkflowResult = {
      appliedType: "original",
      formattedOutput: rawNote,
      structuredData: null,
      rawNote,
      appliedAt: new Date().toISOString(),
    };
    setLastResult(result);
    setStep("applied");
    onKeepOriginal?.(result);
  };

  // Reset to edit raw note again
  const handleReset = () => {
    setStep("input");
    setLastResult(null);
  };

  return (
    <div className={`w-full max-w-2xl mx-auto space-y-5 ${className}`}>
      {/* Step Indicator Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white font-semibold text-xs shadow-sm">
            AI
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">AI Call / Conversation Notes</h3>
            <p className="text-xs text-slate-500">
              {step === "input" && "Enter quick rough notes from your call"}
              {step === "review" && "Review, edit & verify before saving"}
              {step === "applied" && "Note saved to activity record"}
            </p>
          </div>
        </div>

        {step !== "input" && (
          <button
            type="button"
            onClick={handleReset}
            disabled={disabled}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 active:bg-slate-100"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            <span>Start Over</span>
          </button>
        )}
      </div>

      {structureError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <span>{structureError}</span>
        </div>
      )}

      {/* STEP 1: RAW INPUT */}
      {step === "input" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm space-y-4">
          <RawNotesInput
            value={rawNote}
            onChange={setRawNote}
            onStructure={handleStructure}
            isLoading={isStructuring}
            disabled={disabled}
          />
        </div>
      )}

      {/* STEP 2: REVIEW & EDIT */}
      {step === "review" && structuredData && (
        <div className="space-y-5">
          {/* Always Preserved Original Raw Note */}
          <OriginalNotePreservation rawNote={rawNote} />

          {/* Review Tab Navigation */}
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveReviewTab("edit")}
              className={`flex-1 min-h-11 rounded-lg text-xs font-semibold transition ${
                activeReviewTab === "edit"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <FileSpreadsheet className="size-3.5" aria-hidden="true" />
                Structured Fields &amp; Edit
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveReviewTab("preview")}
              className={`flex-1 min-h-11 rounded-lg text-xs font-semibold transition ${
                activeReviewTab === "preview"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <FileText className="size-3.5" aria-hidden="true" />
                Activity Note Output
              </span>
            </button>
          </div>

          {activeReviewTab === "edit" ? (
            <div className="space-y-4">
              {/* Follow-up Suggestion Section */}
              <FollowUpCard
                date={structuredData.suggestedFollowUpDate}
                time={structuredData.suggestedFollowUpTime}
                onDateChange={(val) => updateField("suggestedFollowUpDate", val)}
                onTimeChange={(val) => updateField("suggestedFollowUpTime", val)}
                disabled={disabled}
              />

              {/* Quick Tags Section */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <QuickTags
                  selectedTags={structuredData.tags ?? []}
                  onChange={(tags: QuickTag[]) => updateField("tags", tags)}
                  availableTags={availableTags}
                  disabled={disabled}
                />
              </div>

              {/* Core Structured Fields */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Structured Details (Editable)
                  </h4>
                  <span className="text-[11px] text-slate-400">Tap any field to modify</span>
                </div>

                <StructuredFieldRow
                  label="Requirement"
                  fieldKey="requirement"
                  value={structuredData.requirement}
                  onChange={(val) => updateField("requirement", val)}
                  icon={Layers}
                  placeholder="e.g. E-commerce Website"
                  disabled={disabled}
                />


                <StructuredFieldRow
                  label="Interest Level"
                  fieldKey="interestLevel"
                  value={structuredData.interestLevel}
                  onChange={(val) => updateField("interestLevel", val)}
                  icon={TrendingUp}
                  isInterestLevel
                  disabled={disabled}
                />

                <StructuredFieldRow
                  label="Decision Factor"
                  fieldKey="decisionFactor"
                  value={structuredData.decisionFactor}
                  onChange={(val) => updateField("decisionFactor", val)}
                  icon={Users}
                  placeholder="e.g. Discuss with partner"
                  disabled={disabled}
                />

                <StructuredFieldRow
                  label="Objections"
                  fieldKey="objections"
                  value={structuredData.objections}
                  onChange={(val) => updateField("objections", val)}
                  icon={AlertCircle}
                  placeholder="e.g. Price sensitivity or delivery timeline"
                  disabled={disabled}
                />

                <StructuredFieldRow
                  label="Important Details"
                  fieldKey="importantDetails"
                  value={structuredData.importantDetails}
                  onChange={(val) => updateField("importantDetails", val)}
                  icon={Info}
                  placeholder="e.g. Additional client context"
                  disabled={disabled}
                />

                <StructuredFieldRow
                  label="Next Action"
                  fieldKey="nextAction"
                  value={structuredData.nextAction}
                  onChange={(val) => updateField("nextAction", val)}
                  icon={ArrowRightCircle}
                  placeholder="e.g. Send proposal by tomorrow"
                  disabled={disabled}
                />
              </div>
            </div>
          ) : (
            <NoteOutputPreview data={structuredData} />
          )}

          {/* Action Bar: Apply Structured Note vs Keep Original */}
          <div className="sticky bottom-4 z-10 rounded-2xl border border-slate-200/80 bg-white/95 p-3.5 shadow-xl backdrop-blur-md">
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                onClick={handleApplyStructured}
                disabled={disabled}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
              >
                <Sparkles className="size-4 text-blue-200" aria-hidden="true" />
                <span>Apply Structured Note</span>
              </button>

              <button
                type="button"
                onClick={handleKeepOriginal}
                disabled={disabled}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
              >
                <FileText className="size-4 text-slate-500" aria-hidden="true" />
                <span>Keep Original</span>
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-500">
              Your raw note is permanently safe. AI will never overwrite without your choice.
            </p>
          </div>
        </div>
      )}

      {/* STEP 3: APPLIED CONFIRMATION */}
      {step === "applied" && lastResult && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-600 p-2 text-white">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-950">
                {lastResult.appliedType === "structured"
                  ? "Structured Note Applied Successfully!"
                  : "Original Raw Note Kept Successfully!"}
              </h4>
              <p className="text-xs text-emerald-800 mt-0.5">
                Saved for Phase 5 Lead Activity Notes. Both formats are preserved.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-xs">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Final Saved Note Output
            </h5>
            <pre className="font-mono text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
              {lastResult.formattedOutput}
            </pre>
          </div>

          <OriginalNotePreservation rawNote={rawNote} />

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-50 active:scale-[0.98]"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            <span>Create Another Note</span>
          </button>
        </div>
      )}
    </div>
  );
}
