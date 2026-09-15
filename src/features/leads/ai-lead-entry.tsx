"use client";

import { useState } from "react";
import type { DuplicateLeadCandidate, StructuredLeadDraft, StructuredLeadResult } from "./ai-entry-types";
import type { BulkStructureLeadCallback, ReviewLeadResult } from "./bulk-review-types";
import { BulkLeadReview } from "./bulk-lead-review";
import type { Lead } from "./types";
import { StructuredLeadPreview } from "./structured-lead-preview";
import { UnstructuredAIInput } from "./unstructured-ai-input";
import { structureLeadAction } from "@/app/actions/ai-lead-entry";

type AILeadEntryProps = {
  saving: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
  onStructureLead?: BulkStructureLeadCallback;
  onBulkSaved?: (leads: Lead[]) => void;
  onBusyChange?: (busy: boolean) => void;
  onOpenDuplicate?: (candidate: DuplicateLeadCandidate) => void;
  onUpdateDuplicate?: (candidate: DuplicateLeadCandidate, draft: StructuredLeadDraft) => void;
};

export function AILeadEntry({
  saving,
  onSubmit,
  onStructureLead,
  onOpenDuplicate,
  onUpdateDuplicate,
  onBulkSaved,
  onBusyChange,
}: AILeadEntryProps) {
  const [bulk, setBulk] = useState<ReviewLeadResult[] | null>(null);
  const [reviewVersion, setReviewVersion] = useState(0);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [rawInput, setRawInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StructuredLeadResult | null>(null);

  async function structureLead() {
    const input = rawInput.trim();
    if (!input) return;
    setError(null);
    setProcessing(true);

    try {
      const runner = onStructureLead || structureLeadAction;
      const response = await runner(input);
      if (!response.success) {
        setError(response.error);
        return;
      }
      const data = response.data;
      const entries = Array.isArray(data) ? data : "drafts" in data ? data.drafts : "leads" in data ? data.leads : [data];
      const parsed: ReviewLeadResult[] = entries.map(item => "draft" in item ? item : {
        draft: item,
        possibleDuplicate: item.possibleDuplicate,
        itemStatus: item.itemStatus,
        validationErrors: item.validationErrors,
      });
      if (!parsed.length) { setError("No leads detected. Check your input and retry."); return; }
      setReviewVersion(current => current + 1);
      setBulk(parsed.length > 1 ? parsed : null);
      setResult(parsed.length === 1 ? parsed[0] : null);
    } catch {
      setError("AI couldn’t structure this lead. You can retry or use Manual Entry.");
    } finally {
      setProcessing(false);
    }
  }

  function updateDraft(draft: StructuredLeadDraft) {
    setResult((current) => (current ? { ...current, draft } : current));
  }

  return (
    <div
      className={`grid min-w-0 gap-4 p-4 sm:p-5 ${
        bulk ? "mx-auto w-full max-w-5xl" : result ? "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-5" : "mx-auto max-w-2xl"
      }`}
    >
      <UnstructuredAIInput
        value={rawInput}
        onChange={value => { if (!bulkSaving) setRawInput(value); }}
        onStructure={() => { if (!bulkSaving && !saving) void structureLead(); }}
        processing={processing || bulkSaving || saving}
        error={error}
      />
      {bulk ? <BulkLeadReview key={reviewVersion} leads={bulk} saving={saving} onSaved={onBulkSaved} onBusyChange={value => { setBulkSaving(value); onBusyChange?.(value); }} /> : result ? (
        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <StructuredLeadPreview
            draft={result.draft}
            duplicate={result.possibleDuplicate}
            saving={saving}
            onChange={updateDraft}
            onSubmit={onSubmit}
            onDismissDuplicate={() =>
              setResult((current) => (current ? { ...current, possibleDuplicate: null } : current))
            }
            onOpenDuplicate={onOpenDuplicate}
            onUpdateDuplicate={onUpdateDuplicate}
          />
        </section>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-6 text-center lg:hidden">
          <p className="text-sm font-medium text-slate-700">Structured fields will appear here</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Missing information will stay clearly marked for review.
          </p>
        </div>
      )}
    </div>
  );
}
