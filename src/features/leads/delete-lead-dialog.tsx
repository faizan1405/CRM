"use client";

import { useRef } from "react";
import { useDialogAccessibility } from "@/components/use-dialog-accessibility";
import type { Lead } from "./types";

export function DeleteLeadDialog({ lead, saving, onCancel, onDelete }: { lead: Lead | null; saving: boolean; onCancel: () => void; onDelete: () => Promise<void> }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useDialogAccessibility(Boolean(lead), onCancel, saving, cancelRef);
  if (!lead) return null;
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="delete-lead-title" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
      <h2 id="delete-lead-title" className="break-words text-lg font-semibold">Delete {lead.name}?</h2>
      <p className="mt-2 text-sm text-slate-500">This permanently removes the lead and its related records.</p>
      <div className="mt-5 flex gap-3">
        <button ref={cancelRef} type="button" disabled={saving} onClick={onCancel} className="min-h-11 flex-1 rounded-lg border text-sm font-semibold hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600">Cancel</button>
        <button type="button" disabled={saving} onClick={() => void onDelete()} className="min-h-11 flex-1 rounded-lg bg-rose-600 text-sm font-semibold text-white hover:bg-rose-700 focus-visible:ring-2 focus-visible:ring-rose-600 disabled:opacity-50">{saving ? "Deleting..." : "Delete"}</button>
      </div>
    </section>
  </div>;
}
