"use client";

import { BadgeCheck, MessageCircle, Pencil, Phone, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { formatCurrency, formatDate } from "@/features/leads/formatters";
import { LeadStatusBadge } from "@/features/leads/lead-status-badge";
import type { Lead } from "@/features/leads/types";

function DetailItem({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1.5 break-words text-sm font-medium text-slate-800">{value || "Not added"}</dd></div>;
}

const actionClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-500 disabled:cursor-not-allowed disabled:opacity-70";

export function LeadDetailPanel({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!lead) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [lead, onClose]);

  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close lead details" onClick={onClose} className="absolute inset-0 bg-slate-950/45" />
      <aside role="dialog" aria-modal="true" aria-labelledby="lead-detail-title" className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-[var(--background)] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h2 id="lead-detail-title" className="truncate text-xl font-semibold tracking-tight text-slate-950">{lead.name}</h2><LeadStatusBadge status={lead.status} /></div>
            <p className="mt-1 text-sm text-[var(--muted)]">{lead.business || "No business added"}</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="Close lead details" className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X aria-hidden="true" size={20} /></button>
        </header>

        <div role="region" tabIndex={0} aria-label="Lead information" className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          <section className="rounded-xl border border-[var(--border)] bg-white p-5"><h3 className="font-semibold text-slate-950">Contact</h3><dl className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2"><DetailItem label="Name" value={lead.name} /><DetailItem label="Phone" value={lead.phone} /><DetailItem label="Email" value={lead.email} /><DetailItem label="Business" value={lead.business} /></dl></section>
          <section className="rounded-xl border border-[var(--border)] bg-white p-5"><h3 className="font-semibold text-slate-950">Sales</h3><dl className="mt-4 grid grid-cols-2 gap-5"><DetailItem label="Status" value={lead.status} /><DetailItem label="Lead source" value={lead.source} /><DetailItem label="Budget" value={formatCurrency(lead.budget)} /><DetailItem label="Quoted amount" value={formatCurrency(lead.quotedAmount)} /></dl></section>
          <section className="rounded-xl border border-[var(--border)] bg-white p-5"><h3 className="font-semibold text-slate-950">Follow-up</h3><dl className="mt-4 grid grid-cols-2 gap-5"><DetailItem label="Last contact" value={formatDate(lead.lastContactDate)} /><DetailItem label="Next follow-up" value={formatDate(lead.nextFollowUpDate)} /></dl></section>
          <section className="rounded-xl border border-[var(--border)] bg-white p-5"><h3 className="font-semibold text-slate-950">Notes</h3><p className="mt-3 text-sm leading-6 text-slate-700">{lead.notes || "No notes added."}</p><p className="mt-4 text-xs text-slate-500">Created {formatDate(lead.createdAt)}</p></section>
        </div>

        <footer className="border-t border-slate-200 bg-white p-4 sm:px-6">
          <p className="mb-3 text-xs font-medium text-slate-500">Actions will be connected in a later phase.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button type="button" disabled className={actionClass}><Phone aria-hidden="true" size={17} /> Call</button>
            <button type="button" disabled className={actionClass}><MessageCircle aria-hidden="true" size={17} /> WhatsApp</button>
            <button type="button" disabled className={actionClass}><Pencil aria-hidden="true" size={17} /> Edit</button>
            <button type="button" disabled className={actionClass}><BadgeCheck aria-hidden="true" size={17} /> Status</button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
