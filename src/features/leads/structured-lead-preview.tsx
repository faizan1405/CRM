"use client";

import { BadgeCheck, Save } from "lucide-react";
import { leadStatuses } from "./types";
import type { DuplicateLeadCandidate, StructuredLeadDraft, StructuredLeadField } from "./ai-entry-types";
import { DuplicateLeadWarning } from "./duplicate-lead-warning";
import { FollowUpSuggestion } from "./follow-up-suggestion";

type StructuredLeadPreviewProps = {
  idSuffix?: string;
  draft: StructuredLeadDraft;
  duplicate?: DuplicateLeadCandidate | null;
  saving: boolean;
  onChange: (draft: StructuredLeadDraft) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  onDismissDuplicate: () => void;
  onOpenDuplicate?: (candidate: DuplicateLeadCandidate) => void;
  onUpdateDuplicate?: (candidate: DuplicateLeadCandidate, draft: StructuredLeadDraft) => void;
};

const inputClass =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-sm";

function ConfidenceBadge({ field, draft }: { field: StructuredLeadField; draft: StructuredLeadDraft }) {
  const confidence = draft.confidence?.[field];
  const value = draft[field];
  if (value === null || value === undefined || value === "") {
    return (
      <span className="rounded-full border border-dashed border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
        Not provided
      </span>
    );
  }
  if (!confidence) {
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
        Extracted
      </span>
    );
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        confidence === "high" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
      }`}
    >
      {confidence === "high" ? "High confidence" : "Needs review"}
    </span>
  );
}

function FieldLabel({
  label,
  field,
  draft,
  required = false,
}: {
  label: string;
  field: StructuredLeadField;
  draft: StructuredLeadDraft;
  required?: boolean;
}) {
  return (
    <span className="flex min-h-5 flex-wrap items-center justify-between gap-1.5 text-sm font-medium text-slate-700">
      <span>
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>
      <ConfidenceBadge field={field} draft={draft} />
    </span>
  );
}

export function StructuredLeadPreview({
  idSuffix = "single",
  draft,
  duplicate,
  saving,
  onChange,
  onSubmit,
  onDismissDuplicate,
  onOpenDuplicate,
  onUpdateDuplicate,
}: StructuredLeadPreviewProps) {
  const update = <K extends keyof StructuredLeadDraft>(key: K, value: StructuredLeadDraft[K]) =>
    onChange({ ...draft, [key]: value });
  const fields: StructuredLeadField[] = [
    "name",
    "phone",
    "email",
    "business",
    "industryOrRequirement",
    "budget",
    "status",
    "notes",
    "suggestedFollowUpDate",
    "suggestedFollowUpTime",
  ];
  const extractedCount = fields.filter(
    (field) => draft[field] !== null && draft[field] !== undefined && draft[field] !== ""
  ).length;

  return (
    <form action={onSubmit} className="space-y-4" aria-labelledby={`structured-preview-title-${idSuffix}`}>
      <input type="hidden" name="source" value="" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={`structured-preview-title-${idSuffix}`} className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <BadgeCheck aria-hidden="true" className="text-blue-600" size={19} />
            Review structured lead
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {extractedCount} of {fields.length} fields extracted. Missing fields stay empty.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">Editable</span>
      </div>

      {duplicate ? (
        <DuplicateLeadWarning
          candidate={duplicate}
          onOpenExisting={onOpenDuplicate}
          onUpdateExisting={(candidate) => onUpdateDuplicate?.(candidate, draft)}
          onCreateAnyway={onDismissDuplicate}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <FieldLabel label="Name" field="name" draft={draft} required />
          <input
            name="name"
            required
            maxLength={120}
            autoComplete="name"
            value={draft.name ?? ""}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Not provided"
            className={inputClass}
          />
        </label>
        <label>
          <FieldLabel label="Phone" field="phone" draft={draft} required />
          <input
            name="phone"
            type="tel"
            required
            maxLength={40}
            autoComplete="tel"
            value={draft.phone ?? ""}
            onChange={(event) => update("phone", event.target.value)}
            placeholder="Not provided"
            className={inputClass}
          />
        </label>
        <label>
          <FieldLabel label="Email" field="email" draft={draft} />
          <input
            name="email"
            type="email"
            maxLength={254}
            autoComplete="email"
            value={draft.email ?? ""}
            onChange={(event) => update("email", event.target.value)}
            placeholder="Not provided"
            className={inputClass}
          />
        </label>
        <label>
          <FieldLabel label="Business" field="business" draft={draft} />
          <input
            name="business"
            maxLength={160}
            autoComplete="organization"
            value={draft.business ?? ""}
            onChange={(event) => update("business", event.target.value)}
            placeholder="Not provided"
            className={inputClass}
          />
        </label>
        <label className="sm:col-span-2">
          <FieldLabel label="Industry / Requirement" field="industryOrRequirement" draft={draft} />
          <input
            name="industry"
            maxLength={100}
            value={draft.industryOrRequirement ?? ""}
            onChange={(event) => update("industryOrRequirement", event.target.value)}
            placeholder="Not provided"
            className={inputClass}
          />
        </label>
        <label>
          <FieldLabel label="Budget" field="budget" draft={draft} />
          <input
            name="budget"
            type="number"
            min="0"
            max="9999999999.99"
            step="0.01"
            inputMode="decimal"
            value={draft.budget ?? ""}
            onChange={(event) => update("budget", event.target.value ? Number(event.target.value) : null)}
            placeholder="Not provided"
            className={inputClass}
          />
        </label>
        <label>
          <FieldLabel label="Status" field="status" draft={draft} required />
          <select
            name="status"
            required
            value={draft.status ?? ""}
            onChange={(event) => update("status", event.target.value as StructuredLeadDraft["status"])}
            className={inputClass}
          >
            <option value="" disabled>
              Not provided — choose status
            </option>
            {leadStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          <FieldLabel label="Notes" field="notes" draft={draft} />
          <textarea
            name="notes"
            maxLength={5000}
            rows={4}
            value={draft.notes ?? ""}
            onChange={(event) => update("notes", event.target.value)}
            placeholder="Not provided"
            className={`${inputClass} h-auto min-h-24 resize-y py-3`}
          />
        </label>
      </div>

      <FollowUpSuggestion
        date={draft.suggestedFollowUpDate ?? ""}
        time={draft.suggestedFollowUpTime ?? ""}
        onDateChange={(value) => update("suggestedFollowUpDate", value)}
        onTimeChange={(value) => update("suggestedFollowUpTime", value)}
      />

      <button
        type="submit"
        disabled={saving}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:cursor-wait disabled:opacity-60"
      >
        <Save aria-hidden="true" size={18} />
        {saving ? "Saving lead…" : "Save Lead"}
      </button>
      <p className="text-center text-xs text-slate-500">Nothing is saved until you review and confirm.</p>
    </form>
  );
}
