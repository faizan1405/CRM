"use client";

import {
  CheckCircle2,
  GitMerge,
  Plus,
  SearchX,
  Star,
  UsersRound,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLeadNavigation } from "./lead-navigation-provider";
import { statusFromDatabase, type DatabaseLeadStatus } from "./types";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  changeLeadStatus,
  createLead,
  deleteLead,
  getLead,
  togglePinLead,
  updateLead,
  updateQuickStatus,
} from "@/app/actions/leads";
import { scheduleLeadFollowUp } from "@/app/actions/follow-ups";
import { useToast } from "@/components/toast-provider";
import { EmptyState } from "@/components/empty-state";
import dynamic from "next/dynamic";
const LeadDetailPanel = dynamic(() =>
  import("@/features/leads/lead-detail-panel").then((m) => m.LeadDetailPanel)
);
import { LeadFilters } from "@/features/leads/lead-filters";
const LeadForm = dynamic(() =>
  import("@/features/leads/lead-form").then((m) => m.LeadForm)
);
import { LeadTable } from "@/features/leads/lead-table";
import { PinnedLeadsView } from "./pinned-leads-view";
import { DeleteLeadDialog } from "./delete-lead-dialog";
import type {
  Lead,
  LeadSortOption,
  LeadStatus,
  QuickStatusType,
} from "@/features/leads/types";
import {
  parseSortParam,
  sortLeads,
  sortOptionToQueryParam,
} from "./lead-sorting";
import { LostReasonDialog } from "@/features/lost-reasons/lost-reason-dialog";
import type { LostReasonSubmission } from "@/features/lost-reasons/types";
import { useLeadActivities } from "@/features/activity/use-activities";
import { FollowUpForm } from "@/features/followups/follow-up-form";
import { MergeLeadsModal } from "./merge-leads-modal";
import {
  isPhoneMatch,
  isEmailMatch,
  normalizePhone,
  normalizeEmail,
} from "./duplicate-detection-service";
import type { NewFollowUpInput } from "@/features/followups/types";
import {
  getFollowUpSuggestion,
  type FollowUpSuggestion,
} from "@/lib/follow-up-suggestions";
import type {
  DuplicateLeadCandidate,
  StructuredLeadDraft,
} from "@/features/leads/ai-entry-types";
import type { BulkStructureLeadCallback } from "./bulk-review-types";
import {
  structureBulkLeadAction,
  updateExistingLeadWithDraftAction,
} from "@/app/actions/ai-lead-entry";
import { formatCurrency } from "@/features/leads/formatters";
import { cn } from "@/lib/utils";

type Feedback = { tone: "success" | "error"; message: string } | null;

type LeadsWorkspaceProps = {
  initialLeads: Lead[];
  initialError: string | null;
  onStructureLead?: BulkStructureLeadCallback;
};

export function LeadsWorkspace({
  initialLeads,
  initialError,
  onStructureLead,
}: LeadsWorkspaceProps) {
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
  const [staleOnly, setStaleOnly] = useState(
    () => filterParam === "stale" || staleParam === "true"
  );
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [selectedQuickStatuses, setSelectedQuickStatuses] = useState<
    QuickStatusType[]
  >([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [mergeModalData, setMergeModalData] = useState<{
    leadA: Lead;
    leadB: Lead;
  } | null>(null);
  const [sortBy, setSortBy] = useState<LeadSortOption>(() =>
    parseSortParam(sortParam)
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [detailAction, setDetailAction] = useState<"note" | "status" | null>(
    null
  );
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);
  const [followUpSuggestion, setFollowUpSuggestion] =
    useState<FollowUpSuggestion | null>(null);
  const [lostReasonLead, setLostReasonLead] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(
    initialError ? { tone: "error", message: initialError } : null
  );

  const [dismissedPairKeys, setDismissedPairKeys] = useState<Set<string>>(
    new Set()
  );

  const duplicatePairs = useMemo(() => {
    const pairs: Array<{
      key: string;
      leadA: Lead;
      leadB: Lead;
      matchedBy: "phone" | "email";
    }> = [];
    const activeOnly = leads.filter((l) => !l.mergedIntoLeadId);
    const seenPairKeys = new Set<string>();

    const phoneMap = new Map<string, Lead[]>();
    const emailMap = new Map<string, Lead[]>();

    for (const lead of activeOnly) {
      const normP = normalizePhone(lead.phone);
      if (normP?.isValid && normP.comparisonDigits) {
        const phoneKey = `${normP.isIndian ? "IN" : "INTL"}:${normP.comparisonDigits}`;
        const existing = phoneMap.get(phoneKey);
        if (existing) {
          for (const prev of existing) {
            const pairKey = [lead.id, prev.id].sort().join(":");
            if (!seenPairKeys.has(pairKey)) {
              seenPairKeys.add(pairKey);
              pairs.push({
                key: pairKey,
                leadA: prev,
                leadB: lead,
                matchedBy: "phone",
              });
            }
          }
          existing.push(lead);
        } else {
          phoneMap.set(phoneKey, [lead]);
        }
      }

      const normE = normalizeEmail(lead.email);
      if (normE) {
        const existing = emailMap.get(normE);
        if (existing) {
          for (const prev of existing) {
            const pairKey = [lead.id, prev.id].sort().join(":");
            if (!seenPairKeys.has(pairKey)) {
              seenPairKeys.add(pairKey);
              pairs.push({
                key: pairKey,
                leadA: prev,
                leadB: lead,
                matchedBy: "email",
              });
            }
          }
          existing.push(lead);
        } else {
          emailMap.set(normE, [lead]);
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
      setFormOpen(true);
    }
  }, [newParam]);

  useEffect(() => {
    if (viewParam === "pinned") {
      setActiveView("pinned");
    }
  }, [viewParam]);

  useEffect(() => {
    setStatus(statusFromDatabase[statusParam as DatabaseLeadStatus] || "All");
  }, [statusParam]);

  useEffect(() => {
    if (filterParam === "stale" || staleParam === "true") {
      setStaleOnly(true);
    }
  }, [filterParam, staleParam]);

  useEffect(() => {
    setSortBy(parseSortParam(sortParam));
  }, [sortParam]);

  useEffect(() => {
    if (selectedParam && navigation) {
      navigation.openLead(
        selectedParam,
        actionParam === "activity" || actionParam === "followups"
          ? actionParam
          : null
      );
    }
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

  // Precomputed status counts for horizontal status filter tabs
  const statusCounts = useMemo(() => {
    const counts: Record<LeadStatus | "All", number> = {
      All: leads.length,
      New: 0,
      Contacted: 0,
      Qualified: 0,
      "Proposal Sent": 0,
      Won: 0,
      Lost: 0,
    };
    for (const lead of leads) {
      if (lead.status in counts) {
        counts[lead.status]++;
      }
    }
    return counts;
  }, [leads]);

  // Total value in budgets & quotes
  const totalValue = useMemo(() => {
    return leads.reduce((acc, lead) => {
      const val = lead.quotedAmount ?? lead.budget ?? 0;
      return acc + Number(val);
    }, 0);
  }, [leads]);

  // Dynamically extract available sources from leads
  const availableSources = useMemo(() => {
    const set = new Set<string>([
      "Website",
      "Referral",
      "WhatsApp",
      "Instagram",
      "Trade Show",
      "Cold Call",
      "LinkedIn",
    ]);
    for (const l of leads) {
      if (l.source) set.add(l.source);
    }
    return Array.from(set);
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const searchable = [
        lead.name,
        lead.business,
        lead.phone,
        lead.email,
        lead.industry,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = !needle || searchable.includes(needle);
      const matchesStatus = status === "All" || lead.status === status;
      const matchesPinned = !pinnedOnly || Boolean(lead.isPinned);
      const matchesStale = !staleOnly || Boolean(lead.staleInfo?.isStale);
      const matchesQuickStatus =
        selectedQuickStatuses.length === 0 ||
        (lead.quickStatus && selectedQuickStatuses.includes(lead.quickStatus));
      const matchesSource =
        selectedSources.length === 0 ||
        (lead.source && selectedSources.includes(lead.source));

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPinned &&
        matchesStale &&
        matchesQuickStatus &&
        matchesSource
      );
    });
  }, [
    leads,
    query,
    status,
    pinnedOnly,
    staleOnly,
    selectedQuickStatuses,
    selectedSources,
  ]);

  const handleSortByChange = useCallback(
    (nextSort: LeadSortOption) => {
      setSortBy(nextSort);
      const params = new URLSearchParams(
        searchParams ? searchParams.toString() : ""
      );
      const sortParamValue = sortOptionToQueryParam(nextSort);
      if (sortParamValue) {
        params.set("sort", sortParamValue);
      } else {
        params.delete("sort");
      }
      const qs = params.toString();
      const targetUrl = qs
        ? `${pathname || "/leads"}?${qs}`
        : pathname || "/leads";
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
    setLeads((current) =>
      current.map((lead) => (lead.id === updatedLead.id ? updatedLead : lead))
    );
    setSelectedLead((current) =>
      current?.id === updatedLead.id ? updatedLead : current
    );
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
        const msg = nextPinned
          ? "Lead pinned to shortlist"
          : "Lead removed from shortlist";
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
    const result = editingLead
      ? await updateLead(editingLead.id, formData)
      : await createLead(formData);
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

  async function selectLead(
    lead: Lead,
    action: "note" | "status" | null = null
  ) {
    setDetailAction(action);
    setSelectedLead(lead);
    const result = await getLead(lead.id);
    if (result.success) {
      setSelectedLead((current) =>
        current?.id === lead.id ? result.data : current
      );
    } else {
      setFeedback({ tone: "error", message: result.error });
    }
  }

  function findDuplicate(candidate: DuplicateLeadCandidate) {
    return leads.find((lead) => lead.id === candidate.id);
  }

  function openDuplicate(candidate: DuplicateLeadCandidate) {
    const existing = findDuplicate(candidate);
    if (!existing) {
      setFeedback({
        tone: "error",
        message: "That existing lead is not available in this list.",
      });
      return;
    }
    setFormOpen(false);
    setEditingLead(null);
    void selectLead(existing);
  }

  async function updateDuplicate(
    candidate: DuplicateLeadCandidate,
    draft: StructuredLeadDraft
  ) {
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
    setFeedback({
      tone: "success",
      message: "Existing lead updated with AI details.",
    });
    void selectLead(result.data);
  }

  async function saveFollowUp(
    data: NewFollowUpInput & { mode?: "reschedule" | "create" }
  ) {
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
    const msg = isRescheduled ? "Follow-up rescheduled." : "Follow-up scheduled.";

    if (result.undoId) {
      showUndoToast(msg, result.undoId);
    } else {
      setFeedback({ tone: "success", message: msg });
    }

    if (followUpLead) {
      const refreshed = await getLead(followUpLead.id);
      if (refreshed.success) replaceLead(refreshed.data);
    }
    setFollowUpLead(null);
    setFollowUpSuggestion(null);
  }

  async function removeLead(lead: Lead) {
    setSaving(true);
    setFeedback(null);
    const result = await deleteLead(lead.id);
    setSaving(false);
    if (!result.success) {
      setFeedback({ tone: "error", message: result.error });
      return;
    }

    setLeads((current) => current.filter((l) => l.id !== lead.id));
    if (selectedLead?.id === lead.id) setSelectedLead(null);
    setDeleteTarget(null);

    const msg = `Lead ${lead.name} moved to trash.`;
    if (result.undoId) {
      showUndoToast(msg, result.undoId, () => {
        setLeads((current) => [lead, ...current]);
      });
    } else {
      setFeedback({ tone: "success", message: msg });
    }
  }

  async function setLeadStatus(nextStatus: LeadStatus) {
    if (!selectedLead) return;
    if (nextStatus === "Lost") {
      setLostReasonLead(selectedLead);
      return;
    }
    setSaving(true);
    setFeedback(null);
    const previous = selectedLead;
    replaceLead({ ...selectedLead, status: nextStatus });
    const result = await changeLeadStatus(selectedLead.id, nextStatus);
    setSaving(false);
    if (!result.success) {
      replaceLead(previous);
      setFeedback({ tone: "error", message: result.error });
      return;
    }
    replaceLead(result.data);
    const msg = `Lead moved to ${nextStatus}.`;
    if (result.undoId) {
      showUndoToast(msg, result.undoId, () => {
        void replaceLead(previous);
      });
    } else {
      setFeedback({ tone: "success", message: msg });
    }
  }

  async function handleLostConfirm(data: LostReasonSubmission) {
    if (!lostReasonLead) return;
    setSaving(true);
    setFeedback(null);
    const targetLead = lostReasonLead;
    const previous = targetLead;
    replaceLead({ ...targetLead, status: "Lost" });
    const result = await changeLeadStatus(targetLead.id, "Lost", data.reason, data.notes);
    setSaving(false);
    setLostReasonLead(null);
    if (!result.success) {
      replaceLead(previous);
      setFeedback({ tone: "error", message: result.error });
      return;
    }
    replaceLead(result.data);
    const msg = "Lead marked as Lost.";
    if (result.undoId) {
      showUndoToast(msg, result.undoId, () => {
        void replaceLead(previous);
      });
    } else {
      setFeedback({ tone: "success", message: msg });
    }
  }

  async function handleUpdateQuickStatus(
    lead: Lead,
    nextQuickStatus: QuickStatusType
  ) {
    const previous = lead;
    replaceLead({ ...lead, quickStatus: nextQuickStatus });
    try {
      const result = await updateQuickStatus(lead.id, nextQuickStatus);
      if (!result.success) {
        replaceLead(previous);
        setFeedback({ tone: "error", message: result.error });
      } else {
        replaceLead(result.data);
      }
    } catch {
      replaceLead(previous);
      setFeedback({
        tone: "error",
        message: "Failed to update quick status.",
      });
    }
  }

  function handleQuickStatusToggle(qs: QuickStatusType) {
    setSelectedQuickStatuses((prev) =>
      prev.includes(qs) ? prev.filter((item) => item !== qs) : [...prev, qs]
    );
  }

  function handleSourceToggle(source: string) {
    setSelectedSources((prev) =>
      prev.includes(source)
        ? prev.filter((item) => item !== source)
        : [...prev, source]
    );
  }

  function clearFilters() {
    setQuery("");
    setStatus("All");
    setPinnedOnly(false);
    setStaleOnly(false);
    setDuplicatesOnly(false);
    setSelectedQuickStatuses([]);
    setSelectedSources([]);
    handleSortByChange("default");
  }

  const hasAnyFilter =
    query.trim().length > 0 ||
    status !== "All" ||
    pinnedOnly ||
    staleOnly ||
    duplicatesOnly ||
    selectedQuickStatuses.length > 0 ||
    selectedSources.length > 0 ||
    sortBy !== "default";

  return (
    <div className="space-y-4">
      {/* ─── Lovable Premium Heading ────────────────────────────── */}
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-semibold leading-tight sm:text-[26px] text-foreground">
            Leads
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            <span className="tabular font-medium">{leads.length}</span>{" "}
            {leads.length === 1 ? "lead" : "leads"} ·{" "}
            <span className="tabular font-medium">
              {formatCurrency(totalValue)}
            </span>{" "}
            in budgets &amp; quotes
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingLead(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-[13px] font-semibold cursor-pointer press bg-primary text-primary-foreground shadow-[inset_0_1px_0_oklch(1_0_0/18%),0_1px_2px_oklch(0.2_0.05_160/30%)] hover:bg-primary/92 h-9 px-3.5 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add lead
          </button>
        </div>
      </header>

      {/* ─── View Switcher: All Leads vs Pinned Leads ──────────── */}
      <div
        className="mb-3 inline-flex items-center gap-1 rounded-xl bg-muted p-1"
        role="tablist"
        aria-label="Leads views"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "all"}
          onClick={() => setActiveView("all")}
          className={cn(
            "press inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[13px] font-medium transition-all cursor-pointer",
            activeView === "all"
              ? "bg-card text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>All Leads</span>
          <span
            className={cn(
              "tabular text-[11.5px] rounded-full px-1.5 py-0.2",
              activeView === "all"
                ? "bg-muted text-foreground font-semibold"
                : "text-subtle"
            )}
          >
            {leads.length}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "pinned"}
          onClick={() => setActiveView("pinned")}
          className={cn(
            "press inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-all cursor-pointer",
            activeView === "pinned"
              ? "bg-card text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Star
            className={cn(
              "size-3.5",
              activeView === "pinned"
                ? "fill-amber-400 text-amber-500"
                : "text-subtle"
            )}
          />
          <span>Pinned Leads</span>
          <span
            className={cn(
              "tabular text-[11.5px] rounded-full px-1.5 py-0.2",
              activeView === "pinned"
                ? "bg-amber-500/10 text-amber-600 font-semibold"
                : "text-subtle"
            )}
          >
            {pinnedLeads.length}
          </span>
        </button>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          role={feedback.tone === "error" ? "alert" : "status"}
          className={cn(
            "flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm font-medium",
            feedback.tone === "error"
              ? "border-destructive/30 bg-danger-soft text-destructive"
              : "border-primary/30 bg-success-soft text-primary"
          )}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="shrink-0 font-semibold cursor-pointer text-xs uppercase hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── Pinned View vs All Leads View ─────────────────────── */}
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
          {/* Lovable Filter Bar & Status Tabs */}
          <LeadFilters
            query={query}
            status={status}
            pinnedOnly={pinnedOnly}
            staleOnly={staleOnly}
            duplicatesOnly={duplicatesOnly}
            sortBy={sortBy}
            selectedQuickStatuses={selectedQuickStatuses}
            availableSources={availableSources}
            selectedSources={selectedSources}
            statusCounts={statusCounts}
            totalLeads={leads.length}
            filteredCount={sortedLeads.length}
            onQueryChange={setQuery}
            onStatusChange={setStatus}
            onPinnedOnlyChange={setPinnedOnly}
            onStaleOnlyChange={setStaleOnly}
            onDuplicatesOnlyChange={setDuplicatesOnly}
            onSortByChange={handleSortByChange}
            onQuickStatusToggle={handleQuickStatusToggle}
            onSourceToggle={handleSourceToggle}
            onClear={clearFilters}
          />

          {duplicatesOnly ? (
            <section
              aria-label="Possible duplicates list"
              className="overflow-hidden rounded-xl border border-amber-500/30 bg-card shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center justify-between border-b border-amber-500/20 bg-amber-500/10 px-4 py-3.5 sm:px-5">
                <div className="flex items-center gap-2">
                  <GitMerge className="size-4 text-amber-600" />
                  <p className="text-sm font-semibold text-foreground">
                    {activeDuplicatePairs.length}{" "}
                    {activeDuplicatePairs.length === 1
                      ? "duplicate pair"
                      : "duplicate pairs"}{" "}
                    detected
                  </p>
                </div>
                <p className="text-xs font-medium text-muted-foreground">
                  Review and safely merge or keep separate
                </p>
              </div>

              {activeDuplicatePairs.length === 0 ? (
                <div className="p-8 text-center bg-card">
                  <div className="mx-auto grid size-12 place-items-center rounded-full bg-success-soft text-primary mb-3">
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    No duplicate leads detected
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    All active leads have unique phone numbers and email
                    addresses.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border bg-card p-4 space-y-4">
                  {activeDuplicatePairs.map((pair) => (
                    <div
                      key={pair.key}
                      className="rounded-xl border border-border bg-card p-4 shadow-xs transition hover:border-border/80"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          <GitMerge size={13} />
                          Matching Signal:{" "}
                          {pair.matchedBy === "phone"
                            ? "Same normalized phone number"
                            : "Same email address"}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDismissedPairKeys(
                                (prev) => new Set([...prev, pair.key])
                              );
                              setFeedback({
                                tone: "success",
                                message: `Kept ${pair.leadA.name} and ${pair.leadB.name} separate.`,
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted cursor-pointer"
                          >
                            Keep Separate
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setMergeModalData({
                                leadA: pair.leadA,
                                leadB: pair.leadB,
                              })
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 cursor-pointer"
                          >
                            <GitMerge size={13} /> Review / Merge
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        {/* Lead A */}
                        <div
                          onClick={() => void selectLead(pair.leadA)}
                          className="rounded-lg border border-border/60 bg-muted/30 p-3 hover:border-primary/40 hover:bg-muted/50 cursor-pointer transition"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-semibold text-foreground truncate">
                              {pair.leadA.name}
                            </h4>
                            <span className="shrink-0 text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              {pair.leadA.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground font-mono">
                            {pair.leadA.phone}
                          </p>
                          {pair.leadA.email && (
                            <p className="mt-0.5 text-xs text-subtle truncate">
                              {pair.leadA.email}
                            </p>
                          )}
                          {pair.leadA.business && (
                            <p className="mt-0.5 text-xs text-subtle truncate">
                              {pair.leadA.business}
                            </p>
                          )}
                          <p className="mt-2 text-[10px] text-subtle">
                            Created:{" "}
                            {new Date(pair.leadA.createdAt).toLocaleDateString(
                              "en-IN"
                            )}
                          </p>
                        </div>

                        {/* Lead B */}
                        <div
                          onClick={() => void selectLead(pair.leadB)}
                          className="rounded-lg border border-border/60 bg-muted/30 p-3 hover:border-primary/40 hover:bg-muted/50 cursor-pointer transition"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-semibold text-foreground truncate">
                              {pair.leadB.name}
                            </h4>
                            <span className="shrink-0 text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                              {pair.leadB.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground font-mono">
                            {pair.leadB.phone}
                          </p>
                          {pair.leadB.email && (
                            <p className="mt-0.5 text-xs text-subtle truncate">
                              {pair.leadB.email}
                            </p>
                          )}
                          {pair.leadB.business && (
                            <p className="mt-0.5 text-xs text-subtle truncate">
                              {pair.leadB.business}
                            </p>
                          )}
                          <p className="mt-2 text-[10px] text-subtle">
                            Created:{" "}
                            {new Date(pair.leadB.createdAt).toLocaleDateString(
                              "en-IN"
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <>
              {leads.length === 0 ? (
                <div className="card-surface rounded-xl border border-border p-8 text-center shadow-xs">
                  <EmptyState
                    title="No leads yet"
                    description="Add your first lead to begin building the pipeline."
                    icon={UsersRound}
                  />
                </div>
              ) : sortedLeads.length === 0 ? (
                <div className="card-surface rounded-xl border border-border p-12 text-center shadow-xs">
                  <div className="relative mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl bg-card text-muted-foreground shadow-[var(--shadow-card)]">
                    <SearchX className="h-5 w-5" />
                  </div>
                  <h3 className="text-[14px] font-semibold text-foreground">
                    No leads match
                  </h3>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Try another name or phone number, or clear your filters.
                  </p>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-3.5 py-1.5 text-[13px] font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      Clear all filters
                    </button>
                  </div>
                </div>
              ) : (
                <LeadTable
                  leads={sortedLeads}
                  totalCount={leads.length}
                  onSelect={selectLead}
                  onDelete={setDeleteTarget}
                  onTogglePin={handleTogglePin}
                  onClearFilters={clearFilters}
                  hasFilters={hasAnyFilter}
                />
              )}
            </>
          )}
        </>
      )}

      {/* ─── Modals and Panels ─────────────────────────────────── */}
      {formOpen && (
        <LeadForm
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
          onBulkSaved={(saved) =>
            setLeads((current) => [
              ...saved,
              ...current.filter(
                (lead) => !saved.some((item) => item.id === lead.id)
              ),
            ])
          }
          onOpenDuplicate={openDuplicate}
          onUpdateDuplicate={updateDuplicate}
          onLeadEnriched={(enrichedLead) => {
            replaceLead(enrichedLead);
            setFormOpen(false);
            setEditingLead(null);
            setFeedback({
              tone: "success",
              message: `Updated existing lead ${enrichedLead.name}.`,
            });
            void selectLead(enrichedLead);
          }}
        />
      )}

      {selectedLead && (
        <LeadDetailPanel
          key={selectedLead.id}
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
          onAddFollowUp={
            selectedLead ? () => setFollowUpLead(selectedLead) : undefined
          }
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
              (p) =>
                p.leadA.id === leadToMerge.id || p.leadB.id === leadToMerge.id
            );
            if (match) {
              const other =
                match.leadA.id === leadToMerge.id ? match.leadB : match.leadA;
              setMergeModalData({ leadA: leadToMerge, leadB: other });
            } else {
              const other = leads.find(
                (l) =>
                  l.id !== leadToMerge.id &&
                  !l.mergedIntoLeadId &&
                  (isPhoneMatch(l.phone, leadToMerge.phone) ||
                    isEmailMatch(l.email, leadToMerge.email))
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
        />
      )}

      <FollowUpForm
        isOpen={Boolean(followUpLead)}
        followUp={followUpLead?.activeFollowUp}
        defaultLeadId={followUpLead?.id}
        leads={
          followUpLead
            ? [{ id: followUpLead.id, name: followUpLead.name }]
            : []
        }
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

      <DeleteLeadDialog
        lead={deleteTarget}
        saving={saving}
        onCancel={() => {
          if (!saving) setDeleteTarget(null);
        }}
        onDelete={async () => {
          if (deleteTarget) await removeLead(deleteTarget);
        }}
      />

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
