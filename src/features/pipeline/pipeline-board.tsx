"use client";


import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { statusFromDatabase, type DatabaseLeadStatus } from "@/features/leads/types";
import { useCallback, useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult, DragStart } from "@hello-pangea/dnd";
import { changeLeadStatus, createLead, deleteLead, getLead, updateLead } from "@/app/actions/leads";
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
    <div className="flex flex-col lg:flex-row items-start lg:items-stretch gap-4 sm:gap-6 w-full">
      <div className="shrink-0 flex items-center self-center lg:self-auto">
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
  const [activeMobileStage, setActiveMobileStage] = useState<LeadStatus>(requestedStage || "New");
  const stageRef = useRef<HTMLDivElement>(null);
  const stageTabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (requestedStage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveMobileStage(requestedStage);
      stageRef.current?.querySelector(`[data-stage="${requestedStage}"]`)?.scrollIntoView({ block: "nearest", inline: "start" });
      stageTabsRef.current?.querySelector(`[data-stage="${requestedStage}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [requestedStage]);
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [isDraggingLead, setIsDraggingLead] = useState(false);
  const [draggedLeadStatus, setDraggedLeadStatus] = useState<LeadStatus | null>(null);

  const onDragStart = useCallback((start: DragStart) => {
    setIsDraggingLead(true);
    const lead = leads.find((l) => l.id === start.draggableId);
    if (lead) {
      setDraggedLeadStatus(lead.status);
    }
  }, [leads]);

  // Smooth edge auto-scroll on mobile stage pill tabs while dragging near edges
  useEffect(() => {
    if (!isDraggingLead) return;

    let animationFrameId: number | null = null;
    let scrollSpeed = 0;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!stageTabsRef.current) return;
      const clientX = "touches" in e && e.touches.length > 0 ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e && e.touches.length > 0 ? e.touches[0].clientY : (e as MouseEvent).clientY;

      const rect = stageTabsRef.current.getBoundingClientRect();
      if (clientY >= rect.top - 30 && clientY <= rect.bottom + 60) {
        const edgeThreshold = 55;
        if (clientX < rect.left + edgeThreshold) {
          const intensity = Math.max(0.2, (rect.left + edgeThreshold - clientX) / edgeThreshold);
          scrollSpeed = -Math.round(intensity * 10);
        } else if (clientX > rect.right - edgeThreshold) {
          const intensity = Math.max(0.2, (clientX - (rect.right - edgeThreshold)) / edgeThreshold);
          scrollSpeed = Math.round(intensity * 10);
        } else {
          scrollSpeed = 0;
        }
      } else {
        scrollSpeed = 0;
      }

      if (scrollSpeed !== 0 && animationFrameId === null) {
        const step = () => {
          if (stageTabsRef.current && scrollSpeed !== 0) {
            stageTabsRef.current.scrollLeft += scrollSpeed;
            animationFrameId = requestAnimationFrame(step);
          } else {
            animationFrameId = null;
          }
        };
        animationFrameId = requestAnimationFrame(step);
      }
    };

    const handlePointerUp = () => {
      scrollSpeed = 0;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("touchmove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    window.addEventListener("touchend", handlePointerUp, { passive: true });

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("touchend", handlePointerUp);
    };
  }, [isDraggingLead]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);
  const [lostReasonLead, setLostReasonLead] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

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

  const replaceLead = useCallback((updatedLead: Lead) => {
    setLeads((current) => current.map((l) => (l.id === updatedLead.id ? updatedLead : l)));
    setSelectedLead((current) => (current?.id === updatedLead.id ? updatedLead : current));
  }, []);

  const onDragEnd = useCallback(async (result: DropResult) => {
    setIsDraggingLead(false);
    setDraggedLeadStatus(null);

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
    setActiveMobileStage(destStatus);
    setError(null);

    // Smoothly scroll the stage tabs and column to the destination stage
    setTimeout(() => {
      stageTabsRef.current?.querySelector(`[data-stage="${destStatus}"]`)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
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
      setActiveMobileStage(sourceStatus);
      setError(res.error || "Failed to update lead status");
    } else {
      replaceLead(res.data);
      if (destStatus !== "Won") {
        showToast(`Status changed to ${destStatus}`, "success", {
          label: "Undo",
          onClick: async () => {
            const undoRes = await changeLeadStatus(draggedLeadId, sourceStatus);
            if (undoRes.success) {
              replaceLead(undoRes.data);
              setActiveMobileStage(sourceStatus);
              showToast("Status restored", "info");
            }
          }
        });
      } else {
        showToast(`Lead marked as ${destStatus}`, "success");
      }
    }
  }, [leads, replaceLead, showToast]);

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
    const oldStatus = selectedLead.status;
    const result = await changeLeadStatus(selectedLead.id, nextStatus);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    replaceLead(result.data);
    await refreshActivities();
    if (nextStatus !== "Won") {
      showToast(`Status changed to ${nextStatus}`, "success", {
        label: "Undo",
        onClick: async () => {
          const undoRes = await changeLeadStatus(selectedLead.id, oldStatus);
          if (undoRes.success) {
            replaceLead(undoRes.data);
            await refreshActivities();
            showToast("Status restored", "info");
          }
        }
      });
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
    setActiveMobileStage("Lost");
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
    } catch { setError("Could not delete this lead. Please retry."); }
    finally { setSaving(false); }
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
  };

  const handleAddFollowUp = async (data: NewFollowUpInput) => {
    setSaving(true);
    setError(null);
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
    showToast(isRescheduled ? "Follow-up rescheduled" : "Follow-up scheduled", "success", {
      label: "Undo",
      onClick: async () => {
        const undoRes = await import("@/app/actions/follow-ups").then(m => m.undoCreateFollowUp(result.data.id));
        if (undoRes.success) {
          showToast("Follow-up action undone", "info");
          await refreshActivities();
        }
      }
    });
  };

  return (
    <div className="flex flex-col min-w-0 pb-4 lg:h-[min(75dvh,52rem)] lg:min-h-[36rem] lg:overflow-hidden">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800 shadow-sm border border-red-200 flex justify-between">
          {error}
          <button type="button" onClick={() => setError(null)} className="font-semibold hover:opacity-70">
            Dismiss
          </button>
        </div>
      )}

      {/* Mobile Analytics (Collapsible Accordion) */}
      <details className="mb-4 sm:hidden shrink-0 group rounded-xl border border-[var(--border)] bg-white overflow-hidden [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-semibold text-slate-900 select-none hover:bg-slate-50 active:bg-slate-100">
          <div className="flex items-center gap-2">
            Pipeline Analytics
          </div>
          <svg className="h-5 w-5 text-slate-400 transition-transform group-open:-rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </summary>
        <div className="p-4 border-t border-slate-100 hidden group-open:flex">
          <PipelineAnalyticsSection leads={leads} grouped={grouped} />
        </div>
      </details>

      {/* Desktop Analytics (Always Visible Above Kanban Board) */}
      <div className="mb-6 hidden sm:flex shrink-0 rounded-xl border border-[var(--border)] bg-white p-4 sm:p-5">
        <PipelineAnalyticsSection leads={leads} grouped={grouped} />
      </div>

      <p className="mb-2 text-xs text-slate-500 hidden sm:block">Drag the grip toward either board edge to reach more stages. You can also change Status in lead details.</p>
      
      {/* DragDropContext wraps both Mobile Stage Tabs and Board Columns */}
      <DragDropContext onDragEnd={onDragEnd} onDragStart={onDragStart}>
        {/* Mobile Stage Tabs Droppable Row */}
        <div 
          ref={stageTabsRef}
          data-testid="mobile-stage-tabs"
          className="sticky top-14 z-20 flex sm:hidden overflow-x-auto overscroll-x-contain touch-pan-x hide-scrollbar gap-2 py-2 px-4 -mx-4 mb-2 bg-[#f5f7fb]/95 backdrop-blur-sm border-b border-slate-200/80"
          role="tablist"
          aria-label="Pipeline stages"
        >
          {COLUMNS.map((status) => (
            <Droppable droppableId={`stage-pill-${status}`} key={`pill-${status}`}>
              {(provided, snapshot) => {
                const isCurrent = activeMobileStage === status;
                const isOver = snapshot.isDraggingOver;
                const isSource = isDraggingLead && draggedLeadStatus === status;
                const isTargetAvailable = isDraggingLead && !isSource;

                return (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    data-stage-pill={status}
                    className="shrink-0 flex items-center"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={isCurrent}
                      data-stage={status}
                      onClick={(e) => {
                        setActiveMobileStage(status);
                        e.currentTarget.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                      }}
                      className={`shrink-0 rounded-full border px-4 py-2 text-[13px] font-semibold transition-all duration-150 select-none ${
                        isOver
                          ? "bg-blue-600 text-white border-blue-600 ring-2 ring-blue-400 ring-offset-2 scale-105 shadow-md"
                          : isTargetAvailable
                          ? isCurrent
                            ? "bg-slate-800 text-white border-slate-800 ring-1 ring-blue-400"
                            : "bg-blue-50/90 border-blue-400 border-dashed text-blue-800 hover:bg-blue-100"
                          : isCurrent
                          ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                      }`}
                    >
                      {status}{" "}
                      <span
                        className={`ml-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full transition-colors ${
                          isOver
                            ? "bg-white text-blue-700"
                            : isCurrent
                            ? "bg-slate-700 text-white"
                            : isTargetAvailable
                            ? "bg-blue-100 text-blue-800"
                            : "text-slate-400 bg-slate-100"
                        }`}
                      >
                        {grouped[status].length}
                      </span>
                    </button>
                    <span className="hidden" aria-hidden="true">
                      {provided.placeholder}
                    </span>
                  </div>
                );
              }}
            </Droppable>
          ))}
        </div>

        {/* Every droppable shares one scroll parent; nested scroll parents disable DnD auto-scroll. */}
        <div ref={stageRef} aria-label="Pipeline stages" className="min-h-0 min-w-0 flex-1 overflow-x-auto overscroll-contain custom-scrollbar sm:snap-x sm:snap-mandatory" style={{ scrollBehavior: "auto" }}>
          <div className="flex min-h-full w-full lg:w-auto lg:min-w-max items-stretch gap-4 pb-4 px-4 sm:px-0">
            {COLUMNS.map((status) => (
              <div key={status} data-stage={status} className={`w-[calc(100vw-2rem)] sm:w-[18rem] lg:w-80 shrink-0 flex-col rounded-xl border border-slate-200 bg-slate-50 snap-center ${activeMobileStage === status ? "flex" : "hidden sm:flex"}`}>
                <PipelineColumnHeader status={status} count={grouped[status].length} />

                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-40 flex-1 rounded-b-xl p-3 transition-colors duration-150 ${
                        snapshot.isDraggingOver ? "bg-blue-50 ring-2 ring-inset ring-blue-400" : ""
                      }`}
                    >
                      <div className="flex flex-col gap-3 min-h-[100px]">
                        {grouped[status].map((lead, index) => (
                          <Draggable key={lead.id} draggableId={lead.id} index={index} disableInteractiveElementBlocking>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                style={provided.draggableProps.style}
                                className={snapshot.isDragging ? "z-50" : ""}
                              >
                                <PipelineCard
                                  lead={lead}
                                  dragHandleProps={provided.dragHandleProps}
                                  onClick={() => handleSelectLead(lead)}
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
            ))}
          </div>
        </div>
      </DragDropContext>

      {selectedLead && <LeadDetailPanel key={selectedLead.id}         lead={selectedLead}
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
        activities={activities}
        activityFilter={activityFilter}
        onActivityFilterChange={setActivityFilter}
        onAddNote={handleAddNote}
        onRefreshActivities={refreshActivities}
        onAddFollowUp={selectedLead ? () => setFollowUpLead(selectedLead) : undefined}
        onEditNote={handleEditNote}
        onDeleteNote={handleDeleteNote}
      />}

      <FollowUpForm isOpen={Boolean(followUpLead)} followUp={followUpLead?.activeFollowUp} defaultLeadId={followUpLead?.id} leads={followUpLead ? [{ id: followUpLead.id, name: followUpLead.name }] : []} saving={saving} onClose={() => { if (!saving) setFollowUpLead(null); }} onSubmit={handleAddFollowUp} />
      
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
