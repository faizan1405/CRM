"use client";

import { useDialogAccessibility } from "@/components/use-dialog-accessibility";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/features/leads/formatters";
import { LeadStatusBadge } from "@/features/leads/lead-status-badge";
import { OperationalStateBadge } from "@/features/leads/operational-state-badge";
import type { Lead, LeadStatus } from "@/features/leads/types";
import { LeadActivityTimeline } from "@/features/activity/lead-activity-timeline";
import type { Activity, ActivityFilter } from "@/features/activity/types";
import { NoteComposer } from "@/features/activity/note-composer";
import { LeadQuickActions } from "@/features/leads/lead-quick-actions";
import { getLeadLossHistory } from "@/app/actions/lost-reasons";
import { LostLeadDetail } from "@/features/lost-reasons/lost-lead-detail";
import type { LeadLossRecord } from "@/features/lost-reasons/types";
import { CopyContactButton } from "@/components/copy-contact-button";
import { formatLeadAge, formatLastContacted, formatNextFollowUp } from "@/lib/date-utils";
import { ChangeStatusSheet } from "./change-status-sheet";

function DetailItem({ label, value, action }: { label: string; value: string; action?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1.5 break-words text-sm font-medium text-slate-800 flex items-center gap-2">
        {value || "Not added"}
        {action}
      </dd>
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
  onMarkWaste?: () => void;
  onRestoreWaste?: () => void;
  initialAction?: "note" | "status" | "activity" | "followups" | null;
  whatsAppMessage?: string;
  onEditNote?: (data: { id: string; noteId: string; noteText: string }) => void;
  onDeleteNote?: (data: { id: string; noteId: string }) => void;
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
  onAddFollowUp,
  onMarkWaste,
  onRestoreWaste,
  initialAction = null,
  whatsAppMessage,
  onEditNote,
  onDeleteNote,
}: LeadDetailPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [statusSheetOpen, setStatusSheetOpen] = useState(initialAction === "status");
  const leadId = lead?.id;
  const [lossHistory, setLossHistory] = useState<LeadLossRecord[]>([]);

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

  useDialogAccessibility(Boolean(leadId), onClose, saving, closeButtonRef);

  useEffect(() => {
    if (!leadId || !initialAction) return;
    const frame = window.requestAnimationFrame(() => {
      if (initialAction === "status") {
        setStatusSheetOpen(true);
      }
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
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50/50 pb-[120px]"
        >
          {/* Top Section: Name, Status, Phone, Age */}
          <div className="bg-white px-5 py-4 border-b border-slate-200">
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
                    {lead.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-sm font-medium text-slate-600">{lead.phone}</span>
                    <CopyContactButton name={lead.name} phone={lead.phone} />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <LeadStatusBadge status={lead.status} />
                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    Age {formatLeadAge(lead.createdAt)}
                  </span>
                </div>
              </div>
              
              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Last Contact</span>
                  <span className="text-xs font-semibold text-slate-700">{formatLastContacted(lead.lastContactDate)}</span>
                </div>
                <div className="w-px h-6 bg-slate-200"></div>
                <div className="flex flex-col text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Next Follow-up</span>
                  <span className="text-xs font-bold text-blue-700">{formatNextFollowUp(lead.nextFollowUpDate)}</span>
                </div>
              </div>
              
              {lead.latestNote && (
                <div className="text-sm text-slate-600 italic bg-amber-50/50 p-3 rounded-xl border border-amber-100 mt-1">
                  &quot;{lead.latestNote}&quot;
                </div>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-3">
            {lead.status === "Lost" && lossHistory.length > 0 && (
              <LostLeadDetail
                reason={lossHistory[0].reasonLabel || lossHistory[0].reason}
                lostAt={lossHistory[0].lostAt}
                notes={lossHistory[0].note}
                leadName={lead.name}
              />
            )}

            {/* Expandable Details */}
            <details className="group rounded-xl border border-[var(--border)] bg-white overflow-hidden [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4 font-semibold text-slate-900 select-none hover:bg-slate-50 active:bg-slate-100">
                Contact & Sales Details
                <svg className="h-5 w-5 text-slate-400 transition-transform group-open:-rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="border-t border-slate-100 px-5 py-4">
                <dl className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                  <DetailItem label="Email" value={lead.email} />
                  <DetailItem label="Business" value={lead.business} />
                  <DetailItem label="Industry" value={lead.industry} />
                  <DetailItem label="Quoted amount" value={formatCurrency(lead.quotedAmount)} />
                </dl>
              </div>
            </details>

            {/* Expandable Activity & Notes */}
            <details open className="group rounded-xl border border-[var(--border)] bg-white overflow-hidden [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4 font-semibold text-slate-900 select-none hover:bg-slate-50 active:bg-slate-100">
                <div className="flex items-center gap-2">
                  Activity & Notes
                  <span className="bg-slate-100 text-slate-500 text-xs py-0.5 px-2 rounded-full font-medium">{activities.length}</span>
                </div>
                <svg className="h-5 w-5 text-slate-400 transition-transform group-open:-rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="border-t border-slate-100" id="lead-activity-section">
                <LeadActivityTimeline
                  activities={activities}
                  filter={activityFilter}
                  onFilterChange={onActivityFilterChange ?? (() => {})}
                  onEditNote={onEditNote}
                  onDeleteNote={onDeleteNote}
                  noteComposer={
                    onAddNote ? (
                      <div className="flex flex-col gap-3 px-5 py-3 bg-slate-50/50 border-t border-slate-100">
                        <NoteComposer
                          id={`lead-note-${lead.id}`}
                          autoFocus={initialAction === "note"}
                          onAddNote={onAddNote}
                          disabled={saving}
                        />
                      </div>
                    ) : undefined
                  }
                />
              </div>
            </details>
          </div>
        </div>

        {/* Sticky Action Bar */}
        <footer className="absolute bottom-0 inset-x-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] sm:px-6">
          <div className="flex items-center gap-3 w-full">
            <LeadQuickActions
              lead={lead}
              whatsAppMessage={whatsAppMessage}
              onAddNote={
                onAddNote
                  ? () => {
                      window.requestAnimationFrame(() => {
                        const composer = document.getElementById(`lead-note-${lead.id}`);
                        // Open details if closed
                        const details = composer?.closest('details');
                        if (details && !details.open) details.open = true;
                        composer?.scrollIntoView({ block: "center" });
                        composer?.focus({ preventScroll: true });
                      });
                    }
                  : undefined
              }
              onAddFollowUp={onAddFollowUp}
              onChangeStatus={() => setStatusSheetOpen(true)}
              onMarkWaste={onMarkWaste}
              onRestoreWaste={onRestoreWaste}
              className="flex-1"
            />
          </div>
        </footer>

        <ChangeStatusSheet
          isOpen={statusSheetOpen}
          currentStatus={lead.status}
          leadName={lead.name}
          saving={saving}
          onClose={() => setStatusSheetOpen(false)}
          onSelectStatus={async (newStatus) => {
            setStatusSheetOpen(false);
            await onStatusChange(newStatus);
          }}
        />
      </aside>
    </div>
  );
}
