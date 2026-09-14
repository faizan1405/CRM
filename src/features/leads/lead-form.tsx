"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { leadStatuses, type LeadStatus, type NewLeadInput } from "@/features/leads/types";

type LeadFormProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (lead: NewLeadInput) => void;
};

const inputClass = "mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-sm";
const sources = ["Website", "Referral", "Organic", "Social", "Other"];

export function LeadForm({ open, onClose, onSubmit }: LeadFormProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  function handleSubmit(formData: FormData) {
    const budgetValue = String(formData.get("budget") ?? "").trim();
    onSubmit({
      name: String(formData.get("name") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      business: String(formData.get("business") ?? "").trim(),
      industry: String(formData.get("industry") ?? "").trim(),
      source: String(formData.get("source") ?? "").trim(),
      budget: budgetValue ? Number(budgetValue) : null,
      status: String(formData.get("status") ?? "New") as LeadStatus,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Close add lead form" onClick={onClose} className="absolute inset-0 bg-slate-950/50" />
      <section role="dialog" aria-modal="true" aria-labelledby="add-lead-title" className="relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 id="add-lead-title" className="text-xl font-semibold tracking-tight text-slate-950">Add lead</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Saved in this browser view only for now.</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close add lead form" className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X aria-hidden="true" size={20} /></button>
        </header>

        <form action={handleSubmit} className="overflow-y-auto">
          <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
            <label className="text-sm font-medium text-slate-700">Name <span className="text-rose-600">*</span><input className={inputClass} name="name" required autoComplete="name" placeholder="Lead name" /></label>
            <label className="text-sm font-medium text-slate-700">Phone <span className="text-rose-600">*</span><input className={inputClass} name="phone" type="tel" required autoComplete="tel" placeholder="Phone number" /></label>
            <label className="text-sm font-medium text-slate-700">Email<input className={inputClass} name="email" type="email" autoComplete="email" placeholder="Email address" /></label>
            <label className="text-sm font-medium text-slate-700">Business / Company<input className={inputClass} name="business" autoComplete="organization" placeholder="Business name" /></label>
            <label className="text-sm font-medium text-slate-700">Industry<input className={inputClass} name="industry" placeholder="Industry" /></label>
            <label className="text-sm font-medium text-slate-700">Lead source<select className={inputClass} name="source" defaultValue="Website">{sources.map((source) => <option key={source} value={source}>{source}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Budget<input className={inputClass} name="budget" type="number" min="0" step="1000" inputMode="numeric" placeholder="Estimated budget" /></label>
            <label className="text-sm font-medium text-slate-700">Status<select className={inputClass} name="status" defaultValue="New">{leadStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
          </div>
          <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">Cancel</button>
            <button type="submit" className="min-h-11 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">Add lead</button>
          </footer>
        </form>
      </section>
    </div>
  );
}
