"use client";

import { useState } from "react";
import type { DuplicateLeadCandidate, StructuredLeadDraft, StructuredLeadResult, StructureLeadCallback } from "./ai-entry-types";
import { StructuredLeadPreview } from "./structured-lead-preview";
import { UnstructuredAIInput } from "./unstructured-ai-input";
import { structureLeadAction } from "@/app/actions/ai-lead-entry";

type AILeadEntryProps = {
  saving: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
  onStructureLead?: StructureLeadCallback;
  onOpenDuplicate?: (candidate: DuplicateLeadCandidate) => void;
  onUpdateDuplicate?: (candidate: DuplicateLeadCandidate, draft: StructuredLeadDraft) => void;
};

export function AILeadEntry({
  saving,
  onSubmit,
  onStructureLead,
  onOpenDuplicate,
  onUpdateDuplicate,
}: AILeadEntryProps) {
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
      setResult(response.data);
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
        result ? "lg:grid-cols-[minmax(18rem,0.8fr)_minmax(24rem,1.2fr)] lg:gap-5" : "mx-auto max-w-2xl"
      }`}
    >
      <UnstructuredAIInput
        value={rawInput}
        onChange={setRawInput}
        onStructure={structureLead}
        processing={processing}
        error={error}
      />
      {result ? (
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
