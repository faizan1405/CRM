"use client";

import { Plus, SearchX, UsersRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLeadNavigation } from "./lead-navigation-provider";
import { statusFromDatabase, type DatabaseLeadStatus } from "./types";
import { useEffect, useMemo, useState } from "react";
import { changeLeadStatus, createLead, deleteLead, getLead, updateLead, updateQuickStatus } from "@/app/actions/leads";
import { scheduleLeadFollowUp } from "@/app/actions/follow-ups";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { LeadCard } from "@/features/leads/lead-card";
import dynamic from "next/dynamic";
const LeadDetailPanel = dynamic(() => import("@/features/leads/lead-detail-panel").then(m => m.LeadDetailPanel));
import { LeadFilters } from "@/features/leads/lead-filters";
const LeadForm = dynamic(() => import("@/features/leads/lead-form").then(m => m.LeadForm));
import { LeadTable } from "@/features/leads/lead-table";
import { DeleteLeadDialog } from "./delete-lead-dialog";
import type { Lead, LeadStatus, QuickStatusType } from "@/features/leads/types";
import { LostReasonDialog } from "@/features/lost-reasons/lost-reason-dialog";
import type { LostReasonSubmission } from "@/features/lost-reasons/types";
import { useLeadActivities } from "@/features/activity/use-activities";
import { FollowUpForm } from "@/features/followups/follow-up-form";
import type { NewFollowUpInput } from "@/features/followups/types";
import type { DuplicateLeadCandidate, StructuredLeadDraft } from "@/features/leads/ai-entry-types";
import type { BulkStructureLeadCallback } from "./bulk-review-types";
import { structureBulkLeadAction, updateExistingLeadWithDraftAction } from "@/app/actions/ai-lead-entry";

type Feedback = { tone: "success" | "error"; message: string } | null;

type LeadsWorkspaceProps = {
  initialLeads: Lead[];
  initialError: string | null;
  onStructureLead?: BulkStructureLeadCallback;
};

export function LeadsWorkspace({ initialLeads, initialError, onStructureLead }: LeadsWorkspaceProps) {
  const searchParams = useSearchParams();
  const navigation = useLeadNavigation();
  const statusParam = searchParams.get("status");
  const selectedParam = searchParams.get("selected");
  const actionParam = searchParams.get("action");
  const newParam = searchParams.get("new");
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeadStatus | "All">("All");
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [detailAction, setDetailAction] = useState<"note" | "status" | null>(null);
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);
  const [lostReasonLead, setLostReasonLead] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(initialError ? { tone: "error", message: initialError } : null);

  useEffect(() => {
    if (newParam === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormOpen(true);
    }
  }, [newParam]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(statusFromDatabase[statusParam as DatabaseLeadStatus] || "All");
  }, [statusParam]);

  useEffect(() => {
    if (selectedParam && navigation) navigation.openLead(selectedParam, actionParam === "activity" || actionParam === "followups" ? actionParam : null);
  }, [selectedParam, actionParam, navigation]);

  const {
    activities,
    filter: activityFilter,
    setFilter: setActivityFilter,
    handleAddNote,
    handleEditNote,
    handleDeleteNote,
    refresh: refreshActivities,
  } = useLeadActivities(selectedLead?.id);

  const filteredLeads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const searchable = [lead.name, lead.business, lead.phone, lead.email].join(" ").toLowerCase();
      return (!needle || searchable.includes(needle)) && (status === "All" || lead.status === status);
    });
  }, [leads, query, status]);

  function replaceLead(updatedLead: Lead) {
    setLeads((current) => current.map((lead) => (lead.id === updatedLead.id ? updatedLead : lead)));
    setSelectedLead((current) => (current?.id === updatedLead.id ? updatedLead : current));
  }

  async function saveLead(formData: FormData) {
    setSaving(true);
    setFeedback(null);
    const result = editingLead ? await updateLead(editingLead.id, formData) : await createLead(formData);
    setSaving(false);
    if (!result.success) {
      setFeedback({ tone: "error", message: result.error });
      return;
    }
    if (editingLead) replaceLead(result.data);
    else setLeads((current) => [result.data, ...current]);
    setFormOpen(false);
    setEditingLead(null);
    setFeedback({ tone: "success", message: editingLead ? "Lead updated." : "Lead added." });
  }

  async function selectLead(lead: Lead, action: "note" | "status" | null = null) {
    setDetailAction(action);
    setSelectedLead(lead);
    const result = await getLead(lead.id);
    if (result.success) setSelectedLead(current => current?.id === lead.id ? result.data : current);
    else setFeedback({ tone: "error", message: result.error });
  }

  function findDuplicate(candidate: DuplicateLeadCandidate) {
    return leads.find((lead) => lead.id === candidate.id);
  }

  function openDuplicate(candidate: DuplicateLeadCandidate) {
    const existing = findDuplicate(candidate);
    if (!existing) {
      setFeedback({ tone: "error", message: "That existing lead is not available in this list." });
      return;
    }
    setFormOpen(false);
    setEditingLead(null);
    void selectLead(existing);
  }

  async function updateDuplicate(candidate: DuplicateLeadCandidate, draft: StructuredLeadDraft) {
    setSaving(true);
    setFeedback(null);
    const result = await updateExistingLeadWithDraftAction(candidate.id, draft);
    setSaving(false);
    if (!result.success) {
      setFeedback({ tone: "error", message: result.error });
      return;
    }
    replaceLead(result.data);
    setFormOpen(false);
    setEditingLead(null);
    setFeedback({ tone: "success", message: "Existing lead updated with AI details." });
    void selectLead(result.data);
  }

  async function saveFollowUp(data: NewFollowUpInput) {
    setSaving(true);
    setFeedback(null);
    const formData = new FormData();
    if (data.id) {
      formData.append("id", data.id);
    } else if (followUpLead?.activeFollowUp?.id) {
      formData.append("id", followUpLead.activeFollowUp.id);
    }
    formData.append("leadId", data.leadId);
    formData.append("scheduledAt", data.scheduledAt);
    formData.append("type", data.type);
    formData.append("note", data.note);
    if (data.submissionId) {
      formData.append("submissionId", data.submissionId);
    }
    const result = await scheduleLeadFollowUp(formData);
    setSaving(false);
    if (!result.success) {
      setFeedback({ tone: "error", message: result.error });
      return;
    }

    const isRescheduled = Boolean(followUpLead?.activeFollowUp || data.id);
    const updatedLead = result.data.leadRecord;
    const nextDate = new Date(result.data.scheduledAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    setLeads((current) =>
      current.map((lead) =>
        lead.id === data.leadId
          ? (updatedLead || { ...lead, nextFollowUpDate: nextDate, activeFollowUp: result.data })
          : lead
      )
    );
    setSelectedLead((current) =>
      current?.id === data.leadId
        ? (updatedLead || { ...current, nextFollowUpDate: nextDate, activeFollowUp: result.data })
        : current
    );
    if (selectedLead?.id === data.leadId) await refreshActivities();
    setFollowUpLead(null);
    setFeedback({ tone: "success", message: isRescheduled ? "Follow-up rescheduled." : "Follow-up added." });
  }

  async function setLeadStatus(nextStatus: LeadStatus) {
    if (!selectedLead || nextStatus === selectedLead.status) return;
    if (nextStatus === "Lost") {
      setLostReasonLead(selectedLead);
      return;
    }
    setSaving(true);
    const result = await changeLeadStatus(selectedLead.id, nextStatus);
    setSaving(false);
    if (!result.success) return setFeedback({ tone: "error", message: result.error });
    replaceLead(result.data);
    await refreshActivities();
    setFeedback({ tone: "success", message: "Lead status updated." });
  }

  async function handleLostConfirm(data: LostReasonSubmission) {
    if (!lostReasonLead) return;
    setSaving(true);
    const result = await changeLeadStatus(
      lostReasonLead.id,
      "Lost",
      data.reason,
      data.notes
    );
    setSaving(false);
    if (!result.success) {
      setFeedback({ tone: "error", message: result.error || "Failed to mark as lost." });
      return;
    }
    replaceLead(result.data);
    await refreshActivities();
    setLostReasonLead(null);
    setFeedback({ tone: "success", message: "Lead marked as lost." });
  }

  async function removeLead() {
    const target = deleteTarget;
    if (!target || saving) return;
    setSaving(true);
    try {
    const result = await deleteLead(target.id);
    if (!result.success) return setFeedback({ tone: "error", message: result.error });
    setLeads((current) => current.filter((lead) => lead.id !== result.data.id));
    setSelectedLead(current => current?.id === target.id ? null : current);
    setDeleteTarget(null);
    setFeedback({ tone: "success", message: "Lead deleted." });
    } catch { setFeedback({ tone: "error", message: "Could not delete this lead. Please retry." }); }
    finally { setSaving(false); }
  }

  async function handleUpdateQuickStatus(lead: Lead, statusKey: QuickStatusType | "WON" | "LOST") {
    if (statusKey === "LOST") {
      setLostReasonLead(lead);
      return;
    }
    if (statusKey === "WON") {
      setSaving(true);
      const result = await changeLeadStatus(lead.id, "Won");
      setSaving(false);
      if (!result.success) return setFeedback({ tone: "error", message: result.error });
      replaceLead(result.data);
      setFeedback({ tone: "success", message: `Lead marked as Won.` });
      return;
    }

    setSaving(true);
    const result = await updateQuickStatus(lead.id, statusKey);
    setSaving(false);
    if (!result.success) return setFeedback({ tone: "error", message: result.error });
    replaceLead(result.data);
    setFeedback({ tone: "success", message: "Quick status updated." });
  }

  function clearFilters() {
    setQuery("");
    setStatus("All");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Review prospects, priorities and next steps."
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingLead(null);
              setFormOpen(true);
            }}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 sm:w-auto"
          >
            <Plus aria-hidden="true" size={18} /> Add Lead
          </button>
        }
      />

      {feedback && (
        <div
          role={feedback.tone === "error" ? "alert" : "status"}
          className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm font-medium ${
            feedback.tone === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          <span>{feedback.message}</span>
          <button type="button" onClick={() => setFeedback(null)} className="shrink-0 font-semibold">
            Dismiss
          </button>
        </div>
      )}

      <LeadFilters query={query} status={status} onQueryChange={setQuery} onStatusChange={setStatus} onClear={clearFilters} />

      <section
        aria-label="Lead list"
        className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5 sm:px-5">
          <p className="text-sm font-semibold text-slate-900">
            {filteredLeads.length} {filteredLeads.length === 1 ? "lead" : "leads"}
          </p>
          <p className="text-xs font-medium text-slate-500">Saved CRM records</p>
        </div>
        {leads.length === 0 ? (
          <div className="p-4 sm:p-6">
            <EmptyState title="No leads yet" description="Add your first lead to begin building the pipeline." icon={UsersRound} />
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-4 sm:p-6">
            <EmptyState
              title="No leads match your filters."
              description="Try changing your search or clearing the filters."
              icon={SearchX}
            />
          </div>
        ) : (
          <>
            <LeadTable leads={filteredLeads} onSelect={selectLead} onDelete={setDeleteTarget} />
            <div className="flex flex-col gap-2 p-2 sm:grid sm:grid-cols-2 sm:gap-3 sm:p-4 lg:hidden">
              {filteredLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onSelect={selectLead}
                  onAddFollowUp={setFollowUpLead}
                  onDelete={setDeleteTarget}
                  onUpdateQuickStatus={handleUpdateQuickStatus}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {formOpen && <LeadForm
        open={formOpen}
        lead={editingLead}
        saving={saving}
        onClose={() => {
          if (!saving) {
            setFormOpen(false);
            setEditingLead(null);
          }
        }}
        onSubmit={saveLead}
        onStructureLead={onStructureLead || structureBulkLeadAction}
        onBulkSaved={saved => setLeads(current => [...saved, ...current.filter(lead => !saved.some(item => item.id === lead.id))])}
        onOpenDuplicate={openDuplicate}
        onUpdateDuplicate={updateDuplicate}
      />}
      {selectedLead && <LeadDetailPanel key={selectedLead.id}
        lead={selectedLead}
        saving={saving}
        onClose={() => {
          setSelectedLead(null);
          setDetailAction(null);
        }}
        onEdit={() => {
          if (selectedLead) {
            setEditingLead(selectedLead);
            setSelectedLead(null);
            setFormOpen(true);
          }
        }}
        onStatusChange={setLeadStatus}
        onDelete={async () => setDeleteTarget(selectedLead)}
        activities={activities}
        activityFilter={activityFilter}
        onActivityFilterChange={setActivityFilter}
        onAddNote={handleAddNote}
        onRefreshActivities={refreshActivities}
        onAddFollowUp={selectedLead ? () => setFollowUpLead(selectedLead) : undefined}
        initialAction={detailAction}
        onEditNote={handleEditNote}
        onDeleteNote={handleDeleteNote}
      />}
      <FollowUpForm
        isOpen={Boolean(followUpLead)}
        followUp={followUpLead?.activeFollowUp}
        defaultLeadId={followUpLead?.id}
        leads={followUpLead ? [{ id: followUpLead.id, name: followUpLead.name }] : []}
        saving={saving}
        onClose={() => {
          if (!saving) setFollowUpLead(null);
        }}
        onSubmit={saveFollowUp}
      />
      <DeleteLeadDialog lead={deleteTarget} saving={saving} onCancel={() => { if (!saving) setDeleteTarget(null); }} onDelete={removeLead} />
      <LostReasonDialog
        isOpen={Boolean(lostReasonLead)}
        leadId={lostReasonLead?.id}
        leadName={lostReasonLead?.name}
        isSubmitting={saving}
        onConfirm={handleLostConfirm}
        onCancel={() => {
          if (!saving) setLostReasonLead(null);
        }}
      />
    </div>
  );
}
