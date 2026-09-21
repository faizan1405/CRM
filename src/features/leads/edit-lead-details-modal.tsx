"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Pencil } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { checkLeadDuplicate, updateLead } from "@/app/actions/leads";
import { normalizePhone } from "@/features/leads/ai-parser/phone-utils";
import type { DuplicateLeadCandidate } from "@/features/leads/ai-entry-types";
import type { Lead } from "@/features/leads/types";
import { useToast } from "@/components/toast-provider";

const inputClass =
  "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-sm";

export type EditLeadDetailsModalProps = {
  isOpen: boolean;
  lead: Lead;
  onClose: () => void;
  onSaved: (updatedLead: Lead) => void;
};

export function EditLeadDetailsModal({
  isOpen,
  lead,
  onClose,
  onSaved,
}: EditLeadDetailsModalProps) {
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateCandidate, setDuplicateCandidate] = useState<DuplicateLeadCandidate | null>(null);
  const { showToast, showUndoToast } = useToast();

  const [phone, setPhone] = useState(lead.phone || "");
  const [email, setEmail] = useState(lead.email || "");

  const duplicateCheckTimer = useRef<NodeJS.Timeout | null>(null);

  // Check duplicate when phone or email changes from original
  useEffect(() => {
    if (!isOpen) return;

    if (duplicateCheckTimer.current) {
      clearTimeout(duplicateCheckTimer.current);
    }

    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    const phoneChanged = trimmedPhone !== (lead.phone || "").trim();
    const emailChanged = trimmedEmail !== (lead.email || "").trim();

    if (!phoneChanged && !emailChanged) {
      setDuplicateCandidate(null);
      return;
    }

    duplicateCheckTimer.current = setTimeout(async () => {
      try {
        const candidate = await checkLeadDuplicate(
          lead.id,
          trimmedPhone || lead.phone,
          trimmedEmail || null
        );
        setDuplicateCandidate(candidate);
      } catch {
        // Silently ignore duplicate check network errors
      }
    }, 400);

    return () => {
      if (duplicateCheckTimer.current) {
        clearTimeout(duplicateCheckTimer.current);
      }
    };
  }, [phone, email, lead.id, lead.phone, lead.email, isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const rawPhone = String(formData.get("phone") ?? "").trim();
    const rawEmail = String(formData.get("email") ?? "").trim();
    const rawQuotedAmount = String(formData.get("quotedAmount") ?? "").trim();

    // Validation
    if (!name) {
      setErrorMessage("Name is required.");
      return;
    }

    if (!rawPhone) {
      setErrorMessage("Phone is required.");
      return;
    }

    const normalized = normalizePhone(rawPhone);
    if (normalized && !normalized.isValid && normalized.comparisonDigits.length < 5) {
      setErrorMessage("Enter a valid phone number.");
      return;
    }

    if (rawEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      setErrorMessage("Enter a valid email address.");
      return;
    }

    if (rawQuotedAmount) {
      const num = Number(rawQuotedAmount);
      if (Number.isNaN(num) || num < 0) {
        setErrorMessage("Quoted amount must be 0 or greater.");
        return;
      }
    }

    setSaving(true);
    try {
      const result = await updateLead(lead.id, formData);
      if (!result.success) {
        setErrorMessage(result.error);
        setSaving(false);
        return;
      }

      if (result.undoId) {
        showUndoToast("Lead details updated", result.undoId);
      } else {
        showToast("Lead details updated", "success");
      }
      onSaved(result.data);
      onClose();
    } catch {
      setErrorMessage("Failed to update lead details. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={() => {
        if (!saving) onClose();
      }}
      title="Edit Contact & Sales Details"
      headerIcon={<Pencil size={18} className="text-blue-600" aria-hidden="true" />}
      saving={saving}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-[15px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 active:bg-slate-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-lead-details-form"
            disabled={saving}
            className="min-h-11 rounded-xl bg-blue-600 px-5 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      }
    >
      <form id="edit-lead-details-form" onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
          >
            {errorMessage}
          </div>
        )}

        {duplicateCandidate && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900"
          >
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <p className="font-semibold text-amber-950">Possible existing lead found</p>
              <p className="mt-0.5">
                <strong>{duplicateCandidate.name}</strong> · {duplicateCandidate.phone}
                {duplicateCandidate.business ? ` (${duplicateCandidate.business})` : ""}
              </p>
              <p className="mt-1 text-amber-800">
                Saving will keep this lead separate and will not merge records.
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Name <span className="text-rose-600">*</span>
            <input
              className={inputClass}
              name="name"
              required
              maxLength={120}
              autoComplete="name"
              placeholder="e.g. Rahul Sharma"
              defaultValue={lead.name}
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Phone <span className="text-rose-600">*</span>
            <input
              className={inputClass}
              name="phone"
              type="tel"
              required
              maxLength={40}
              autoComplete="tel"
              placeholder="e.g. +91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Email
            <input
              className={inputClass}
              name="email"
              type="email"
              maxLength={254}
              autoComplete="email"
              placeholder="client@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Business / Company
            <input
              className={inputClass}
              name="business"
              maxLength={160}
              autoComplete="organization"
              placeholder="ABC Interiors"
              defaultValue={lead.business || ""}
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Industry / Requirement
            <input
              className={inputClass}
              name="industry"
              maxLength={100}
              placeholder="Interior Design"
              defaultValue={lead.industry || ""}
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Lead Source
            <input
              className={inputClass}
              name="source"
              maxLength={100}
              placeholder="Website, WhatsApp, Referral"
              defaultValue={lead.source || ""}
            />
          </label>

          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Quoted Amount (₹)
            <input
              className={inputClass}
              name="quotedAmount"
              type="number"
              min="0"
              max="9999999999.99"
              step="0.01"
              inputMode="decimal"
              placeholder="₹35,000"
              defaultValue={lead.quotedAmount !== null && lead.quotedAmount !== undefined ? String(lead.quotedAmount) : ""}
            />
            <span className="mt-1 block text-xs text-slate-500">
              Initial proposed quote. Kept separate from finalized Deal Value and payment ledger records.
            </span>
          </label>
        </div>
      </form>
    </BottomSheet>
  );
}
