"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { useDialogAccessibility } from "@/components/use-dialog-accessibility";
import { LOST_REASONS, LOST_REASON_LABELS, type LostReasonDialogProps, type PrismaLeadLossReason } from "./types";
import { BottomSheet } from "@/components/ui/bottom-sheet";

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

  return (
    <BottomSheet
      isOpen={true}
      onClose={onCancel}
      title={`Mark ${leadName} as Lost`}
      saving={pending}
      footer={
        <button type="button" disabled={pending} onClick={onCancel} className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[15px] font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition-colors shadow-sm">
          Cancel
        </button>
      }
    >
      <p className="mt-1 text-[13px] text-slate-500 mb-4 -mt-3">Choose a reason to save the outcome.</p>
      
      <div className="grid grid-cols-2 gap-2">
        {LOST_REASONS.map(reason => (
          <button 
            key={reason} 
            type="button" 
            disabled={pending} 
            onClick={() => {
              if (reason === "OTHER") { setOther(true); requestAnimationFrame(() => notesRef.current?.focus()); }
              else void save(reason);
            }} 
            className="min-h-[44px] rounded-xl border border-slate-200 px-3 py-2 text-[13px] font-semibold hover:border-rose-400 hover:bg-rose-50 active:bg-rose-100 focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50 transition-colors text-slate-700"
          >
            {LOST_REASON_LABELS[reason]}
          </button>
        ))}
      </div>
      
      {other && (
        <form onSubmit={event => { event.preventDefault(); void save("OTHER"); }} className="space-y-3 mt-4">
          <label className="block text-[13px] font-bold text-slate-700">
            Explanation <span className="text-rose-600">*</span>
            <textarea 
              ref={notesRef} 
              required 
              maxLength={500} 
              disabled={pending} 
              value={notes} 
              onChange={event => setNotes(event.target.value)} 
              rows={3} 
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-[14px] focus:border-rose-500 focus:ring-1 focus:ring-rose-500 resize-y" 
            />
          </label>
          <button type="submit" disabled={pending || !notes.trim()} className="min-h-[44px] w-full rounded-xl bg-rose-600 px-4 text-[15px] font-bold text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 transition-colors">
            {pending ? "Saving..." : "Save Lost"}
          </button>
        </form>
      )}
      
      {pending && <p role="status" className="text-[13px] text-slate-500 mt-3 text-center">Saving loss reason...</p>}
      {error && <p role="alert" className="text-[13px] text-rose-700 mt-3 text-center">{error}</p>}
    </BottomSheet>
  );
}

export function LostReasonDialog(props: LostReasonDialogProps) {
  return props.isOpen ? <LostReasonDialogInner key={props.leadId || props.leadName} {...props} /> : null;
}
