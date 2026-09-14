"use client";

import { useCallback, useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { changeLeadStatus, createLead, deleteLead, getLead, updateLead } from "@/app/actions/leads";
import { createFollowUp } from "@/app/actions/follow-ups";
import { LeadDetailPanel } from "@/features/leads/lead-detail-panel";
import { LeadForm } from "@/features/leads/lead-form";
import type { Lead, LeadStatus } from "@/features/leads/types";
import { PipelineCard } from "./pipeline-card";
import { PipelineSummary } from "./pipeline-summary";
import { PipelineColumnHeader, PipelineEmptyState } from "./pipeline-column";
import { PipelineMobileView } from "./pipeline-mobile-view";
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

export function PipelineBoard({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (!result.destination) return;

    const sourceStatus = result.source.droppableId as LeadStatus;
    const destStatus = result.destination.droppableId as LeadStatus;

    if (sourceStatus === destStatus && result.source.index === result.destination.index) {
      return;
    }

    const draggedLeadId = result.draggableId;
    const draggedLead = leads.find((l) => l.id === draggedLeadId);

    if (!draggedLead) return;
    if (draggedLead.status === destStatus) return; 

    // Optimistic UI update
    setLeads((prev) =>
      prev.map((l) => (l.id === draggedLeadId ? { ...l, status: destStatus } : l))
    );
    setError(null);

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
    }
  }, [leads, replaceLead]);

  const handleSelectLead = async (lead: Lead) => {
    setSelectedLead(lead);
    const result = await getLead(lead.id);
    if (result.success) setSelectedLead(result.data);
    else setError(result.error);
  };

  const handleStatusChange = async (nextStatus: LeadStatus) => {
    if (!selectedLead || nextStatus === selectedLead.status) return;
    setSaving(true);
    const result = await changeLeadStatus(selectedLead.id, nextStatus);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    replaceLead(result.data);
    setError(null);
  };

  const handleRemoveLead = async () => {
    if (!selectedLead || !window.confirm(`Delete ${selectedLead.name}? This cannot be undone.`)) return;
    setSaving(true);
    const result = await deleteLead(selectedLead.id);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setLeads((current) => current.filter((l) => l.id !== result.data.id));
    setSelectedLead(null);
    setError(null);
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
    formData.append("leadId", data.leadId);
    formData.append("scheduledAt", data.scheduledAt);
    formData.append("type", data.type);
    formData.append("note", data.note);
    const result = await createFollowUp(formData);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    const nextDate = new Date(result.data.scheduledAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    setLeads((current) => current.map((lead) => lead.id === data.leadId && (!lead.nextFollowUpDate || nextDate < lead.nextFollowUpDate) ? { ...lead, nextFollowUpDate: nextDate } : lead));
    setSelectedLead((current) => current?.id === data.leadId && (!current.nextFollowUpDate || nextDate < current.nextFollowUpDate) ? { ...current, nextFollowUpDate: nextDate } : current);
    if (selectedLead?.id === data.leadId) await refreshActivities();
    setFollowUpLead(null);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden pb-4">
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800 shadow-sm border border-red-200 flex justify-between">
          {error}
          <button type="button" onClick={() => setError(null)} className="font-semibold hover:opacity-70">
            Dismiss
          </button>
        </div>
      )}

      {/* Summary Stats (Agent B UI) */}
      <div className="mb-6 shrink-0">
        <PipelineSummary leads={leads} grouped={grouped} />
      </div>

      {/* Mobile View (Agent B UI) */}
      <div className="flex-1 min-h-0 lg:hidden">
        <PipelineMobileView leads={leads} grouped={grouped} onSelectLead={handleSelectLead} />
      </div>

      {/* Kanban Board (Agent A UI for Desktop) */}
      <div className="hidden lg:flex flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex h-full min-w-max gap-4 items-start pb-4">
            {COLUMNS.map((status) => (
              <div key={status} className="flex h-full w-80 shrink-0 flex-col rounded-xl bg-slate-50 border border-slate-200 overflow-hidden">
                <PipelineColumnHeader status={status} count={grouped[status].length} />

                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto p-3 custom-scrollbar transition-colors ${
                        snapshot.isDraggingOver ? "bg-slate-100" : ""
                      }`}
                    >
                      <div className="flex flex-col gap-3 min-h-[100px]">
                        {grouped[status].map((lead, index) => (
                          <Draggable key={lead.id} draggableId={lead.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={provided.draggableProps.style}
                                className={snapshot.isDragging ? "z-50" : ""}
                              >
                                <PipelineCard
                                  lead={lead}
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
        </DragDropContext>
      </div>

      <LeadDetailPanel
        lead={selectedLead}
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
        onDelete={handleRemoveLead}
        activities={activities}
        activityFilter={activityFilter}
        onActivityFilterChange={setActivityFilter}
        onAddNote={handleAddNote}
        onAddFollowUp={selectedLead ? () => setFollowUpLead(selectedLead) : undefined}
        onEditNote={handleEditNote}
        onDeleteNote={handleDeleteNote}
      />

      <FollowUpForm isOpen={Boolean(followUpLead)} defaultLeadId={followUpLead?.id} leads={followUpLead ? [{ id: followUpLead.id, name: followUpLead.name }] : []} saving={saving} onClose={() => { if (!saving) setFollowUpLead(null); }} onSubmit={handleAddFollowUp} />
      
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
        onSubmit={handleSaveLead} 
      />
    </div>
  );
}
