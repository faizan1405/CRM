"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { statusFromDatabase, type DatabaseLeadStatus } from "@/features/leads/types";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { changeLeadStatus, createLead, deleteLead, getLead, togglePinLead, updateLead } from "@/app/actions/leads";
import { scheduleLeadFollowUp } from "@/app/actions/follow-ups";
import { useToast } from "@/components/toast-provider";
import dynamic from "next/dynamic";
const LeadDetailPanel = dynamic(() => import("@/features/leads/lead-detail-panel").then(m => m.LeadDetailPanel));
const LeadForm = dynamic(() => import("@/features/leads/lead-form").then(m => m.LeadForm));
import type { Lead, LeadStatus } from "@/features/leads/types";
import { DeleteLeadDialog } from "@/features/leads/delete-lead-dialog";
import { PipelineCard } from "./pipeline-card";
import { PipelineSummary } from "./pipeline-summary";
import { PipelineConversion } from "./pipeline-conversion";
import { PipelineDonutGraph } from "./pipeline-donut-graph";
import { PipelineColumnHeader, PipelineEmptyState } from "./pipeline-column";
import { LostReasonDialog } from "@/features/lost-reasons/lost-reason-dialog";
import type { LostReasonSubmission } from "@/features/lost-reasons/types";
import { useLeadActivities } from "@/features/activity/use-activities";
import { FollowUpForm } from "@/features/followups/follow-up-form";
import type { NewFollowUpInput } from "@/features/followups/types";
import { getFollowUpSuggestion, type FollowUpSuggestion } from "@/lib/follow-up-suggestions";
import { inrCompact } from "@/lib/crm/format";
import { formatCurrency } from "@/features/leads/formatters";
import { ChevronLeft, ChevronRight, ChevronDown, PieChart } from "lucide-react";

const COLUMNS: LeadStatus[] = [
  "New",
  "Contacted",
  "Qualified",
  "Proposal Sent",
  "Won",
  "Lost",
];

function PipelineAnalyticsSection({
  leads,
  grouped,
}: {
  leads: Lead[];
  grouped: Record<LeadStatus, Lead[]>;
}) {
  return (
    <div className="flex flex-col xl:flex-row items-start xl:items-center gap-6 w-full">
      <div className="shrink-0 flex items-center self-center xl:self-auto">
        <PipelineDonutGraph leads={leads} grouped={grouped} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-hidden w-full">
        <PipelineSummary leads={leads} grouped={grouped} />
        <PipelineConversion leads={leads} grouped={grouped} />
      </div>
    </div>
  );
}

export function PipelineBoard({ initialLeads }: { initialLeads: Lead[] }) {
  const searchParams = useSearchParams();
  const requestedStage = statusFromDatabase[searchParams.get("stage") as DatabaseLeadStatus];
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (requestedStage) {
      stageRef.current?.querySelector(`[data-stage="${requestedStage}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    }
  }, [requestedStage]);

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

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);
  const [followUpSuggestion, setFollowUpSuggestion] = useState<FollowUpSuggestion | null>(null);
  const [lostReasonLead, setLostReasonLead] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showToast, showUndoToast } = useToast();

  const [scrollProgress, setScrollProgress] = useState({
    leftPercent: 0,
    widthPercent: 20,
    canScroll: true,
  });

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    let rafId: number | null = null;

    const updateIndicator = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      if (scrollWidth <= clientWidth || clientWidth === 0) {
        setScrollProgress({ leftPercent: 0, widthPercent: 100, canScroll: false });
        setCanScrollLeft(false);
        setCanScrollRight(false);
        return;
      }

      const visibleRatio = clientWidth / scrollWidth;
      const widthPercent = Math.max(16, Math.min(60, visibleRatio * 100));
      const maxScroll = scrollWidth - clientWidth;
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, scrollLeft / maxScroll)) : 0;
      const leftPercent = progress * (100 - widthPercent);

      setScrollProgress({
        leftPercent,
        widthPercent,
        canScroll: true,
      });

      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < maxScroll - 10);
    };

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        updateIndicator();
        rafId = null;
      });
    };

    updateIndicator();

    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateIndicator);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        updateIndicator();
      });
      ro.observe(el);
    }

    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateIndicator);
      if (rafId !== null) cancelAnimationFrame(rafId);
      ro?.disconnect();
    };
  }, [leads]);

  const scrollBoard = useCallback((direction: "left" | "right") => {
    const el = stageRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  }, []);

  const {
    activities,
    filter: activityFilter,
    setFilter: setActivityFilter,
    handleAddNote,
    handleEditNote,
    handleDeleteNote,
    refresh: refreshActivities,
  } = useLeadActivities(selectedLead?.id);

  const grouped = useMemo(() => {
    const map: Record<LeadStatus, Lead[]> = {
      New: [],
      Contacted: [],
      Qualified: [],
      "Proposal Sent": [],
      Won: [],
      Lost: [],
    };
    leads.forEach((lead) => {
      if (map[lead.status]) {
        map[lead.status].push(lead);
      }
    });
    return map;
  }, [leads]);

  const openValue = useMemo(() => {
    return leads
      .filter((l) => l.status !== "Won" && l.status !== "Lost")
      .reduce((sum, l) => sum + (l.quotedAmount ?? l.budget ?? 0), 0);
  }, [leads]);

  const replaceLead = useCallback((updatedLead: Lead) => {
    setLeads((current) => current.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
    setSelectedLead((current) => (current?.id === updatedLead.id ? updatedLead : current));
  }, []);

  const onDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return;

    const sourceStatus = result.source.droppableId as LeadStatus;
    const destDroppableId = result.destination.droppableId;
    const destStatus = (
      destDroppableId.startsWith("stage-pill-")
        ? destDroppableId.replace("stage-pill-", "")
        : destDroppableId
    ) as LeadStatus;

    if (sourceStatus === destStatus && result.source.index === result.destination.index) {
      return;
    }

    const draggedLeadId = result.draggableId;
    const draggedLead = leads.find((l) => l.id === draggedLeadId);

    if (!draggedLead) return;
    if (draggedLead.status === destStatus) return; 

    if (destStatus === "Lost") {
      setLostReasonLead(draggedLead);
      return;
    }

    // Optimistic UI update
    setLeads((prev) =>
      prev.map((l) => (l.id === draggedLeadId ? { ...l, status: destStatus } : l))
    );
    setError(null);

    // Smoothly scroll the column to the destination stage
    setTimeout(() => {
      stageRef.current?.querySelector(`[data-stage="${destStatus}"]`)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "start",
      });
    }, 50);

    // Server request
    const res = await changeLeadStatus(draggedLeadId, destStatus);
    if (!res.success) {
      // Rollback
      setLeads((prev) =>
        prev.map((l) => (l.id === draggedLeadId ? { ...l, status: sourceStatus } : l))
      );
      setError(res.error || "Failed to update lead status");
    } else {
      replaceLead(res.data);
      if (destStatus === "Proposal Sent") {
        setFollowUpSuggestion(getFollowUpSuggestion("PROPOSAL_SENT"));
        setFollowUpLead(res.data);
      }
      if (res.undoId) {
        showUndoToast(`Status changed to ${destStatus}`, res.undoId);
      } else {
        showToast(`Status changed to ${destStatus}`, "success");
      }
    }
  }, [leads, replaceLead, showToast, showUndoToast]);

  const handleTogglePin = async (lead: Lead) => {
    const nextPinned = !lead.isPinned;
    const updatedLead: Lead = { ...lead, isPinned: nextPinned };
    replaceLead(updatedLead);
    try {
      const result = await togglePinLead(lead.id, nextPinned);
      if (!result.success) {
        replaceLead(lead);
        showToast(result.error, "error");
      } else {
        replaceLead(result.data);
        const msg = nextPinned ? "Lead pinned to shortlist" : "Lead removed from shortlist";
        if (result.undoId) {
          showUndoToast(msg, result.undoId);
        }
      }
    } catch {
      replaceLead(lead);
      showToast("Failed to update pin state.", "error");
    }
  };

  const handleSelectLead = async (lead: Lead) => {
    setSelectedLead(lead);
    const result = await getLead(lead.id);
    if (result.success) setSelectedLead(current => current?.id === lead.id ? result.data : current);
    else setError(result.error);
  };

  const handleStatusChange = async (nextStatus: LeadStatus) => {
    if (!selectedLead || nextStatus === selectedLead.status) return;
    if (nextStatus === "Lost") {
      setLostReasonLead(selectedLead);
      return;
    }
    setSaving(true);
    const result = await changeLeadStatus(selectedLead.id, nextStatus);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    replaceLead(result.data);
    await refreshActivities();
    if (nextStatus === "Proposal Sent") {
      setFollowUpSuggestion(getFollowUpSuggestion("PROPOSAL_SENT"));
      setFollowUpLead(result.data);
    }
    if (result.undoId) {
      showUndoToast(`Status changed to ${nextStatus}`, result.undoId);
    } else {
      showToast(`Status changed to ${nextStatus}`, "success");
    }
  };

  const handleLostConfirm = async (data: LostReasonSubmission) => {
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
      setError(result.error);
      return;
    }
    replaceLead(result.data);
    await refreshActivities();
    setLostReasonLead(null);
    stageRef.current?.querySelector('[data-stage="Lost"]')?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    });
    if (result.undoId) {
      showUndoToast("Lead marked as Lost", result.undoId);
    } else {
      showToast("Lead marked as Lost", "success");
    }
  };

  const handleRemoveLead = async () => {
    if (!deleteTarget || saving) return;
    setSaving(true);
    try {
      const result = await deleteLead(deleteTarget.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setLeads((current) => current.filter((l) => l.id !== result.data.id));
      setSelectedLead(null);
      setDeleteTarget(null);
      setError(null);
      if (result.undoId) {
        showUndoToast("Lead moved to Recently Deleted", result.undoId);
      }
    } catch {
      setError("Could not delete this lead. Please retry.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLead = async (formData: FormData) => {
    setSaving(true);
    setError(null);
    const result = editingLead ? await updateLead(editingLead.id, formData) : await createLead(formData);
    setSaving(false);
    
    if (!result.success) {
      setError(result.error);
      return;
    }
    
    if (editingLead) replaceLead(result.data);
    else setLeads((current) => [result.data, ...current]);
    
    setFormOpen(false);
    setEditingLead(null);
    const msg = editingLead ? "Lead details updated" : "Lead created successfully";
    if (result.undoId) {
      showUndoToast(msg, result.undoId);
    } else {
      showToast(msg, "success");
    }
  };

  const handleAddFollowUp = async (data: NewFollowUpInput & { mode?: "reschedule" | "create" }) => {
    setSaving(true);
    setError(null);
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
      setError(result.error);
      return;
    }
    const isRescheduled = Boolean(followUpLead?.activeFollowUp || data.id);
    const updatedLead = result.data.leadRecord;
    const nextDate = new Date(result.data.scheduledAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    setLeads((current) => current.map((lead) => lead.id === data.leadId ? (updatedLead || { ...lead, nextFollowUpDate: nextDate, activeFollowUp: result.data }) : lead));
    setSelectedLead((current) => current?.id === data.leadId ? (updatedLead || { ...current, nextFollowUpDate: nextDate, activeFollowUp: result.data }) : current);
    if (selectedLead?.id === data.leadId) await refreshActivities();
    setFollowUpLead(null);
    const msg = isRescheduled ? "Follow-up rescheduled" : "Follow-up scheduled";
    if (result.undoId) {
      showUndoToast(msg, result.undoId);
    } else {
      showToast(msg, "success");
    }
  };

  return (
    <div className="flex flex-col min-w-0 w-full pb-8 sm:pb-4">
      {/* Header bar matching Lovable aesthetic */}
      <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-semibold leading-tight sm:text-[26px] text-foreground">
            Sales Pipeline
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Open value <span className="font-medium text-foreground tabular">{formatCurrency(openValue)}</span> · drag cards between stages on desktop
          </p>
        </div>

        {/* Desktop Stage Navigation Controls */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => scrollBoard("left")}
            disabled={!canScrollLeft}
            aria-label="Scroll pipeline stages left"
            className="press flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground shadow-[var(--shadow-card)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Previous stages"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => scrollBoard("right")}
            disabled={!canScrollRight}
            aria-label="Scroll pipeline stages right"
            className="press flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground shadow-[var(--shadow-card)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            title="Next stages"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-xl bg-destructive/10 p-4 text-sm font-medium text-destructive border border-destructive/20 flex justify-between items-center shadow-sm">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-semibold hover:opacity-70 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Mobile Analytics (Collapsible Accordion) */}
      <details className="mb-4 sm:hidden shrink-0 group rounded-xl border border-border/80 bg-card overflow-hidden [&_summary::-webkit-details-marker]:hidden shadow-[var(--shadow-card)]">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-semibold text-foreground select-none hover:bg-muted/50 active:bg-muted transition-colors">
          <div className="flex items-center gap-2 text-[13px]">
            <PieChart className="h-4 w-4 text-primary" />
            Pipeline Analytics
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:-rotate-180" />
        </summary>
        <div className="p-4 border-t border-border/60 flex flex-col gap-4">
          <PipelineAnalyticsSection leads={leads} grouped={grouped} />
        </div>
      </details>

      {/* Desktop Analytics (Integrated Card Above Kanban Board) */}
      <div className="mb-6 hidden sm:flex shrink-0 rounded-2xl border border-border/80 bg-card p-5 shadow-[var(--shadow-card)]">
        <PipelineAnalyticsSection leads={leads} grouped={grouped} />
      </div>

      {/* DragDropContext wraps Board Columns */}
      <DragDropContext onDragEnd={onDragEnd}>
        {/* Horizontal scroll container displaying 3 columns on desktop, 2 on medium, 1 on mobile */}
        <div
          ref={stageRef}
          aria-label="Pipeline stages"
          className="w-full min-h-0 min-w-0 flex-1 overflow-x-auto overscroll-x-contain touch-pan-x touch-pan-y custom-scrollbar sm:snap-x lg:snap-none"
          style={{ touchAction: "pan-x pan-y", WebkitOverflowScrolling: "touch" }}
        >
          <div className="flex min-h-full w-max min-w-full items-stretch gap-4 pb-6 sm:pb-4 px-4 sm:px-0">
            {COLUMNS.map((status) => {
              const stageValueSum = grouped[status].reduce((acc, l) => acc + (l.quotedAmount ?? l.budget ?? 0), 0);
              const stageValueStr = stageValueSum > 0 ? inrCompact(stageValueSum) : undefined;
              return (
              <div
                key={status}
                data-stage={status}
                className="w-[85vw] max-w-[340px] sm:max-w-none sm:w-[calc((100%-1rem)/2)] xl:w-[calc((100%-2rem)/3)] shrink-0 flex flex-col rounded-[16px] border border-border/70 bg-muted/40 p-2 sm:snap-center transition-all duration-200"
              >
                <PipelineColumnHeader status={status} count={grouped[status].length} totalValue={stageValueStr} />

                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[180px] flex-1 rounded-b-xl p-1 transition-colors duration-200 ${
                        snapshot.isDraggingOver ? "bg-primary/5 ring-2 ring-inset ring-primary/40 rounded-xl" : ""
                      }`}
                    >
                      <div className="flex flex-col gap-2.5 min-h-[100px]">
                        {grouped[status].map((lead, index) => (
                          <Draggable key={lead.id} draggableId={lead.id} index={index} disableInteractiveElementBlocking>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                style={provided.draggableProps.style}
                                className={snapshot.isDragging ? "z-50 shadow-2xl scale-[1.02]" : ""}
                              >
                                <PipelineCard
                                  lead={lead}
                                  dragHandleProps={provided.dragHandleProps}
                                  onClick={() => handleSelectLead(lead)}
                                  onTogglePin={handleTogglePin}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {grouped[status].length === 0 && (
                          <PipelineEmptyState status={status} />
                        )}
                      </div>
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
          </div>
        </div>
      </DragDropContext>

      {/* Custom Mobile Horizontal Scroll Indicator */}
      {scrollProgress.canScroll && (
        <div
          data-testid="pipeline-mobile-scroll-indicator"
          aria-hidden="true"
          className="sm:hidden mt-3 mb-1 px-4 flex flex-col items-center justify-center gap-1.5 w-full select-none shrink-0"
        >
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = Math.max(0, Math.min(1, clickX / rect.width));
              const el = stageRef.current;
              if (el) {
                el.scrollTo({
                  left: ratio * (el.scrollWidth - el.clientWidth),
                  behavior: "smooth",
                });
              }
            }}
            className="relative w-36 h-1 bg-border rounded-full overflow-hidden cursor-pointer"
          >
            <div
              data-testid="pipeline-mobile-scroll-thumb"
              className="absolute top-0 bottom-0 bg-primary rounded-full transition-all duration-75"
              style={{
                width: `${scrollProgress.widthPercent}%`,
                left: `${scrollProgress.leftPercent}%`,
              }}
            />
          </div>
          <span className="text-[10px] font-medium text-muted-foreground">
            Swipe stages horizontally
          </span>
        </div>
      )}

      {selectedLead && <LeadDetailPanel key={selectedLead.id} lead={selectedLead}
        saving={saving}
        onClose={() => setSelectedLead(null)}
        onEdit={() => {
          if (selectedLead) {
            setEditingLead(selectedLead);
            setSelectedLead(null);
            setFormOpen(true);
          }
        }}
        onStatusChange={handleStatusChange}
        onDelete={async () => setDeleteTarget(selectedLead)}
        onLeadUpdated={replaceLead}
        activities={activities}
        activityFilter={activityFilter}
        onActivityFilterChange={setActivityFilter}
        onAddNote={handleAddNote}
        onRefreshActivities={refreshActivities}
        onAddFollowUp={selectedLead ? () => setFollowUpLead(selectedLead) : undefined}
        onEditNote={handleEditNote}
        onDeleteNote={handleDeleteNote}
        onTogglePin={() => handleTogglePin(selectedLead)}
        onOpenLead={async (targetId) => {
          const found = leads.find((l) => l.id === targetId);
          if (found) {
            setSelectedLead(found);
          } else {
            const res = await getLead(targetId);
            if (res.success) {
              setSelectedLead(res.data);
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
        onSubmit={handleAddFollowUp}
      />
      
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
        onSubmit={handleSaveLead} 
        onOpenDuplicate={(candidate) => {
          const found = leads.find((l) => l.id === candidate.id);
          setFormOpen(false);
          setEditingLead(null);
          if (found) {
            setSelectedLead(found);
          }
        }}
        onLeadEnriched={(enrichedLead) => {
          replaceLead(enrichedLead);
          setFormOpen(false);
          setEditingLead(null);
          setSelectedLead(enrichedLead);
          showToast(`Updated existing lead ${enrichedLead.name}`, "success");
        }}
      />}

      <DeleteLeadDialog lead={deleteTarget} saving={saving} onCancel={() => { if (!saving) setDeleteTarget(null); }} onDelete={handleRemoveLead} />
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
