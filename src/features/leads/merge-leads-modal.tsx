"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check, GitMerge, ShieldCheck, Sparkles, X } from "lucide-react";
import { leadStatuses, type Lead, type LeadStatus, type MergeLeadsInput } from "@/features/leads/types";
import type { DuplicateLeadCandidate } from "./ai-entry-types";
import { enrichExistingLead, mergeLeadsAction } from "@/app/actions/leads";
import { useToast } from "@/components/toast-provider";

export type MergeLeadsModalProps =
  | {
      mode: "enrich";
      isOpen: boolean;
      existingCandidate: DuplicateLeadCandidate;
      enteredLead: {
        name: string;
        phone: string;
        email?: string;
        business?: string;
        industry?: string;
        source?: string;
        budget?: number | null;
        quotedAmount?: number | null;
        status?: LeadStatus;
        notes?: string;
      };
      onClose: () => void;
      onSuccess: (updatedLead: Lead) => void;
    }
  | {
      mode: "merge";
      isOpen: boolean;
      leadA: Lead;
      leadB: Lead;
      onClose: () => void;
      onSuccess: (mergedLead: Lead) => void;
    };

export function MergeLeadsModal(props: MergeLeadsModalProps) {
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Merge Mode state
  const isMerge = props.mode === "merge";
  const initialPrimaryId = isMerge ? props.leadA.id : "";
  const [primaryLeadId, setPrimaryLeadId] = useState<string>(initialPrimaryId);

  // When props change, ensure primaryLeadId is initialized
  useEffect(() => {
    if (props.mode === "merge") {
      setPrimaryLeadId(props.leadA.id);
    }
  }, [props]);

  const leadA = isMerge ? props.leadA : null;
  const leadB = isMerge ? props.leadB : null;

  const primaryLead = isMerge ? (primaryLeadId === leadA?.id ? leadA : leadB) : null;
  const duplicateLead = isMerge ? (primaryLeadId === leadA?.id ? leadB : leadA) : null;

  // Selected field values for merge
  const [selectedName, setSelectedName] = useState<string>("");
  const [selectedPhone, setSelectedPhone] = useState<string>("");
  const [selectedEmail, setSelectedEmail] = useState<string>("");
  const [selectedBusiness, setSelectedBusiness] = useState<string>("");
  const [selectedIndustry, setSelectedIndustry] = useState<string>("");
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [selectedBudget, setSelectedBudget] = useState<number | null>(null);
  const [selectedQuoted, setSelectedQuoted] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<LeadStatus>("New");
  const [selectedFollowUpId, setSelectedFollowUpId] = useState<string>("");

  // Initialize field resolutions based on selected primary/duplicate leads
  useEffect(() => {
    if (!primaryLead || !duplicateLead) return;

    // Field resolution rule:
    // If only one record has information, automatically propose the non-empty value.
    // If both have information, default to primary lead's value.
    setSelectedName(primaryLead.name || duplicateLead.name || "");
    setSelectedPhone(primaryLead.phone || duplicateLead.phone || "");
    setSelectedEmail(primaryLead.email || duplicateLead.email || "");
    setSelectedBusiness(primaryLead.business || duplicateLead.business || "");
    setSelectedIndustry(primaryLead.industry || duplicateLead.industry || "");
    setSelectedSource(primaryLead.source || duplicateLead.source || "");
    setSelectedBudget(primaryLead.budget !== null ? primaryLead.budget : duplicateLead.budget);
    setSelectedQuoted(primaryLead.quotedAmount !== null ? primaryLead.quotedAmount : duplicateLead.quotedAmount);
    setSelectedStatus(primaryLead.status);

    // Active follow-up resolution: default to primary active follow-up if present
    if (primaryLead.activeFollowUp) {
      setSelectedFollowUpId(primaryLead.activeFollowUp.id);
    } else if (duplicateLead.activeFollowUp) {
      setSelectedFollowUpId(duplicateLead.activeFollowUp.id);
    } else {
      setSelectedFollowUpId("");
    }
  }, [primaryLead, duplicateLead]);

  if (!props.isOpen) return null;

  // ─── Enrich Submission Handler ───────────────────────────────────────────────
  async function handleEnrichSubmit() {
    if (props.mode !== "enrich") return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await enrichExistingLead(props.existingCandidate.id, {
        name: props.enteredLead.name,
        phone: props.enteredLead.phone,
        email: props.enteredLead.email,
        business: props.enteredLead.business,
        industry: props.enteredLead.industry,
        leadSource: props.enteredLead.source,
        budget: props.enteredLead.budget,
        quotedAmount: props.enteredLead.quotedAmount,
        status: props.enteredLead.status,
        notes: props.enteredLead.notes,
      });

      if (!res.success) {
        setErrorMessage(res.error);
        setSubmitting(false);
        return;
      }

      showToast("Existing lead enriched successfully", "success");
      props.onSuccess(res.data);
      props.onClose();
    } catch {
      setErrorMessage("Could not update the existing lead. Please retry.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Merge Submission Handler ────────────────────────────────────────────────
  async function handleMergeSubmit() {
    if (props.mode !== "merge" || !primaryLead || !duplicateLead) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const input: MergeLeadsInput = {
        primaryLeadId: primaryLead.id,
        mergedLeadId: duplicateLead.id,
        fieldResolutions: {
          name: selectedName,
          phone: selectedPhone,
          email: selectedEmail,
          business: selectedBusiness,
          industry: selectedIndustry,
          leadSource: selectedSource,
          budget: selectedBudget,
          quotedAmount: selectedQuoted,
          status: selectedStatus,
        },
        survivingFollowUpId: selectedFollowUpId || undefined,
      };

      const res = await mergeLeadsAction(input);
      if (!res.success) {
        setErrorMessage(res.error);
        setSubmitting(false);
        return;
      }

      showToast(`Successfully merged ${duplicateLead.name} into ${primaryLead.name}`, "success");
      props.onSuccess(res.data);
      props.onClose();
    } catch {
      setErrorMessage("Merge failed. Transaction was rolled back.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close merge dialog"
        onClick={props.onClose}
        disabled={submitting}
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-modal-title"
        className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/75 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-blue-100 text-blue-700">
              <GitMerge size={18} />
            </div>
            <div>
              <h2 id="merge-modal-title" className="text-base font-semibold text-slate-900">
                {props.mode === "enrich" ? "Update Existing Lead" : "Merge Duplicate Leads"}
              </h2>
              <p className="text-xs text-slate-500">
                {props.mode === "enrich"
                  ? "Enrich the existing record without creating an unnecessary duplicate"
                  : "Combine two leads while preserving all activity, deal, and payment history"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            disabled={submitting}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {errorMessage && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800">
              {errorMessage}
            </div>
          )}

          {/* ═════════════════ MODE: ENRICH ═════════════════ */}
          {props.mode === "enrich" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-semibold">Matching existing lead found:</p>
                    <p className="mt-1 text-sm font-bold text-amber-900">{props.existingCandidate.name}</p>
                    <p className="mt-0.5 text-amber-800">
                      {props.existingCandidate.phone}
                      {props.existingCandidate.business ? ` · ${props.existingCandidate.business}` : ""}
                      {props.existingCandidate.status ? ` · Status: ${props.existingCandidate.status}` : ""}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  New Information to Apply
                </h3>
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  {props.enteredLead.email && (
                    <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                      <span className="text-slate-400">Email:</span>{" "}
                      <span className="font-medium text-slate-800">{props.enteredLead.email}</span>
                    </div>
                  )}
                  {props.enteredLead.business && (
                    <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                      <span className="text-slate-400">Business:</span>{" "}
                      <span className="font-medium text-slate-800">{props.enteredLead.business}</span>
                    </div>
                  )}
                  {props.enteredLead.industry && (
                    <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                      <span className="text-slate-400">Industry:</span>{" "}
                      <span className="font-medium text-slate-800">{props.enteredLead.industry}</span>
                    </div>
                  )}
                  {props.enteredLead.quotedAmount && (
                    <div className="rounded-lg bg-white p-2.5 border border-slate-200">
                      <span className="text-slate-400">Quoted:</span>{" "}
                      <span className="font-medium text-slate-800">₹{Number(props.enteredLead.quotedAmount).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Non-empty fields entered will safely update the existing lead. Empty fields will not overwrite existing data.
                </p>
              </div>
            </div>
          )}

          {/* ═════════════════ MODE: MERGE EXISTING ═════════════════ */}
          {props.mode === "merge" && primaryLead && duplicateLead && (
            <div className="space-y-6">
              {/* Section 1: Choose Primary Lead */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  1. Which record should remain? (Surviving Lead)
                </label>
                <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                  {[leadA!, leadB!].map((cand) => {
                    const isSelected = cand.id === primaryLeadId;
                    return (
                      <button
                        key={cand.id}
                        type="button"
                        onClick={() => setPrimaryLeadId(cand.id)}
                        className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all ${
                          isSelected
                            ? "border-blue-500 bg-blue-50/50 ring-2 ring-blue-200 shadow-xs"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-xs font-semibold text-slate-500">
                            {isSelected ? "Primary Lead (Surviving)" : "Duplicate Lead (Merged)"}
                          </span>
                          <span
                            className={`grid size-5 place-items-center rounded-full border ${
                              isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-bold text-slate-900">{cand.name}</p>
                        <p className="mt-0.5 text-xs text-slate-600">{cand.phone}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium">{cand.status}</span>
                          <span>Created {cand.createdAt}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Field Resolution */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  2. Field-by-Field Merge Preview
                </label>

                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white p-3 text-xs">
                  {/* Name conflict */}
                  <FieldResolutionRow
                    label="Name"
                    primaryValue={primaryLead.name}
                    duplicateValue={duplicateLead.name}
                    selectedValue={selectedName}
                    onSelect={setSelectedName}
                  />

                  {/* Phone conflict */}
                  <FieldResolutionRow
                    label="Phone"
                    primaryValue={primaryLead.phone}
                    duplicateValue={duplicateLead.phone}
                    selectedValue={selectedPhone}
                    onSelect={setSelectedPhone}
                  />

                  {/* Email conflict */}
                  <FieldResolutionRow
                    label="Email"
                    primaryValue={primaryLead.email}
                    duplicateValue={duplicateLead.email}
                    selectedValue={selectedEmail}
                    onSelect={setSelectedEmail}
                  />

                  {/* Business conflict */}
                  <FieldResolutionRow
                    label="Business"
                    primaryValue={primaryLead.business}
                    duplicateValue={duplicateLead.business}
                    selectedValue={selectedBusiness}
                    onSelect={setSelectedBusiness}
                  />

                  {/* Industry conflict */}
                  <FieldResolutionRow
                    label="Industry"
                    primaryValue={primaryLead.industry}
                    duplicateValue={duplicateLead.industry}
                    selectedValue={selectedIndustry}
                    onSelect={setSelectedIndustry}
                  />

                  {/* Pipeline Status safety */}
                  <div className="py-2.5">
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>Pipeline Status</span>
                      <span className="text-[11px] text-slate-500 font-normal">Defaults to Primary</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {leadStatuses.map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setSelectedStatus(st)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                            selectedStatus === st
                              ? "bg-blue-600 text-white shadow-xs"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Active Follow-up Conflict (if both exist) */}
              {primaryLead.activeFollowUp && duplicateLead.activeFollowUp && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-600" />
                    <h3 className="text-xs font-bold text-amber-950">
                      Active Follow-up Conflict (CRM rule: exactly 1 active follow-up)
                    </h3>
                  </div>
                  <p className="text-xs text-amber-900">
                    Both leads currently have a scheduled follow-up. Choose which one to keep as active:
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setSelectedFollowUpId(primaryLead.activeFollowUp!.id)}
                      className={`flex flex-col rounded-lg border p-2.5 text-left text-xs transition-colors ${
                        selectedFollowUpId === primaryLead.activeFollowUp.id
                          ? "border-amber-600 bg-white shadow-xs font-semibold text-amber-950"
                          : "border-amber-200 bg-white/70 text-amber-800"
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold text-amber-700">Primary Follow-up</span>
                      <span>{new Date(primaryLead.activeFollowUp.scheduledAt).toLocaleString("en-IN")}</span>
                      <span className="text-[11px] text-slate-500">{primaryLead.activeFollowUp.type}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFollowUpId(duplicateLead.activeFollowUp!.id)}
                      className={`flex flex-col rounded-lg border p-2.5 text-left text-xs transition-colors ${
                        selectedFollowUpId === duplicateLead.activeFollowUp.id
                          ? "border-amber-600 bg-white shadow-xs font-semibold text-amber-950"
                          : "border-amber-200 bg-white/70 text-amber-800"
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold text-amber-700">Duplicate Follow-up</span>
                      <span>{new Date(duplicateLead.activeFollowUp.scheduledAt).toLocaleString("en-IN")}</span>
                      <span className="text-[11px] text-slate-500">{duplicateLead.activeFollowUp.type}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-700 italic">
                    The unselected active follow-up will be safely marked as CANCELLED (never deleted).
                  </p>
                </div>
              )}

              {/* Section 4: Data Safety Guarantee Box */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-xs text-emerald-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                  <ShieldCheck size={16} className="text-emerald-600" />
                  <span>Data Integrity & Preservation Guarantee</span>
                </div>
                <p>
                  • All activities and historical notes will be transferred to the Primary Lead.
                  <br />
                  • Deals and payments will remain preserved without mathematical combination.
                  <br />
                  • Duplicate lead record will be archived as merged (retained in DB for audit).
                </p>
              </div>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={props.onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          {props.mode === "enrich" ? (
            <button
              type="button"
              onClick={handleEnrichSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
            >
              <Sparkles size={14} />
              {submitting ? "Updating…" : "Update Existing Lead"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleMergeSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
            >
              <GitMerge size={14} />
              {submitting ? "Merging…" : "Confirm Safe Merge"}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

function FieldResolutionRow({
  label,
  primaryValue,
  duplicateValue,
  selectedValue,
  onSelect,
}: {
  label: string;
  primaryValue: string | null | undefined;
  duplicateValue: string | null | undefined;
  selectedValue: string;
  onSelect: (val: string) => void;
}) {
  const p = primaryValue || "";
  const d = duplicateValue || "";

  // If both empty or identical, no conflict to resolve
  if (!p && !d) return null;
  if (p === d) {
    return (
      <div className="flex items-center justify-between py-2 text-slate-600">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-medium text-slate-900">{p}</span>
      </div>
    );
  }

  // If only one is populated, propose non-empty value automatically
  if (!p || !d) {
    const nonNull = p || d;
    return (
      <div className="flex items-center justify-between py-2 text-slate-600">
        <span className="font-semibold text-slate-700">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-slate-900">{nonNull}</span>
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
            Auto-proposed
          </span>
        </div>
      </div>
    );
  }

  // Both have different values: require visible choice
  return (
    <div className="py-2.5 space-y-1.5">
      <span className="font-semibold text-slate-700">{label}</span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelect(p)}
          className={`rounded-lg border px-2.5 py-1 text-left transition-colors ${
            selectedValue === p
              ? "border-blue-500 bg-blue-50 text-blue-900 font-semibold"
              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
          }`}
        >
          <span className="text-[10px] uppercase text-slate-400 block">Primary</span>
          {p}
        </button>
        <button
          type="button"
          onClick={() => onSelect(d)}
          className={`rounded-lg border px-2.5 py-1 text-left transition-colors ${
            selectedValue === d
              ? "border-blue-500 bg-blue-50 text-blue-900 font-semibold"
              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
          }`}
        >
          <span className="text-[10px] uppercase text-slate-400 block">Duplicate</span>
          {d}
        </button>
      </div>
    </div>
  );
}
