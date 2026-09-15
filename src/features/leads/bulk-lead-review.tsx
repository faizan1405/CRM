"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLead } from "@/app/actions/leads";
import { updateExistingLeadWithDraftAction } from "@/app/actions/ai-lead-entry";
import { ActionCard } from "@/components/action-card";
import type { StructuredLeadDraft } from "./ai-entry-types";
import type { ReviewLeadResult } from "./bulk-review-types";
import { StructuredLeadPreview } from "./structured-lead-preview";
import { useLeadNavigation } from "./lead-navigation-provider";
import type { Lead } from "./types";

type ReviewItem = ReviewLeadResult & { id: number; excluded: boolean; saved: boolean; error?: string };
const buttonClass = "min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50";

export function draftToFormData(draft: StructuredLeadDraft): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: draft.name, phone: draft.phone, email: draft.email, business: draft.business, industry: draft.industryOrRequirement, budget: draft.budget, status: draft.status, notes: draft.notes, source: "", nextFollowUpDate: draft.suggestedFollowUpDate, nextFollowUpTime: draft.suggestedFollowUpTime })) {
    form.set(key, value === null || value === undefined ? "" : String(value));
  }
  return form;
}

export function reviewState(item: ReviewLeadResult): "Ready" | "Duplicate" | "Needs Review" | "Invalid" {
  const d = item.draft;
  if (item.itemStatus === "INVALID" || item.validationErrors?.length) return "Invalid";
  if (!d.name?.trim() || !d.phone?.trim() || !d.status) return "Needs Review";
  if (d.name.length > 120 || d.phone.length > 40 || d.phone.replace(/\D/g, "").length < 7 ||
    (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) ||
    (d.budget !== null && d.budget !== undefined && (!Number.isFinite(d.budget) || d.budget < 0 || d.budget > 9999999999.99))) return "Invalid";
  if (item.possibleDuplicate || item.itemStatus?.startsWith("DUPLICATE")) return "Duplicate";
  if (item.itemStatus === "NEEDS_REVIEW") return "Needs Review";
  if (Object.values(d.confidence || {}).some(confidence => confidence === "review")) return "Needs Review";
  return "Ready";
}

export function BulkLeadReview({ leads, saving, onSaved, onBusyChange }: { leads: ReviewLeadResult[]; saving: boolean; onSaved?: (leads: Lead[]) => void; onBusyChange?: (busy: boolean) => void }) {
  const [items, setItems] = useState<ReviewItem[]>(() => leads.map((lead, id) => ({ ...lead, id, excluded: false, saved: false })));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const navigation = useLeadNavigation();
  const router = useRouter();
  const patch = (id: number, updates: Partial<ReviewItem>) => setItems(current => current.map(item => item.id === id ? { ...item, ...updates } : item));
  const ready = items.filter(item => !item.excluded && !item.saved && reviewState(item) === "Ready");
  const disabled = saving || busy;

  async function addItems(selected: ReviewItem[]) {
    if (disabled || !selected.length) return;
    setBusy(true); onBusyChange?.(true);
    const created: Lead[] = [];
    try {
      for (const [index, item] of selected.entries()) {
        setProgress(`Saving ${index + 1} of ${selected.length}…`);
        try {
          const result = await createLead(draftToFormData(item.draft));
          if (result.success) { created.push(result.data); patch(item.id, { saved: true, error: undefined }); }
          else patch(item.id, { error: result.error });
        } catch { patch(item.id, { error: "Could not save. Review this item and retry." }); }
      }
      setProgress(`${created.length} lead${created.length === 1 ? "" : "s"} added. Failed items remain available to retry.`);
      if (created.length) { onSaved?.(created); router.refresh(); }
    } finally { setBusy(false); onBusyChange?.(false); }
  }

  return <section aria-label="Bulk lead review" className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold text-slate-950">{items.length} leads detected</h2><p className="text-xs text-slate-500">{ready.length} ready to add. Review each lead before saving.</p></div>
      <button type="button" disabled={disabled || !ready.length} onClick={() => void addItems(ready)} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50">Add All Valid Leads</button>
    </div>
    {progress && <p role="status" className="text-sm text-slate-600">{progress}</p>}
    <div className="grid min-w-0 gap-3 xl:grid-cols-2">
      {items.map(item => {
        const state = item.saved ? "Saved" : item.excluded ? "Excluded" : reviewState(item);
        return <ActionCard onActivate={!item.saved && !disabled ? () => setEditingId(item.id) : undefined} key={item.id} aria-label={`Review lead ${item.id + 1}: ${item.draft.name || "Unnamed"}`} className={`min-w-0 rounded-xl border bg-white p-3 sm:p-4 ${item.excluded || item.saved ? "border-slate-200 opacity-70" : "border-slate-200"}`}>
          <div className="flex items-start justify-between gap-2"><h3 className="min-w-0 break-words text-sm font-bold text-slate-950">{item.id + 1}. {item.draft.name || "Name missing"}</h3><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${state === "Ready" || state === "Saved" ? "bg-emerald-50 text-emerald-800" : state === "Invalid" ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-900"}`}>{state}</span></div>
          <dl className="mt-3 grid min-w-0 grid-cols-2 gap-2 text-xs">
            {[["Phone", item.draft.phone], ["Email", item.draft.email], ["Business", item.draft.business], ["Budget", item.draft.budget === null || item.draft.budget === undefined ? null : `₹${item.draft.budget.toLocaleString("en-IN")}`]].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-slate-500">{label}</dt><dd className="break-words font-medium text-slate-800">{value || "Not provided"}</dd></div>)}
          </dl>
          <p className="mt-2 text-xs text-slate-500">Duplicate: {item.possibleDuplicate ? `Possible match: ${item.possibleDuplicate.name}` : "No match reported"}</p>
          {item.validationErrors?.map(message => <p key={message} className="mt-2 text-xs text-rose-700">{message}</p>)}
          {item.error && <p role="alert" className="mt-2 text-xs text-rose-700">{item.error}</p>}
          {!item.saved && <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={disabled} onClick={() => setEditingId(editingId === item.id ? null : item.id)} className={buttonClass}>{editingId === item.id ? "Close editor" : "Edit"}</button>
            <button type="button" disabled={disabled} onClick={() => patch(item.id, { excluded: !item.excluded })} className={buttonClass}>{item.excluded ? "Include" : "Exclude"}</button>
            {state === "Needs Review" && <button type="button" disabled={disabled || reviewState({ draft: { ...item.draft, confidence: {} } }) !== "Ready"} onClick={() => patch(item.id, { draft: { ...item.draft, confidence: {} }, itemStatus: undefined, validationErrors: [] })} className={buttonClass}>Confirm reviewed</button>}
            {item.possibleDuplicate && <>
              <button type="button" disabled={disabled || !navigation} onClick={() => navigation?.openLead(item.possibleDuplicate!.id)} className={buttonClass}>Open existing</button>
              <button type="button" disabled={disabled || reviewState({ draft: { ...item.draft, confidence: {} } }) !== "Ready"} onClick={async () => {
                setBusy(true); onBusyChange?.(true);
                try { const result = await updateExistingLeadWithDraftAction(item.possibleDuplicate!.id, item.draft); if (result.success) { patch(item.id, { saved: true, error: undefined }); onSaved?.([result.data]); router.refresh(); } else patch(item.id, { error: result.error }); }
                catch { patch(item.id, { error: "Could not update this lead. Please retry." }); } finally { setBusy(false); onBusyChange?.(false); }
              }} className={buttonClass}>Update existing</button>
              <button type="button" disabled={disabled} onClick={() => patch(item.id, { possibleDuplicate: null, itemStatus: undefined })} className={buttonClass}>Create anyway</button>
            </>}
          </div>}
          {editingId === item.id && !item.saved && <div className="mt-3 border-t pt-3"><StructuredLeadPreview
            idSuffix={`bulk-${item.id}`} draft={item.draft} saving={disabled || item.excluded} onChange={draft => patch(item.id, { draft, error: undefined, itemStatus: undefined, validationErrors: [] })}
            onDismissDuplicate={() => {}} onSubmit={async form => {
              if (disabled) return;
              const draft: StructuredLeadDraft = { ...item.draft, name: String(form.get("name") || ""), phone: String(form.get("phone") || ""), email: String(form.get("email") || ""), business: String(form.get("business") || ""), confidence: {} };
              patch(item.id, { draft });
              if (item.possibleDuplicate) { patch(item.id, { error: "Resolve the duplicate before creating this lead." }); return; }
              if (reviewState({ draft }) !== "Ready") { patch(item.id, { error: "Check the required fields and validation before saving." }); return; }
              await addItems([{ ...item, draft }]);
            }} /></div>}
        </ActionCard>;
      })}
    </div>
  </section>;
}
