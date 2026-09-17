"use client";

import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { changeLeadStatus, deleteLead, getLead, updateLead } from "@/app/actions/leads";
import { scheduleLeadFollowUp } from "@/app/actions/follow-ups";
import { useLeadActivities } from "@/features/activity/use-activities";
import type { Lead, LeadStatus } from "./types";
import type { NewFollowUpInput } from "@/features/followups/types";
import type { LostReasonSubmission } from "@/features/lost-reasons/types";
import { DeleteLeadDialog } from "./delete-lead-dialog";
import { useDialogAccessibility } from "@/components/use-dialog-accessibility";
import { useToast } from "@/components/toast-provider";

const LeadDetailPanel = dynamic(() => import("./lead-detail-panel").then(m => m.LeadDetailPanel));
const LeadForm = dynamic(() => import("./lead-form").then(m => m.LeadForm));
const FollowUpForm = dynamic(() => import("@/features/followups/follow-up-form").then(m => m.FollowUpForm));
const LostReasonDialog = dynamic(() => import("@/features/lost-reasons/lost-reason-dialog").then(m => m.LostReasonDialog));

type DetailAction = "note" | "status" | "activity" | "followups" | null;
type LeadNavigation = {
  openLead: (id: string, action?: DetailAction) => void;
  openFollowUp: (lead: { id: string; name: string }) => void;
};
const NavigationContext = createContext<LeadNavigation | null>(null);
export const useLeadNavigation = () => useContext(NavigationContext);

export function LeadNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const requestId = useRef(0);
  const [lead, setLead] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const shellCloseRef = useRef<HTMLButtonElement>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [action, setAction] = useState<DetailAction>(null);
  const [editing, setEditing] = useState(false);
  const [lost, setLost] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUpLead, setFollowUpLead] = useState<Lead | { id: string; name: string } | null>(null);
  const activity = useLeadActivities(lead?.id);
  const { showToast } = useToast();

  const close = () => { requestId.current++; setLoadingId(null); setLead(null); setError(null); setEditing(false); setLost(false); };
  useDialogAccessibility(Boolean(loadingId || (!lead && error && !followUpLead)), close, false, shellCloseRef);
  const openLead = useCallback(async (id: string, initialAction: DetailAction = null) => {
    const current = ++requestId.current;
    setLead(null); setLoadingId(id); setAction(initialAction); setError(null); setEditing(false); setLost(false);
    try {
      const result = await getLead(id);
      if (current !== requestId.current) return;
      if (result.success) setLead(result.data);
      else setError(result.error);
    } catch { if (current === requestId.current) setError("Could not load this lead. Please try again."); }
    finally { if (current === requestId.current) setLoadingId(null); }
  }, []);
  const openFollowUp = useCallback((value: { id: string; name: string }) => { setError(null); setFollowUpLead(value); }, []);
  const navigation = useMemo(() => ({ openLead: (id: string, initialAction?: DetailAction) => { void openLead(id, initialAction); }, openFollowUp }), [openLead, openFollowUp]);
  const statusChange = async (status: LeadStatus, reason?: LostReasonSubmission) => {
    if (!lead) return;
    if (status === "Lost" && !reason) { setLost(true); return; }
    setSaving(true); setError(null);
    const oldStatus = lead.status;
    try {
      const result = await changeLeadStatus(lead.id, status, reason?.reason, reason?.notes);
      if (result.success) { 
        setLead(result.data); setLost(false); await activity.refresh(); router.refresh(); 
        if (status !== "Lost" && status !== "Won") {
          showToast(`Status changed to ${status}`, "success", {
            label: "Undo",
            onClick: async () => {
              const undoRes = await changeLeadStatus(lead.id, oldStatus);
              if (undoRes.success) {
                setLead(undoRes.data);
                await activity.refresh();
                showToast("Status restored", "info");
              }
            }
          });
        }
      }
      else setError(result.error);
    } catch { setError("Could not update this lead. Please try again."); }
    finally { setSaving(false); }
  };
  const saveFollowUp = async (data: NewFollowUpInput) => {
    setSaving(true); setError(null);
    const form = new FormData();
    if (data.id) form.set("id", data.id);
    else if (followUpLead && "activeFollowUp" in followUpLead && followUpLead.activeFollowUp?.id) {
      form.set("id", followUpLead.activeFollowUp.id);
    }
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) form.set(key, value);
    }
    try {
      const result = await scheduleLeadFollowUp(form);
      if (result.success) { 
        const isRescheduled = Boolean((followUpLead && "activeFollowUp" in followUpLead && followUpLead.activeFollowUp) || data.id);
        const prevFollowUp = followUpLead && "activeFollowUp" in followUpLead ? followUpLead.activeFollowUp : undefined;
        const prevScheduledAt = prevFollowUp?.scheduledAt ? new Date(prevFollowUp.scheduledAt) : undefined;
        const prevType = prevFollowUp?.type;

        setFollowUpLead(null);
        if (result.data.leadRecord) {
          setLead(result.data.leadRecord);
        } else if (lead && lead.id === data.leadId) {
          const nextDate = new Date(result.data.scheduledAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
          setLead({ ...lead, nextFollowUpDate: nextDate, activeFollowUp: result.data });
        }
        await activity.refresh();
        router.refresh(); 
        showToast(isRescheduled ? "Follow-up rescheduled" : "Follow-up scheduled", "success", {
          label: "Undo",
          onClick: async () => {
            if (isRescheduled && prevScheduledAt && prevType) {
              const undoRes = await import("@/app/actions/follow-ups").then(m => m.undoRescheduleFollowUp(result.data.id, prevScheduledAt, prevType));
              if (undoRes.success) {
                showToast("Follow-up reschedule undone", "info");
                await activity.refresh();
                router.refresh();
              }
            } else {
              const undoRes = await import("@/app/actions/follow-ups").then(m => m.undoCreateFollowUp(result.data.id));
              if (undoRes.success) {
                showToast("Follow-up creation undone", "info");
                await activity.refresh();
                router.refresh();
              }
            }
          }
        });
      }
      else setError(result.error);
    } catch { setError("Could not save the follow-up. Your entered details are preserved."); }
    finally { setSaving(false); }
  };

    const toggleWaste = async (markAsWaste: boolean) => {
      if (!lead) return;
      setSaving(true);
      try {
        const action = markAsWaste ? import("@/app/actions/leads").then(m => m.markLeadWaste(lead.id)) : import("@/app/actions/leads").then(m => m.restoreWasteLead(lead.id));
        const result = await action;
        if (result.success) {
          setLead(result.data);
          router.refresh();
          showToast(markAsWaste ? "Lead marked as Waste" : "Lead restored", "success", {
            label: "Undo",
            onClick: async () => {
              const undoRes = await import("@/app/actions/leads").then(m => m.undoWasteToggle(lead.id, !markAsWaste));
              if (undoRes.success) {
                showToast("Action undone", "info");
                setLead(undoRes.data);
                router.refresh();
              }
            }
          });
        } else {
          setError(result.error);
        }
      } catch {
        setError("Could not update lead.");
      } finally {
        setSaving(false);
      }
    };

    return <NavigationContext.Provider value={navigation}>
    {children}
    {(loadingId || (!lead && error && !followUpLead)) && <div className="fixed inset-0 z-50 bg-slate-950/45" onClick={close}>
      <aside role="dialog" aria-modal="true" aria-label="Lead details" className="absolute right-0 top-0 flex h-dvh w-full max-w-xl flex-col bg-white p-5" onClick={e => e.stopPropagation()}>
        <button ref={shellCloseRef} type="button" onClick={close} className="self-end rounded-lg px-3 py-2 focus-visible:ring-2 focus-visible:ring-blue-600">Close</button>
        <p role={error ? "alert" : "status"} className="mt-5 text-sm text-slate-600">{error || "Loading lead details…"}</p>
      </aside>
    </div>}
    {lead && !editing && <LeadDetailPanel key={lead.id} lead={lead} saving={saving} onClose={close} onEdit={() => setEditing(true)}
      onStatusChange={statusChange} onDelete={async () => setDeleteTarget(lead)}
      activities={activity.activities} activityFilter={activity.filter} onActivityFilterChange={activity.setFilter}
      onAddNote={activity.handleAddNote} onRefreshActivities={activity.refresh} onEditNote={activity.handleEditNote} onDeleteNote={activity.handleDeleteNote}
      onAddFollowUp={() => setFollowUpLead(lead)} initialAction={action} 
      onMarkWaste={!lead.isWaste ? () => toggleWaste(true) : undefined}
      onRestoreWaste={lead.isWaste ? () => toggleWaste(false) : undefined}
      />}
    <DeleteLeadDialog lead={deleteTarget} saving={saving} onCancel={() => { if (!saving) setDeleteTarget(null); }} onDelete={async () => {
        if (!deleteTarget || saving) return;
        setSaving(true);
        try { const result = await deleteLead(deleteTarget.id); if (result.success) { setDeleteTarget(null); close(); router.refresh(); } else setError(result.error); }
        catch { setError("Could not delete this lead."); } finally { setSaving(false); }
      }} />
    {editing && lead && <LeadForm open lead={lead} saving={saving} onClose={() => { if (!saving) setEditing(false); }} onSubmit={async form => {
      setSaving(true);
      try { const result = await updateLead(lead.id, form); if (result.success) { setLead(result.data); setEditing(false); router.refresh(); } else setError(result.error); }
      catch { setError("Could not save this lead."); } finally { setSaving(false); }
    }} />}
    {followUpLead && <FollowUpForm isOpen followUp={"activeFollowUp" in followUpLead ? (followUpLead.activeFollowUp ?? undefined) : undefined} defaultLeadId={followUpLead.id} leads={[{ id: followUpLead.id, name: followUpLead.name }]} saving={saving} onClose={() => { if (!saving) setFollowUpLead(null); }} onSubmit={saveFollowUp} />}
    {lost && lead && <LostReasonDialog isOpen leadId={lead.id} leadName={lead.name} isSubmitting={saving} onCancel={() => { if (!saving) setLost(false); }} onConfirm={reason => statusChange("Lost", reason)} />}
    {error && (lead || followUpLead) && <div role="alert" className="fixed left-3 right-3 top-3 z-[70] mx-auto flex max-w-lg items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}<button type="button" onClick={() => setError(null)}>Dismiss</button></div>}
  </NavigationContext.Provider>;
}
