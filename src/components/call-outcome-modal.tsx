"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDialogAccessibility } from "@/components/use-dialog-accessibility";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useToast } from "@/components/toast-provider";
import { AiNoteEditor } from "@/components/ui/ai-note-editor";
import { saveCallOutcome, undoCallOutcome, type CallOutcome } from "@/app/actions/call-outcomes";
import { getActiveFutureFollowUp, getFollowUpSuggestion, formatFollowUpWarning } from "@/lib/follow-up-suggestions";
import { DEFAULT_TIME } from "@/lib/date-presets";
import type { Lead, LeadStatus } from "@/features/leads/types";

type Props = { isOpen: boolean; lead: Lead | null; onClose: () => void; onFollowUpScheduled?: (leadId: string, scheduledAt: string) => void; onStatusChanged?: (leadId: string, newStatus: LeadStatus) => void };

export function CallOutcomeModal({ isOpen, lead, onClose, onFollowUpScheduled, onStatusChanged }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operationId = useRef("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const fieldId = useId();
  useDialogAccessibility(isOpen, onClose, saving, closeRef);
  useEffect(() => { if (isOpen) { setOutcome(null); setNote(""); setDate(""); setTime(""); setError(null); operationId.current = `call-${crypto.randomUUID()}`; } }, [isOpen]);
  if (!isOpen || !lead) return null;
  const existing = getActiveFutureFollowUp(lead);
  const suggestion = outcome === "NOT_PICKED" || outcome === "INTERESTED" || outcome === "CALL_BACK" ? getFollowUpSuggestion(outcome) : null;

  const select = (value: CallOutcome) => {
    setOutcome(value); setError(null); setNote("");
    if (value === "NOT_PICKED" || value === "INTERESTED") { const suggested = getFollowUpSuggestion(value); setDate(suggested.suggestedDate); setTime(suggested.suggestedTime || DEFAULT_TIME); }
    else { setDate(""); setTime(""); }
  };
  const save = async (choice: "none" | "keep" | "create" | "replace") => {
    if (!outcome || saving) return;
    if ((choice === "create" || choice === "replace") && (!date || !time)) { setError("Choose a date and time."); return; }
    setSaving(true); setError(null);
    try {
      const result = await saveCallOutcome({ leadId: lead.id, outcome, note, operationId: operationId.current,
        ...(choice === "none" ? {} : { followUp: { choice, ...(choice === "keep" || choice === "replace" ? { existingId: existing?.id } : {}), ...(choice === "create" || choice === "replace" ? { scheduledAt: `${date}T${time}:00+05:30` } : {}) } }) });
      if (!result.success) { setError(result.error); return; }
      const status: LeadStatus = result.data.status === "PROPOSAL_SENT" ? "Proposal Sent" : result.data.status.charAt(0) + result.data.status.slice(1).toLowerCase() as LeadStatus;
      if (status !== lead.status) onStatusChanged?.(lead.id, status);
      if (result.data.scheduledAt) onFollowUpScheduled?.(lead.id, result.data.scheduledAt);
      router.refresh();
      const savedId = operationId.current;
      showToast("Call outcome saved", "success", { label: "Undo", onClick: async () => {
        const undone = await undoCallOutcome(lead.id, savedId);
        showToast(undone.success ? "Call outcome undone" : undone.error || "Could not undo call outcome", undone.success ? "info" : "error");
        if (undone.success) { if (status !== lead.status) onStatusChanged?.(lead.id, lead.status); router.refresh(); }
      } });
      onClose();
    } catch { setError("Could not save call outcome. Please try again."); } finally { setSaving(false); }
  };
  const primary = "inline-flex items-center justify-center gap-1.5 min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50 transition-colors";
  const secondary = "inline-flex items-center justify-center gap-1.5 min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50 transition-colors";
  return <BottomSheet isOpen={isOpen} onClose={onClose} title={outcome ? `Call Outcome: ${outcome === "NOT_PICKED" ? "Not Picked" : outcome === "CALL_BACK" ? "Call Back" : outcome === "PICKED" ? "Picked" : "Interested"}` : "Call Outcome"} saving={saving}>
    {!outcome ? <div className="grid grid-cols-2 gap-3">{([["PICKED", "Picked"], ["NOT_PICKED", "Not Picked"], ["CALL_BACK", "Call Back"], ["INTERESTED", "Interested"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => select(value)} className={secondary}>{label}</button>)}</div> : <div className="space-y-4">
      {outcome === "PICKED" && lead.status === "New" && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Saving will move this lead from New to Contacted.</p>}
      {outcome === "INTERESTED" && (lead.status === "New" || lead.status === "Contacted") && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">Saving will move this lead to Qualified.</p>}
      <div>
        <AiNoteEditor
          id={`${fieldId}-note`}
          value={note}
          onChange={(val) => setNote(val)}
          rows={4}
          maxLength={5000}
          disabled={saving}
          label={<>What did you discuss? <span className="font-normal">(optional)</span></>}
          labelClassName="block text-sm font-semibold text-slate-700 mb-1"
          placeholder={outcome === "NOT_PICKED" ? "Called twice, no response." : outcome === "CALL_BACK" ? "Client asked me to call after 4 PM on Monday." : "Conversation note..."}
        />
      </div>
      {suggestion && <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{outcome === "CALL_BACK" ? "Choose an exact callback date and time." : `Suggested follow-up: ${suggestion.displayFullLabel}`}</div>}
      {existing && suggestion && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{formatFollowUpWarning(existing.scheduledAt)} Choose Keep Existing or Replace/Reschedule.</p>}
      {suggestion && <div className="grid grid-cols-2 gap-3"><div><label htmlFor={`${fieldId}-date`} className="block text-sm font-medium">{outcome === "CALL_BACK" ? "Choose callback date" : "Follow-up date"}</label><input id={`${fieldId}-date`} type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2" /></div><div><label htmlFor={`${fieldId}-time`} className="block text-sm font-medium">{outcome === "CALL_BACK" ? "Choose callback time" : "Follow-up time"}</label><input id={`${fieldId}-time`} type="time" value={time} onChange={e => setTime(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2" /></div></div>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2 pt-2">{outcome === "PICKED" ? <button type="button" onClick={() => save("none")} disabled={saving} aria-busy={saving} className={primary}>{saving && <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white shrink-0" aria-hidden="true" />}<span>{saving ? "Saving..." : "Save Call Outcome"}</span></button> : <>
        {outcome !== "CALL_BACK" && <button type="button" onClick={() => save("none")} disabled={saving} aria-busy={saving} className={secondary}>{saving && <span className="size-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-slate-700 shrink-0" aria-hidden="true" />}<span>{saving ? "Saving..." : "Save Call Outcome"}</span></button>}
        {existing ? <><button type="button" onClick={() => save("keep")} disabled={saving} aria-busy={saving} className={secondary}>{saving && <span className="size-3.5 animate-spin rounded-full border-2 border-slate-400 border-t-slate-700 shrink-0" aria-hidden="true" />}<span>{saving ? "Saving..." : "Keep Existing"}</span></button><button type="button" onClick={() => save("replace")} disabled={saving || !date || !time} aria-busy={saving} className={primary}>{saving && <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white shrink-0" aria-hidden="true" />}<span>{saving ? "Saving..." : "Replace/Reschedule"}</span></button></> : <button type="button" onClick={() => save("create")} disabled={saving || !date || !time} aria-busy={saving} className={primary}>{saving && <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white shrink-0" aria-hidden="true" />}<span>{saving ? "Saving..." : outcome === "CALL_BACK" ? "Save Call Outcome & Callback" : "Save & Schedule Follow-up"}</span></button>}
      </>}</div>
    </div>}
  </BottomSheet>;
}
