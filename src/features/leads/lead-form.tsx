"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { leadStatuses, type Lead } from "@/features/leads/types";

type LeadFormProps = {
  open: boolean;
  lead: Lead | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
};

const inputClass = "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-sm";
const sources = ["Website", "Referral", "Organic", "Social", "Other"];

export function LeadForm({ open, lead, saving, onClose, onSubmit }: LeadFormProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const isEditing = Boolean(lead);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose, saving]);

  if (!open) return null;
  const formKey = lead?.id ?? "new";

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Close lead form" onClick={onClose} disabled={saving} className="absolute inset-0 bg-slate-950/50" />
      <section role="dialog" aria-modal="true" aria-labelledby="lead-form-title" className="relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div><h2 id="lead-form-title" className="text-xl font-semibold tracking-tight text-slate-950">{isEditing ? "Edit lead" : "Add lead"}</h2><p className="mt-1 text-sm text-[var(--muted)]">Changes are saved securely to the CRM.</p></div>
          <button ref={closeButtonRef} type="button" onClick={onClose} disabled={saving} aria-label="Close lead form" className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"><X aria-hidden="true" size={20} /></button>
        </header>

        <form key={formKey} action={onSubmit} className="overflow-y-auto">
          <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
            <label className="text-sm font-medium text-slate-700">Name <span className="text-rose-600">*</span><input className={inputClass} name="name" required maxLength={120} autoComplete="name" placeholder="Lead name" defaultValue={lead?.name ?? ""} /></label>
            <label className="text-sm font-medium text-slate-700">Phone <span className="text-rose-600">*</span><input className={inputClass} name="phone" type="tel" required maxLength={40} autoComplete="tel" placeholder="Phone number" defaultValue={lead?.phone ?? ""} /></label>
            <label className="text-sm font-medium text-slate-700">Email<input className={inputClass} name="email" type="email" maxLength={254} autoComplete="email" placeholder="Email address" defaultValue={lead?.email ?? ""} /></label>
            <label className="text-sm font-medium text-slate-700">Business / Company<input className={inputClass} name="business" maxLength={160} autoComplete="organization" placeholder="Business name" defaultValue={lead?.business ?? ""} /></label>
            <label className="text-sm font-medium text-slate-700">Industry<input className={inputClass} name="industry" maxLength={100} placeholder="Industry" defaultValue={lead?.industry ?? ""} /></label>
            <label className="text-sm font-medium text-slate-700">Lead source<select className={inputClass} name="source" defaultValue={lead?.source || "Website"}>{sources.map((source) => <option key={source} value={source}>{source}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Budget<input className={inputClass} name="budget" type="number" min="0" max="9999999999.99" step="0.01" inputMode="decimal" placeholder="Estimated budget" defaultValue={lead?.budget ?? ""} /></label>
            <label className="text-sm font-medium text-slate-700">Status<select className={inputClass} name="status" defaultValue={lead?.status ?? "New"}>{leadStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Quoted amount<input className={inputClass} name="quotedAmount" type="number" min="0" max="9999999999.99" step="0.01" inputMode="decimal" placeholder="Quoted amount" defaultValue={lead?.quotedAmount ?? ""} /></label>
            <label className="text-sm font-medium text-slate-700">Last contact date<input className={inputClass} name="lastContactDate" type="date" defaultValue={lead?.lastContactDate ?? ""} /></label>
            <label className="text-sm font-medium text-slate-700">Next follow-up date<input className={inputClass} name="nextFollowUpDate" type="date" defaultValue={lead?.nextFollowUpDate ?? ""} /></label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">Notes<textarea className={`${inputClass} min-h-28 resize-y py-3`} name="notes" maxLength={5000} placeholder="Context, requirements or next steps" defaultValue={lead?.notes ?? ""} /></label>
          </div>
          <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">{saving ? "Saving…" : isEditing ? "Save changes" : "Add lead"}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
