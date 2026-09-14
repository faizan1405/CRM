"use client";

import { Plus, SearchX, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { LeadCard } from "@/features/leads/lead-card";
import { LeadDetailPanel } from "@/features/leads/lead-detail-panel";
import { LeadFilters } from "@/features/leads/lead-filters";
import { LeadForm } from "@/features/leads/lead-form";
import { LeadTable } from "@/features/leads/lead-table";
import { mockLeads } from "@/features/leads/mock-leads";
import type { Lead, LeadStatus, NewLeadInput } from "@/features/leads/types";

export function LeadsWorkspace() {
  const [leads, setLeads] = useState<Lead[]>(mockLeads);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeadStatus | "All">("All");
  const [source, setSource] = useState("All");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const sources = useMemo(() => Array.from(new Set(leads.map((lead) => lead.source).filter(Boolean))).sort(), [leads]);
  const filteredLeads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const searchable = [lead.name, lead.business, lead.phone, lead.email].join(" ").toLowerCase();
      return (!needle || searchable.includes(needle)) && (status === "All" || lead.status === status) && (source === "All" || lead.source === source);
    });
  }, [leads, query, source, status]);

  function addLead(input: NewLeadInput) {
    const today = new Date().toISOString().slice(0, 10);
    const lead: Lead = {
      id: `local-${Date.now()}`,
      ...input,
      quotedAmount: null,
      lastContactDate: null,
      nextFollowUpDate: null,
      notes: "",
      createdAt: today,
    };
    setLeads((current) => [lead, ...current]);
    setFormOpen(false);
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
        actions={<button type="button" onClick={() => setFormOpen(true)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 sm:w-auto"><Plus aria-hidden="true" size={18} /> Add Lead</button>}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
        <p className="text-sm font-medium text-blue-900"><span className="font-semibold">Demo mode:</span> changes reset when the page reloads.</p>
        <p className="text-sm font-semibold text-blue-800">{leads.length} temporary {leads.length === 1 ? "lead" : "leads"}</p>
      </div>

      <LeadFilters query={query} status={status} source={source} sources={sources} onQueryChange={setQuery} onStatusChange={setStatus} onSourceChange={setSource} onClear={clearFilters} />

      <section aria-label="Lead list" className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5 sm:px-5">
          <p className="text-sm font-semibold text-slate-900">{filteredLeads.length} {filteredLeads.length === 1 ? "lead" : "leads"}</p>
          <p className="text-xs font-medium text-slate-500">Temporary presentation data</p>
        </div>
        {leads.length === 0 ? (
          <div className="p-4 sm:p-6"><EmptyState title="No leads yet" description="Add your first lead to begin building the pipeline." icon={UsersRound} /></div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-4 sm:p-6"><EmptyState title="No leads match your filters." description="Try changing your search or clearing the filters." icon={SearchX} /></div>
        ) : (
          <>
            <LeadTable leads={filteredLeads} onSelect={setSelectedLead} />
            <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:hidden">{filteredLeads.map((lead) => <LeadCard key={lead.id} lead={lead} onSelect={setSelectedLead} />)}</div>
          </>
        )}
      </section>

      <LeadForm open={formOpen} onClose={() => setFormOpen(false)} onSubmit={addLead} />
      <LeadDetailPanel lead={selectedLead} onClose={() => setSelectedLead(null)} />
    </div>
  );
}
