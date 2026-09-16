"use client";

import { useDialogAccessibility } from "@/components/use-dialog-accessibility";

import dynamic from "next/dynamic";
import { Pencil, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatCurrency, formatDate } from "@/features/leads/formatters";
import { LeadStatusBadge } from "@/features/leads/lead-status-badge";
import { OperationalStateBadge } from "@/features/leads/operational-state-badge";
import { leadStatuses, type Lead, type LeadStatus } from "@/features/leads/types";
import { LeadActivityTimeline } from "@/features/activity/lead-activity-timeline";
import type { Activity, ActivityFilter } from "@/features/activity/types";
import { NoteComposer } from "@/features/activity/note-composer";
import { LeadQuickActions } from "@/features/leads/lead-quick-actions";
import {
  LeadDetailAIInsights,
  deriveAIAttention,
  type AIAttentionLeadData,
} from "@/features/ai-attention";
import { getLeadLossHistory } from "@/app/actions/lost-reasons";
import { LostLeadDetail } from "@/features/lost-reasons/lost-lead-detail";
import type { LeadLossRecord } from "@/features/lost-reasons/types";
const AIConversationNotes = dynamic(() => import("@/features/ai-conversation-notes/ai-conversation-notes").then(m => m.AIConversationNotes));
import { structureCallNotes, applyCallNotes } from "@/app/actions/conversation-notes";
import { createFollowUp } from "@/app/actions/follow-ups";
import { getWhatsAppTemplates } from "@/app/actions/whatsapp-templates";
const WhatsAppLeadComposer = dynamic(() => import("@/features/whatsapp-templates/components/whatsapp-lead-composer").then(m => m.WhatsAppLeadComposer));
import type { WhatsAppTemplate } from "@/features/whatsapp-templates/types";
import { FileText, Sparkles } from "lucide-react";

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1.5 break-words text-sm font-medium text-slate-800">{value || "Not added"}</dd>
    </div>
  );
}

type LeadDetailPanelProps = {
  lead: Lead | null;
  saving: boolean;
  onClose: () => void;
  onEdit: () => void;
  onStatusChange: (status: LeadStatus) => Promise<void>;
  onDelete: () => Promise<void>;
  /** Phase 5: Activity timeline integration */
  activities?: Activity[];
  activityFilter?: ActivityFilter;
  onActivityFilterChange?: (filter: ActivityFilter) => void;
  onAddNote?: (text: string) => Promise<{ success: boolean; error?: string }>;
  onRefreshActivities?: () => void;
  onAddFollowUp?: () => void;
  initialAction?: "note" | "status" | "activity" | "followups" | null;
  whatsAppMessage?: string;
  onEditNote?: (data: { id: string; noteId: string; noteText: string }) => void;
  onDeleteNote?: (data: { id: string; noteId: string }) => void;
  aiAttention?: AIAttentionLeadData;
};

export function LeadDetailPanel({
  lead,
  saving,
  onClose,
  onEdit,
  onStatusChange,
  onDelete,
  activities = [],
  activityFilter = "all",
  onActivityFilterChange,
  onAddNote,
  onRefreshActivities,
  onAddFollowUp,
  initialAction = null,
  whatsAppMessage,
  onEditNote,
  onDeleteNote,
  aiAttention,
}: LeadDetailPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const statusSelectRef = useRef<HTMLSelectElement>(null);
  const leadId = lead?.id;
  const [lossHistory, setLossHistory] = useState<LeadLossRecord[]>([]);
  const [noteMode, setNoteMode] = useState<"standard" | "ai">("standard");
  
  const [composerOpen, setComposerOpen] = useState(false);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);

  useEffect(() => {
    if (leadId && lead?.status === "Lost") {
      getLeadLossHistory(leadId).then((res) => {
        if (res.success && res.data) {
          setLossHistory(res.data);
        }
      });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLossHistory([]);
    }
  }, [leadId, lead?.status]);

  useEffect(() => {
    if (composerOpen && templates.length === 0) {
      getWhatsAppTemplates({ activeOnly: true }).then(res => {
        if (res.success) setTemplates(res.data || []);
      });
    }
  }, [composerOpen, templates.length]);

  useDialogAccessibility(Boolean(leadId), onClose, saving, closeButtonRef);



  useEffect(() => {
    if (!leadId || !initialAction) return;
    const frame = window.requestAnimationFrame(() => {
      if (initialAction === "status") statusSelectRef.current?.focus();
      if (initialAction === "activity" || initialAction === "followups") {
        onActivityFilterChange?.(initialAction === "followups" ? "followups" : "all");
        document.getElementById("lead-activity-section")?.scrollIntoView({ block: "start" });
      }
      if (initialAction === "note") {
        const composer = document.getElementById(`lead-note-${leadId}`);
        composer?.scrollIntoView({ behavior: "smooth", block: "center" });
        composer?.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialAction, leadId, onActivityFilterChange]);

  if (!lead) return null;

  const hasActivity = activities.length > 0;
  const aiData = aiAttention || lead.aiAttention || deriveAIAttention(lead);

  const handleRecommendedAction = () => {
    if (aiData.recommendedAction.type === "followup" && onAddFollowUp) {
      onAddFollowUp();
    } else if (aiData.recommendedAction.type === "call") {
      window.location.href = `tel:${lead.phone}`;
    } else if (aiData.recommendedAction.type === "whatsapp") {
      const url = `https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`;
      window.open(url, "_blank");
    } else if (onAddFollowUp) {
      onAddFollowUp();
    }
  };

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-dvh">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close lead details"
        onClick={onClose}
        disabled={saving}
        className="absolute inset-0 bg-slate-950/45"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-detail-title"
        className="absolute inset-y-0 right-0 flex h-full min-h-0 w-full max-w-xl flex-col bg-[var(--background)] shadow-2xl motion-safe:animate-[lead-panel-in_180ms_ease-out]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="lead-detail-title"
                className="truncate text-xl font-semibold tracking-tight text-slate-950"
              >
                {lead.name}
              </h2>
              <LeadStatusBadge status={lead.status} />
              <OperationalStateBadge state={lead.operationalState || "ACTIVE_NEUTRAL"} />
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">{lead.business || "No business added"}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close lead details"
            className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 cursor-pointer"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>

        <div
          role="region"
          tabIndex={0}
          aria-label="Lead information"
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4"
        >
          {/* Phase 8: AI Insights Section */}
          <LeadDetailAIInsights data={aiData} onRecommendedAction={handleRecommendedAction} />

          {lead.status === "Lost" && lossHistory.length > 0 && (
            <LostLeadDetail
              reason={lossHistory[0].reasonLabel || lossHistory[0].reason}
              lostAt={lossHistory[0].lostAt}
              notes={lossHistory[0].note}
              leadName={lead.name}
            />
          )}

          <section className="rounded-xl border border-[var(--border)] bg-white p-5">
            <h3 className="font-semibold text-slate-950">Contact</h3>
            <dl className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <DetailItem label="Name" value={lead.name} />
              <DetailItem label="Phone" value={lead.phone} />
              <DetailItem label="Email" value={lead.email} />
              <DetailItem label="Business" value={lead.business} />
            </dl>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-white p-5">
            <h3 className="font-semibold text-slate-950">Sales</h3>
            <dl className="mt-4 grid grid-cols-2 gap-5">
              <DetailItem label="Status" value={lead.status} />
              <DetailItem label="Quoted amount" value={formatCurrency(lead.quotedAmount)} />
              <DetailItem label="Industry" value={lead.industry} />
            </dl>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-white p-5">
            <h3 className="font-semibold text-slate-950">Follow-up</h3>
            <dl className="mt-4 grid grid-cols-2 gap-5">
              <DetailItem label="Last contact" value={formatDate(lead.lastContactDate)} />
              <DetailItem label="Next follow-up" value={formatDate(lead.nextFollowUpDate)} />
            </dl>
          </section>

          <section
            id="lead-activity-section"
            className="min-w-0 rounded-xl border border-[var(--border)] bg-white"
          >
            <div className="border-b border-slate-100 px-5 py-3">
              <h3 className="font-semibold text-slate-950">Notes & Activity</h3>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {hasActivity
                  ? `${activities.length} event${activities.length !== 1 ? "s" : ""}`
                  : "No activity yet."}
              </p>
            </div>

            <div className="min-w-0">
              <LeadActivityTimeline
                activities={activities}
                filter={activityFilter}
                onFilterChange={onActivityFilterChange ?? (() => {})}
                onEditNote={onEditNote}
                onDeleteNote={onDeleteNote}
                noteComposer={
                  onAddNote ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex rounded-lg bg-slate-100 p-1">
                        <button
                          type="button"
                          onClick={() => setNoteMode("standard")}
                          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                            noteMode === "standard"
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <FileText className="size-3.5" /> Standard Note
                        </button>
                        <button
                          type="button"
                          onClick={() => setNoteMode("ai")}
                          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                            noteMode === "ai"
                              ? "bg-white text-slate-900 shadow-sm"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <Sparkles className="size-3.5 text-blue-600" /> AI Call Notes
                        </button>
                      </div>

                      {noteMode === "standard" ? (
                        <NoteComposer
                          id={`lead-note-${lead.id}`}
                          autoFocus={initialAction === "note"}
                          onAddNote={onAddNote}
                          disabled={saving}
                        />
                      ) : (
                        <div className="pt-2">
                          <AIConversationNotes
                            disabled={saving}
                            onStructureNotes={async (rawNote) => {
                              const result = await structureCallNotes(rawNote, leadId);
                              if (!result.success || !result.data) throw new Error(result.error || "Failed to structure notes");
                              return result.data;
                            }}
                            onApplyStructured={async (result) => {
                              if (!leadId) return;
                              await applyCallNotes({
                                leadId,
                                rawNote: result.rawNote,
                                structuredData: result.structuredData,
                                formattedNote: result.formattedOutput,
                                appliedType: "structured",
                              });
                              
                              if (result.structuredData?.suggestedFollowUpDate) {
                                const formData = new FormData();
                                formData.append("leadId", leadId);
                                formData.append(
                                  "scheduledAt",
                                  `${result.structuredData.suggestedFollowUpDate}T${result.structuredData.suggestedFollowUpTime || "10:00"}:00+05:30`
                                );
                                formData.append("type", "CALL");
                                formData.append("note", "Follow-up suggested by AI Call Notes");
                                await createFollowUp(formData);
                              }
                              
                              onRefreshActivities?.();
                            }}
                            onKeepOriginal={async (result) => {
                              if (!leadId) return;
                              await applyCallNotes({
                                leadId,
                                rawNote: result.rawNote,
                                structuredData: null,
                                formattedNote: result.rawNote,
                                appliedType: "original",
                              });
                              onRefreshActivities?.();
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ) : undefined
                }
              />
            </div>
          </section>

          <section
            aria-label="Lead record actions"
            className="flex gap-2 rounded-xl border border-[var(--border)] bg-white p-3"
          >
            <button
              type="button"
              onClick={onEdit}
              disabled={saving}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 active:bg-slate-200 disabled:opacity-50 cursor-pointer"
            >
              <Pencil aria-hidden="true" size={17} />
              Edit lead
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={saving}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 active:bg-rose-100 disabled:opacity-50 cursor-pointer"
            >
              <Trash2 aria-hidden="true" size={17} />
              Delete
            </button>
          </section>
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] sm:px-6">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current status
            <select
              ref={statusSelectRef}
              value={lead.status}
              onChange={(event) => onStatusChange(event.target.value as LeadStatus)}
              disabled={saving}
              className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
            >
              {leadStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <LeadQuickActions
            lead={lead}
            whatsAppMessage={whatsAppMessage}
            onAddNote={
              onAddNote
                ? () => {
                    setNoteMode("standard");
                    window.requestAnimationFrame(() => {
                      const composer = document.getElementById(`lead-note-${lead.id}`);
                      composer?.scrollIntoView({ block: "center" });
                      composer?.focus({ preventScroll: true });
                    });
                  }
                : undefined
            }
            onAddFollowUp={onAddFollowUp}
            onChangeStatus={() => statusSelectRef.current?.focus()}
            onOpenWhatsAppComposer={() => setComposerOpen(true)}
            className="mt-2"
          />
        </footer>
      </aside>
      
      {/* WhatsApp Composer */}
      {composerOpen && <WhatsAppLeadComposer
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        templates={templates}
        lead={{
          id: lead.id,
          name: lead.name,
          phone: lead.phone,
          business: lead.business,
          requirement: lead.notes,
          budget: lead.budget ? Number(lead.budget) : null,
          status: lead.status,
          followUpDate: lead.nextFollowUpDate ? formatDate(lead.nextFollowUpDate) : null,
          followUpTime: null,
        }}
      />}
    </div>
  );
}
