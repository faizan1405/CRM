"use client";

import { CheckCircle2, GitMerge, Plus, SearchX, Star, UsersRound } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLeadNavigation } from "./lead-navigation-provider";
import { statusFromDatabase, type DatabaseLeadStatus } from "./types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { changeLeadStatus, createLead, deleteLead, getLead, togglePinLead, updateLead, updateQuickStatus } from "@/app/actions/leads";
import { scheduleLeadFollowUp } from "@/app/actions/follow-ups";
import { useToast } from "@/components/toast-provider";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { LeadCard } from "@/features/leads/lead-card";
import dynamic from "next/dynamic";
const LeadDetailPanel = dynamic(() => import("@/features/leads/lead-detail-panel").then(m => m.LeadDetailPanel));
import { LeadFilters } from "@/features/leads/lead-filters";
const LeadForm = dynamic(() => import("@/features/leads/lead-form").then(m => m.LeadForm));
import { LeadTable } from "@/features/leads/lead-table";
import { PinnedLeadsView } from "./pinned-leads-view";
import { DeleteLeadDialog } from "./delete-lead-dialog";
import type { Lead, LeadSortOption, LeadStatus, QuickStatusType } from "@/features/leads/types";
import { parseSortParam, sortLeads, sortOptionToQueryParam } from "./lead-sorting";
import { LostReasonDialog } from "@/features/lost-reasons/lost-reason-dialog";
import type { LostReasonSubmission } from "@/features/lost-reasons/types";
import { useLeadActivities } from "@/features/activity/use-activities";
import { FollowUpForm } from "@/features/followups/follow-up-form";
import { MergeLeadsModal } from "./merge-leads-modal";
import { isPhoneMatch, isEmailMatch } from "./duplicate-detection-service";
import type { NewFollowUpInput } from "@/features/followups/types";
import { getFollowUpSuggestion, type FollowUpSuggestion } from "@/lib/follow-up-suggestions";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navigation = useLeadNavigation();
  const { showToast, showUndoToast } = useToast();
  const statusParam = searchParams.get("status");
  const selectedParam = searchParams.get("selected");
  const actionParam = searchParams.get("action");
  const newParam = searchParams.get("new");
  const viewParam = searchParams.get("view");
  const filterParam = searchParams.get("filter");
  const staleParam = searchParams.get("stale");
  const sortParam = searchParams.get("sort");
  const [leads, setLeads] = useState<Lead[]>(initialLeads);

  // Sync leads with incoming data on revalidation / route refresh
  useEffect(() => {
    setLeads(initialLeads);
    setSelectedLead((prev) => {
      if (!prev) return null;
      const updated = initialLeads.find((l) => l.id === prev.id);
      return updated || prev;
    });
  }, [initialLeads]);
  const [activeView, setActiveView] = useState<"all" | "pinned">(() => {
    return viewParam === "pinned" ? "pinned" : "all";
  });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeadStatus | "All">("All");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [staleOnly, setStaleOnly] = useState(() => filterParam === "stale" || staleParam === "true");
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [mergeModalData, setMergeModalData] = useState<{ leadA: Lead; leadB: Lead } | null>(null);
  const [sortBy, setSortBy] = useState<LeadSortOption>(() => parseSortParam(sortParam));
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [detailAction, setDetailAction] = useState<"note" | "status" | null>(null);
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);
  const [followUpSuggestion, setFollowUpSuggestion] = useState<FollowUpSuggestion | null>(null);
  const [lostReasonLead, setLostReasonLead] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(initialError ? { tone: "error", message: initialError } : null);

  const [dismissedPairKeys, setDismissedPairKeys] = useState<Set<string>>(new Set());

  const duplicatePairs = useMemo(() => {
    const pairs: Array<{ key: string; leadA: Lead; leadB: Lead; matchedBy: "phone" | "email" }> = [];
    const activeOnly = leads.filter((l) => !l.mergedIntoLeadId);
    const seenPairKeys = new Set<string>();

    for (let i = 0; i < activeOnly.length; i++) {
      for (let j = i + 1; j < activeOnly.length; j++) {
        const a = activeOnly[i];
        const b = activeOnly[j];
        const phoneMatch = isPhoneMatch(a.phone, b.phone);
        const emailMatch = isEmailMatch(a.email, b.email);

        if (phoneMatch || emailMatch) {
          const pairKey = [a.id, b.id].sort().join(":");
          if (!seenPairKeys.has(pairKey)) {
            seenPairKeys.add(pairKey);
            pairs.push({
              key: pairKey,
              leadA: a,
              leadB: b,
              matchedBy: phoneMatch ? "phone" : "email",
            });
          }
        }
      }
    }
    return pairs;
  }, [leads]);

  const activeDuplicatePairs = useMemo(() => {
    return duplicatePairs.filter((pair) => !dismissedPairKeys.has(pair.key));
  }, [duplicatePairs, dismissedPairKeys]);

  useEffect(() => {
    if (newParam === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormOpen(true);
    }
  }, [newParam]);

  useEffect(() => {
    if (viewParam === "pinned") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveView("pinned");
    }
  }, [viewParam]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(statusFromDatabase[statusParam as DatabaseLeadStatus] || "All");
  }, [statusParam]);

  useEffect(() => {
    if (filterParam === "stale" || staleParam === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStaleOnly(true);
    }
  }, [filterParam, staleParam]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSortBy(parseSortParam(sortParam));
  }, [sortParam]);

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
      const matchesSearch = !needle || searchable.includes(needle);
      const matchesStatus = status === "All" || lead.status === status;
      const matchesPinned = !pinnedOnly || lead.isPinned;
      const matchesStale = !staleOnly || Boolean(lead.staleInfo?.isStale);
      return matchesSearch && matchesStatus && matchesPinned && matchesStale;
    });
  }, [leads, query, status, pinnedOnly, staleOnly]);

  const handleSortByChange = useCallback(
    (nextSort: LeadSortOption) => {
      setSortBy(nextSort);
      const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
      const sortParamValue = sortOptionToQueryParam(nextSort);
      if (sortParamValue) {
        params.set("sort", sortParamValue);
      } else {
        params.delete("sort");
      }
      const qs = params.toString();
      const targetUrl = qs ? `${pathname || "/leads"}?${qs}` : pathname || "/leads";
      if (typeof window !== "undefined" && window.history?.replaceState) {
        window.history.replaceState(null, "", targetUrl);
      }
      if (router?.replace) {
        router.replace(targetUrl, { scroll: false });
      }
    },
    [pathname, router, searchParams]
  );

  const sortedLeads = useMemo(() => {
    return sortLeads(filteredLeads, sortBy);
  }, [filteredLeads, sortBy]);

  const pinnedLeads = useMemo(() => {
    return leads.filter((lead) => Boolean(lead.isPinned));
  }, [leads]);

  const sortedPinnedLeads = useMemo(() => {
    return sortLeads(pinnedLeads, sortBy);
  }, [pinnedLeads, sortBy]);

  function replaceLead(updatedLead: Lead) {
    setLeads((current) => current.map((lead) => (lead.id === updatedLead.id ? updatedLead : lead)));
    setSelectedLead((current) => (current?.id === updatedLead.id ? updatedLead : current));
  }

  async function handleTogglePin(lead: Lead) {
    const nextPinned = !lead.isPinned;
    const updatedLead: Lead = { ...lead, isPinned: nextPinned };
    replaceLead(updatedLead);
    try {
      const result = await togglePinLead(lead.id, nextPinned);
      if (!result.success) {
        replaceLead(lead);
        setFeedback({ tone: "error", message: result.error });
      } else {
        replaceLead(result.data);
        const msg = nextPinned ? "Lead pinned to shortlist" : "Lead removed from shortlist";
        if (result.undoId) {
          showUndoToast(msg, result.undoId, () => {
            void replaceLead(result.data!);
          });
        } else {
          setFeedback({ tone: "success", message: msg });
        }
      }
    } catch {
      replaceLead(lead);
      setFeedback({ tone: "error", message: "Failed to update pin state." });
    }
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
    const msg = editingLead ? "Lead updated." : "Lead added.";
    if (result.undoId) {
      showUndoToast(msg, result.undoId);
    } else {
      setFeedback({ tone: "success", message: msg });
    }
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

  async function saveFollowUp(data: NewFollowUpInput & { mode?: "reschedule" | "create" }) {
    setSaving(true);
    setFeedback(null);
    const formData = new FormData();
    if (data.mode === "create") {
      formData.append("mode", "create");
    } else if (data.id) {
      formData.append("id", data.id);
    } else if (followUpLead?.activeFollowUp?.id) {
      formData.append("id", followUpLead.activeFollowUp.id);
    }
    if (data.mode) formData.append("mode", data.mode);
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
    setFollowUpLead(null);
    if (selectedLead?.id === data.leadId) await refreshActivities();
    if (result.undoId) {
      const msg = isRescheduled ? "Follow-up rescheduled" : "Follow-up added";
      showUndoToast(msg, result.undoId, () => {
        if (selectedLead) {
          void refreshActivities();
        }
      });
    } else {
      setFeedback({ tone: "success", message: isRescheduled ? "Follow-up rescheduled." : "Follow-up added." });
    }
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
    if (result.undoId) {
      showUndoToast(`Lead moved to ${nextStatus}`, result.undoId);
    } else {
      setFeedback({ tone: "success", message: "Lead status updated." });
    }

    if (nextStatus === "Proposal Sent") {
      setFollowUpSuggestion(getFollowUpSuggestion("PROPOSAL_SENT"));
      setFollowUpLead(result.data);
    }
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
    if (result.undoId) {
      showUndoToast("Lead marked as Lost", result.undoId, () => {
        void replaceLead(result.data!);
      });
    } else {
      setFeedback({ tone: "success", message: "Lead marked as lost." });
    }
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
    if (result.undoId) {
      showUndoToast(`Lead "${target.name}" deleted`, result.undoId);
    } else {
      setFeedback({ tone: "success", message: "Lead deleted." });
    }
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
    if (result.undoId) {
      showUndoToast(`Quick status updated to ${statusKey}`, result.undoId, () => {
        void replaceLead(result.data!);
      });
    } else {
      setFeedback({ tone: "success", message: "Quick status updated." });
    }

    if (statusKey === "CALL_NOT_PICK") {
      setFollowUpSuggestion(getFollowUpSuggestion("NOT_PICKED"));
      setFollowUpLead(result.data);
    } else if (statusKey === "INTERESTED") {
      setFollowUpSuggestion(getFollowUpSuggestion("INTERESTED"));
      setFollowUpLead(result.data);
    } else if (statusKey === "CALL_AGAIN") {
      setFollowUpSuggestion(getFollowUpSuggestion("CALL_BACK"));
      setFollowUpLead(result.data);
    }
  }

  function clearFilters() {
    setQuery("");
    setStatus("All");
    setPinnedOnly(false);
    setStaleOnly(false);
    setDuplicatesOnly(false);
    handleSortByChange("default");
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
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 sm:w-auto cursor-pointer"
          >
            <Plus aria-hidden="true" size={18} /> Add Lead
          </button>
        }
      />

      {/* View Switcher: All Leads vs Dedicated Pinned Leads */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3" role="tablist" aria-label="Leads views">
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "all"}
          onClick={() => setActiveView("all")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
            activeView === "all"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          All Leads
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            activeView === "all" ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600"
          }`}>
            {leads.length}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "pinned"}
          onClick={() => setActiveView("pinned")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
            activeView === "pinned"
              ? "bg-amber-400 text-slate-950 shadow-sm font-bold"
              : "text-slate-600 hover:bg-amber-50 hover:text-amber-900"
          }`}
        >
          <Star className={`size-4 ${activeView === "pinned" ? "fill-slate-950 text-slate-950" : "fill-amber-400 text-amber-500"}`} />
          Pinned Leads
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            activeView === "pinned" ? "bg-amber-300 text-slate-950" : "bg-amber-100 text-amber-800"
          }`}>
            {pinnedLeads.length}
          </span>
        </button>
      </div>

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
          <button type="button" onClick={() => setFeedback(null)} className="shrink-0 font-semibold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {activeView === "pinned" ? (
        <PinnedLeadsView
          leads={sortedPinnedLeads}
          sortBy={sortBy}
          onSortByChange={handleSortByChange}
          onSelect={selectLead}
          onTogglePin={handleTogglePin}
          onAddFollowUp={setFollowUpLead}
        />
      ) : (
        <>
          <LeadFilters
            query={query}
            status={status}
            pinnedOnly={pinnedOnly}
            staleOnly={staleOnly}
            duplicatesOnly={duplicatesOnly}
            sortBy={sortBy}
            onQueryChange={setQuery}
            onStatusChange={setStatus}
            onPinnedOnlyChange={setPinnedOnly}
            onStaleOnlyChange={setStaleOnly}
            onDuplicatesOnlyChange={setDuplicatesOnly}
            onSortByChange={handleSortByChange}
            onClear={clearFilters}
          />

          {duplicatesOnly ? (
            <section
              aria-label="Possible duplicates list"
              className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-center justify-between border-b border-amber-200/80 bg-amber-50/70 px-4 py-3.5 sm:px-5">
                <div className="flex items-center gap-2">
                  <GitMerge className="size-4 text-amber-700" />
                  <p className="text-sm font-bold text-amber-950">
                    {activeDuplicatePairs.length} {activeDuplicatePairs.length === 1 ? "duplicate pair" : "duplicate pairs"} detected
                  </p>
                </div>
                <p className="text-xs font-medium text-amber-800">Review and safely merge or keep separate</p>
              </div>

              {activeDuplicatePairs.length === 0 ? (
                <div className="p-8 text-center bg-white">
                  <div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600 mb-3">
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">No duplicate leads detected</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    All active leads have unique phone numbers and email addresses.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-amber-100 bg-white p-4 space-y-4">
                  {activeDuplicatePairs.map((pair) => (
                    <div
                      key={pair.key}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-slate-300"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                          <GitMerge size={13} />
                          Matching Signal: {pair.matchedBy === "phone" ? "Same normalized phone number" : "Same email address"}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDismissedPairKeys((prev) => new Set([...prev, pair.key]));
                              setFeedback({
                                tone: "success",
                                message: `Kept ${pair.leadA.name} and ${pair.leadB.name} separate.`,
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
                          >
                            Keep Separate
                          </button>
                          <button
                            type="button"
                            onClick={() => setMergeModalData({ leadA: pair.leadA, leadB: pair.leadB })}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 cursor-pointer"
                          >
                            <GitMerge size={13} /> Review / Merge
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        {/* Lead A */}
                        <div
                          onClick={() => void selectLead(pair.leadA)}
                          className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 hover:border-blue-200 hover:bg-blue-50/30 cursor-pointer transition"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-900 truncate">{pair.leadA.name}</h4>
                            <span className="shrink-0 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {pair.leadA.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600 font-mono">{pair.leadA.phone}</p>
                          {pair.leadA.email && (
                            <p className="mt-0.5 text-xs text-slate-500 truncate">{pair.leadA.email}</p>
                          )}
                          {pair.leadA.business && (
                            <p className="mt-0.5 text-xs text-slate-500 truncate">{pair.leadA.business}</p>
                          )}
                          <p className="mt-2 text-[10px] text-slate-400">
                            Created: {new Date(pair.leadA.createdAt).toLocaleDateString("en-IN")}
                          </p>
                        </div>

                        {/* Lead B */}
                        <div
                          onClick={() => void selectLead(pair.leadB)}
                          className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 hover:border-blue-200 hover:bg-blue-50/30 cursor-pointer transition"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-bold text-slate-900 truncate">{pair.leadB.name}</h4>
                            <span className="shrink-0 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {pair.leadB.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600 font-mono">{pair.leadB.phone}</p>
                          {pair.leadB.email && (
                            <p className="mt-0.5 text-xs text-slate-500 truncate">{pair.leadB.email}</p>
                          )}
                          {pair.leadB.business && (
                            <p className="mt-0.5 text-xs text-slate-500 truncate">{pair.leadB.business}</p>
                          )}
                          <p className="mt-2 text-[10px] text-slate-400">
                            Created: {new Date(pair.leadB.createdAt).toLocaleDateString("en-IN")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section
              aria-label="Lead list"
              className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5 sm:px-5">
                <p className="text-sm font-semibold text-slate-900">
                  {sortedLeads.length} {sortedLeads.length === 1 ? "lead" : "leads"}
                </p>
                <p className="text-xs font-medium text-slate-500">Saved CRM records</p>
              </div>
              {leads.length === 0 ? (
                <div className="p-4 sm:p-6">
                  <EmptyState title="No leads yet" description="Add your first lead to begin building the pipeline." icon={UsersRound} />
                </div>
              ) : sortedLeads.length === 0 ? (
                <div className="p-4 sm:p-6">
                  <EmptyState
                    title="No leads match your filters."
                    description="Try changing your search or clearing the filters."
                    icon={SearchX}
                  />
                </div>
              ) : (
                <>
                  <LeadTable
                    leads={sortedLeads}
                    onSelect={selectLead}
                    onDelete={setDeleteTarget}
                    onTogglePin={handleTogglePin}
                  />
                  <div className="flex flex-col gap-2 p-2 sm:grid sm:grid-cols-2 sm:gap-3 sm:p-4 lg:hidden">
                    {sortedLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onSelect={selectLead}
                        onAddFollowUp={setFollowUpLead}
                        onDelete={setDeleteTarget}
                        onTogglePin={handleTogglePin}
                        onUpdateQuickStatus={handleUpdateQuickStatus}
                      />
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}

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
        onLeadEnriched={(enrichedLead) => {
          replaceLead(enrichedLead);
          setFormOpen(false);
          setEditingLead(null);
          setFeedback({ tone: "success", message: `Updated existing lead ${enrichedLead.name}.` });
          void selectLead(enrichedLead);
        }}
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
        onLeadUpdated={replaceLead}
        activities={activities}
        activityFilter={activityFilter}
        onActivityFilterChange={setActivityFilter}
        onAddNote={handleAddNote}
        onRefreshActivities={refreshActivities}
        onAddFollowUp={selectedLead ? () => setFollowUpLead(selectedLead) : undefined}
        initialAction={detailAction}
        onEditNote={handleEditNote}
        onDeleteNote={handleDeleteNote}
        onTogglePin={() => handleTogglePin(selectedLead)}
        onOpenLead={async (targetId) => {
          const found = leads.find((l) => l.id === targetId);
          if (found) {
            void selectLead(found);
          } else {
            const res = await getLead(targetId);
            if (res.success) {
              setSelectedLead(res.data);
            }
          }
        }}
        onInitiateMerge={(leadToMerge) => {
          const match = duplicatePairs.find(
            (p) => p.leadA.id === leadToMerge.id || p.leadB.id === leadToMerge.id
          );
          if (match) {
            const other = match.leadA.id === leadToMerge.id ? match.leadB : match.leadA;
            setMergeModalData({ leadA: leadToMerge, leadB: other });
          } else {
            const other = leads.find(
              (l) =>
                l.id !== leadToMerge.id &&
                !l.mergedIntoLeadId &&
                (isPhoneMatch(l.phone, leadToMerge.phone) || isEmailMatch(l.email, leadToMerge.email))
            );
            if (other) {
              setMergeModalData({ leadA: leadToMerge, leadB: other });
            } else {
              setFeedback({
                tone: "error",
                message: "No matching duplicate lead found for this record.",
              });
            }
          }
        }}
      />}
      <FollowUpForm
        isOpen={Boolean(followUpLead)}
        followUp={followUpLead?.activeFollowUp}
        defaultLeadId={followUpLead?.id}
        leads={followUpLead ? [{ id: followUpLead.id, name: followUpLead.name }] : []}
        saving={saving}
        suggestion={followUpSuggestion}
        onClose={() => {
          if (!saving) {
            setFollowUpLead(null);
            setFollowUpSuggestion(null);
          }
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
      {mergeModalData && (
        <MergeLeadsModal
          mode="merge"
          isOpen={Boolean(mergeModalData)}
          leadA={mergeModalData.leadA}
          leadB={mergeModalData.leadB}
          onClose={() => setMergeModalData(null)}
          onSuccess={(mergedLead) => {
            const secondaryId =
              mergeModalData.leadA.id === mergedLead.id
                ? mergeModalData.leadB.id
                : mergeModalData.leadA.id;
            setLeads((current) =>
              current
                .map((l) => (l.id === mergedLead.id ? mergedLead : l))
                .filter((l) => l.id !== secondaryId)
            );
            setSelectedLead(mergedLead);
            setMergeModalData(null);
            setFeedback({
              tone: "success",
              message: `Leads successfully merged into ${mergedLead.name}.`,
            });
          }}
        />
      )}
    </div>
  );
}
