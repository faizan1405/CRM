"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { useDialogAccessibility } from "@/components/use-dialog-accessibility";
import { LOST_REASONS, LOST_REASON_LABELS, type LostReasonDialogProps, type PrismaLeadLossReason } from "./types";

function LostReasonDialogInner({ leadName = "Lead", leadId, initialReason, initialNotes = "", onConfirm, onCancel, isSubmitting = false }: LostReasonDialogProps) {
  const [other, setOther] = useState(initialReason === "OTHER");
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const pending = busy || isSubmitting;
  useDialogAccessibility(true, onCancel, pending, closeRef);

  async function save(reason: PrismaLeadLossReason) {
    if (pending || (reason === "OTHER" && !notes.trim())) return;
    setBusy(true); setError("");
    try {
      await onConfirm({ reason, notes: reason === "OTHER" ? notes.trim() : undefined, leadId, leadName, confirmedAt: new Date().toISOString() });
    } catch { setError("Could not save the loss reason. Please retry."); }
    finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4">
    <button type="button" tabIndex={-1} aria-label="Close loss reason overlay" disabled={pending} onClick={onCancel} className="absolute inset-0" />
    <section role="dialog" aria-modal="true" aria-labelledby="lost-reason-dialog-title" className="relative flex max-h-[92dvh] min-h-0 w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0"><h2 id="lost-reason-dialog-title" className="break-words text-lg font-semibold">Mark {leadName} as Lost</h2><p className="mt-1 text-sm text-slate-500">Choose a reason to save the outcome.</p></div>
        <button ref={closeRef} type="button" disabled={pending} onClick={onCancel} aria-label="Cancel and close dialog" className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-rose-500"><X size={20} /></button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div role="group" aria-label="Lost Reasons" className="grid grid-cols-2 gap-2">
          {LOST_REASONS.map(reason => <button key={reason} type="button" disabled={pending} onClick={() => {
            if (reason === "OTHER") { setOther(true); requestAnimationFrame(() => notesRef.current?.focus()); }
            else void save(reason);
          }} className="min-h-12 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:border-rose-400 hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50">{LOST_REASON_LABELS[reason]}</button>)}
        </div>
        {other && <form onSubmit={event => { event.preventDefault(); void save("OTHER"); }} className="space-y-3">
          <label className="block text-sm font-medium">Explanation <span className="text-rose-600">*</span><textarea ref={notesRef} required maxLength={500} disabled={pending} value={notes} onChange={event => setNotes(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border p-3 text-base focus-visible:ring-2 focus-visible:ring-rose-500" /></label>
          <button type="submit" disabled={pending || !notes.trim()} className="min-h-11 w-full rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Saving..." : "Save Lost"}</button>
        </form>}
        {pending && <p role="status" className="text-sm text-slate-500">Saving loss reason...</p>}
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      </div>
      <footer className="shrink-0 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><button type="button" disabled={pending} onClick={onCancel} className="min-h-11 w-full rounded-xl border text-sm font-semibold hover:bg-slate-50">Cancel</button></footer>
    </section>
  </div>;
}

export function LostReasonDialog(props: LostReasonDialogProps) {
  return props.isOpen ? <LostReasonDialogInner key={props.leadId || props.leadName} {...props} /> : null;
}
