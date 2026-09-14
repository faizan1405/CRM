"use client";

import { Plus, SearchX, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { changeLeadStatus, createLead, deleteLead, getLead, updateLead } from "@/app/actions/leads";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { LeadCard } from "@/features/leads/lead-card";
import { LeadDetailPanel } from "@/features/leads/lead-detail-panel";
import { LeadFilters } from "@/features/leads/lead-filters";
import { LeadForm } from "@/features/leads/lead-form";
import { LeadTable } from "@/features/leads/lead-table";
import type { Lead, LeadStatus } from "@/features/leads/types";
import { useLeadActivities } from "@/features/activity/use-activities";

type Feedback = { tone: "success" | "error"; message: string } | null;

export function LeadsWorkspace({ initialLeads, initialError }: { initialLeads: Lead[]; initialError: string | null }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeadStatus | "All">("All");
  const [source, setSource] = useState("All");
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(initialError ? { tone: "error", message: initialError } : null);

  const {
    activities,
    filter: activityFilter,
    setFilter: setActivityFilter,
    handleAddNote,
    handleEditNote,
    handleDeleteNote,
  } = useLeadActivities(selectedLead?.id);

  const sources = useMemo(() => Array.from(new Set(leads.map((lead) => lead.source).filter(Boolean))).sort(), [leads]);
  const filteredLeads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const searchable = [lead.name, lead.business, lead.phone, lead.email].join(" ").toLowerCase();
      return (!needle || searchable.includes(needle)) && (status === "All" || lead.status === status) && (source === "All" || lead.source === source);
    });
  }, [leads, query, source, status]);

  function replaceLead(updatedLead: Lead) {
    setLeads((current) => current.map((lead) => lead.id === updatedLead.id ? updatedLead : lead));
    setSelectedLead((current) => current?.id === updatedLead.id ? updatedLead : current);
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

  async function selectLead(lead: Lead) {
    setSelectedLead(lead);
    const result = await getLead(lead.id);
    if (result.success) setSelectedLead(result.data);
    else setFeedback({ tone: "error", message: result.error });
  }

  async function setLeadStatus(nextStatus: LeadStatus) {
    if (!selectedLead || nextStatus === selectedLead.status) return;
    setSaving(true);
    const result = await changeLeadStatus(selectedLead.id, nextStatus);
    setSaving(false);
    if (!result.success) return setFeedback({ tone: "error", message: result.error });
    replaceLead(result.data);
    setFeedback({ tone: "success", message: "Lead status updated." });
  }

  async function removeLead() {
    if (!selectedLead || !window.confirm(`Delete ${selectedLead.name}? This cannot be undone.`)) return;
    setSaving(true);
    const result = await deleteLead(selectedLead.id);
    setSaving(false);
    if (!result.success) return setFeedback({ tone: "error", message: result.error });
    setLeads((current) => current.filter((lead) => lead.id !== result.data.id));
    setSelectedLead(null);
    setFeedback({ tone: "success", message: "Lead deleted." });
  }

  function clearFilters() {
    setQuery("");
    setStatus("All");
    setSource("All");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Review prospects, priorities and next steps."
        actions={<button type="button" onClick={() => { setEditingLead(null); setFormOpen(true); }} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 sm:w-auto"><Plus aria-hidden="true" size={18} /> Add Lead</button>}
      />

      {feedback && <div role={feedback.tone === "error" ? "alert" : "status"} className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm font-medium ${feedback.tone === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}><span>{feedback.message}</span><button type="button" onClick={() => setFeedback(null)} className="shrink-0 font-semibold">Dismiss</button></div>}

      <LeadFilters query={query} status={status} source={source} sources={sources} onQueryChange={setQuery} onStatusChange={setStatus} onSourceChange={setSource} onClear={clearFilters} />

      <section aria-label="Lead list" className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5 sm:px-5"><p className="text-sm font-semibold text-slate-900">{filteredLeads.length} {filteredLeads.length === 1 ? "lead" : "leads"}</p><p className="text-xs font-medium text-slate-500">Saved CRM records</p></div>
        {leads.length === 0 ? (
          <div className="p-4 sm:p-6"><EmptyState title="No leads yet" description="Add your first lead to begin building the pipeline." icon={UsersRound} /></div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-4 sm:p-6"><EmptyState title="No leads match your filters." description="Try changing your search or clearing the filters." icon={SearchX} /></div>
        ) : (
          <><LeadTable leads={filteredLeads} onSelect={selectLead} /><div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:hidden">{filteredLeads.map((lead) => <LeadCard key={lead.id} lead={lead} onSelect={selectLead} />)}</div></>
        )}
      </section>

      <LeadForm open={formOpen} lead={editingLead} saving={saving} onClose={() => { if (!saving) { setFormOpen(false); setEditingLead(null); } }} onSubmit={saveLead} />
      <LeadDetailPanel 
        lead={selectedLead} 
        saving={saving} 
        onClose={() => setSelectedLead(null)} 
        onEdit={() => { if (selectedLead) { setEditingLead(selectedLead); setSelectedLead(null); setFormOpen(true); } }} 
        onStatusChange={setLeadStatus} 
        onDelete={removeLead}
        activities={activities}
        activityFilter={activityFilter}
        onActivityFilterChange={setActivityFilter}
        onAddNote={handleAddNote}
        onEditNote={handleEditNote}
        onDeleteNote={handleDeleteNote}
      />
    </div>
  );
}
