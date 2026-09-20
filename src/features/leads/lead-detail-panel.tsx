"use client";

import { useDialogAccessibility } from "@/components/use-dialog-accessibility";

import { ArrowUpRight, Clock, GitMerge, Pencil, RotateCcw, Star, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatCurrency } from "@/features/leads/formatters";
import { LeadStatusBadge } from "@/features/leads/lead-status-badge";
import { OperationalStateBadge } from "@/features/leads/operational-state-badge";
import type { Lead, LeadStatus } from "@/features/leads/types";
import { calculateLeadStaleness } from "@/lib/stale-leads";
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
import { LeadDealSection } from "@/features/deals/components/lead-deal-section";
import { EditLeadDetailsModal } from "./edit-lead-details-modal";

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
  onLeadUpdated?: (updatedLead: Lead) => void;
  /** Phase 5: Activity timeline integration */
  activities?: Activity[];
  activityFilter?: ActivityFilter;
  onActivityFilterChange?: (filter: ActivityFilter) => void;
  onAddNote?: (text: string) => Promise<{ success: boolean; error?: string }>;
  onRefreshActivities?: () => void;
  onAddFollowUp?: () => void;
  onMarkWaste?: () => void;
  onRestoreWaste?: () => void;
  onTogglePin?: () => void;
  initialAction?: "note" | "status" | "activity" | "followups" | null;
  whatsAppMessage?: string;
  onEditNote?: (data: { id: string; noteId: string; noteText: string }) => void;
  onDeleteNote?: (data: { id: string; noteId: string }) => void;
  onOpenLead?: (leadId: string) => void;
  onInitiateMerge?: (lead: Lead) => void;
};

export function LeadDetailPanel({
  lead,
  saving,
  onClose,
  onEdit,
  onStatusChange,
  onDelete,
  onLeadUpdated,
  activities = [],
  activityFilter = "all",
  onActivityFilterChange,
  onAddNote,
  onRefreshActivities,
  onAddFollowUp,
  onMarkWaste,
  onRestoreWaste,
  onTogglePin,
  initialAction = null,
  whatsAppMessage,
  onEditNote,
  onDeleteNote,
  onOpenLead,
  onInitiateMerge,
}: LeadDetailPanelProps) {
  const [currentLead, setCurrentLead] = useState<Lead | null>(lead);
  useEffect(() => {
    setCurrentLead(lead);
  }, [lead]);
  const activeLead = currentLead || lead;
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [statusSheetOpen, setStatusSheetOpen] = useState(initialAction === "status");
  const leadId = activeLead?.id;
  const [lossHistory, setLossHistory] = useState<LeadLossRecord[]>([]);

  useEffect(() => {
    if (leadId && activeLead?.status === "Lost") {
      getLeadLossHistory(leadId).then((res) => {
        if (res.success && res.data) {
          setLossHistory(res.data);
        }
      });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLossHistory([]);
    }
  }, [leadId, activeLead?.status]);

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

  const staleInfo = useMemo(() => {
    if (!activeLead) return null;
    return calculateLeadStaleness({
      id: activeLead.id,
      status: activeLead.status,
      isWaste: activeLead.isWaste,
      createdAt: activeLead.createdAt,
      lastContactDate: activeLead.lastContactDate,
      activities: activities.length > 0 ? activities : (activeLead.lastActivity ? [{
        type: activeLead.lastActivity.type,
        message: activeLead.lastActivity.message,
        createdAt: activeLead.lastActivity.createdAt,
      }] : []),
    });
  }, [activeLead, activities]);

  if (!activeLead) return null;

  const hasActivity = activities.length > 0;

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-dvh overflow-hidden">
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
        className="absolute inset-y-0 right-0 flex h-full min-h-0 w-full max-w-full sm:max-w-xl flex-col bg-[var(--background)] shadow-2xl motion-safe:animate-[lead-panel-in_180ms_ease-out] overflow-hidden"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="lead-detail-title"
                className="truncate text-xl font-semibold tracking-tight text-slate-950"
              >
                {activeLead.name}
              </h2>
              <LeadStatusBadge status={activeLead.status} />
              <OperationalStateBadge state={activeLead.operationalState || "ACTIVE_NEUTRAL"} />
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">{activeLead.business || "No business added"}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {!activeLead.mergedIntoLeadId && onInitiateMerge && (
              <button
                type="button"
                onClick={() => onInitiateMerge(activeLead)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 transition-colors"
                title="Merge with duplicate lead"
              >
                <GitMerge size={14} className="text-blue-600" />
                <span className="hidden sm:inline">Merge</span>
              </button>
            )}
            {!activeLead.mergedIntoLeadId && onTogglePin && (
              <button
                type="button"
                onClick={onTogglePin}
                disabled={saving}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  activeLead.isPinned
                    ? "border-amber-300 bg-amber-50 text-amber-900 shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100"
                }`}
                aria-label={activeLead.isPinned ? `Unpin ${activeLead.name}` : `Pin ${activeLead.name}`}
                title={activeLead.isPinned ? "Unpin lead" : "Pin lead"}
              >
                <Star
                  size={14}
                  className={activeLead.isPinned ? "fill-amber-400 text-amber-500" : "text-slate-400"}
                />
                <span>{activeLead.isPinned ? "Pinned" : "Pin"}</span>
              </button>
            )}
            {!activeLead.mergedIntoLeadId && onRestoreWaste && (
              <button
                type="button"
                onClick={onRestoreWaste}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 active:bg-emerald-200 transition-colors"
                aria-label={`Restore ${activeLead.name}`}
              >
                <RotateCcw size={14} /> Restore
              </button>
            )}
            {!activeLead.mergedIntoLeadId && onMarkWaste && (
              <button
                type="button"
                onClick={onMarkWaste}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 transition-colors"
                aria-label={`Mark ${activeLead.name} as waste`}
              >
                <Trash2 size={14} /> Waste
              </button>
            )}
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
          </div>
        </header>

        {activeLead.mergedIntoLeadId && (
          <div className="border-b border-amber-300 bg-amber-50 px-5 py-3.5 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <GitMerge className="text-amber-700 shrink-0" size={18} />
                <p className="text-xs font-semibold text-amber-950">
                  This lead was merged into{" "}
                  <strong>{activeLead.mergedInto?.name || "Primary Lead"}</strong>.
                </p>
              </div>
              {activeLead.mergedInto?.id && onOpenLead && (
                <button
                  type="button"
                  onClick={() => onOpenLead(activeLead.mergedInto!.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-950 shrink-0"
                >
                  <ArrowUpRight size={14} /> Open Primary Lead
                </button>
              )}
            </div>
          </div>
        )}

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
                    {activeLead.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-sm font-medium text-slate-600">{activeLead.phone}</span>
                    <CopyContactButton name={activeLead.name} phone={activeLead.phone} />
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <LeadStatusBadge status={activeLead.status} />
                  <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    Age {formatLeadAge(activeLead.createdAt)}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                <div className="flex flex-col text-left">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Last Activity</span>
                  <span className="text-xs font-semibold text-slate-700">{staleInfo?.inactivityText || "None"}</span>
                </div>
                <div className="flex flex-col text-left border-l border-slate-200 pl-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Last Contact</span>
                  <span className="text-xs font-semibold text-slate-700">{formatLastContacted(activeLead.lastContactDate)}</span>
                </div>
                <div className="flex flex-col text-right border-l border-slate-200 pl-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Next Follow-up</span>
                  <span className="text-xs font-bold text-blue-700">{formatNextFollowUp(activeLead.nextFollowUpDate)}</span>
                </div>
              </div>

              {staleInfo?.isStale && (
                <div
                  role="status"
                  aria-label={staleInfo.warningMessage}
                  className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-900 mt-1 shadow-xs"
                >
                  <Clock className="size-4 text-amber-600 shrink-0" aria-hidden="true" />
                  <p className="flex-1 font-medium">{staleInfo.warningMessage}</p>
                  <span className="rounded bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-800 uppercase tracking-wide shrink-0">
                    Stale
                  </span>
                </div>
              )}
              
              {activeLead.latestNote && (
                <div className="text-sm text-slate-600 italic bg-amber-50/50 p-3 rounded-xl border border-amber-100 mt-1">
                  &quot;{activeLead.latestNote}&quot;
                </div>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-3">
            {activeLead.status === "Lost" && lossHistory.length > 0 && (
              <LostLeadDetail
                reason={lossHistory[0].reasonLabel || lossHistory[0].reason}
                lostAt={lossHistory[0].lostAt}
                notes={lossHistory[0].note}
                leadName={activeLead.name}
              />
            )}

            {/* Expandable Details */}
            <details className="group rounded-xl border border-[var(--border)] bg-white overflow-hidden [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4 font-semibold text-slate-900 select-none hover:bg-slate-50 active:bg-slate-100">
                <span>Contact & Sales Details</span>
                <div className="flex items-center gap-2">
                  {!activeLead.mergedIntoLeadId && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditDetailsOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 transition-colors shadow-xs cursor-pointer"
                      aria-label="Edit Contact and Sales Details"
                    >
                      <Pencil size={13} className="text-slate-500" aria-hidden="true" />
                      <span>Edit Details</span>
                    </button>
                  )}
                  <svg className="h-5 w-5 text-slate-400 transition-transform group-open:-rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </summary>
              <div className="border-t border-slate-100 px-5 py-4">
                <dl className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
                  <DetailItem label="Email" value={activeLead.email} />
                  <DetailItem label="Business" value={activeLead.business} />
                  <DetailItem label="Industry" value={activeLead.industry} />
                  <DetailItem label="Lead source" value={activeLead.source} />
                  <DetailItem label="Quoted amount" value={formatCurrency(activeLead.quotedAmount)} />
                </dl>
              </div>
            </details>

            {/* Deal & Payments Section */}
            <LeadDealSection leadId={activeLead.id} leadQuotedAmount={activeLead.quotedAmount} />

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
                    !activeLead.mergedIntoLeadId && onAddNote ? (
                      <div className="flex flex-col gap-3 px-5 py-3 bg-slate-50/50 border-t border-slate-100">
                        <NoteComposer
                          id={`lead-note-${activeLead.id}`}
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
          {activeLead.mergedIntoLeadId ? (
            <div className="flex items-center justify-between w-full text-xs text-slate-500 py-1 font-medium">
              <span>Archived Merged Lead Record (Read-Only)</span>
              {activeLead.mergedInto && onOpenLead && (
                <button
                  type="button"
                  onClick={() => onOpenLead(activeLead.mergedInto!.id)}
                  className="text-blue-600 hover:underline font-semibold cursor-pointer"
                >
                  View surviving record ({activeLead.mergedInto.name}) →
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 w-full">
              <LeadQuickActions
                lead={activeLead}
                whatsAppMessage={whatsAppMessage}
                onAddNote={
                  onAddNote
                    ? () => {
                        window.requestAnimationFrame(() => {
                          const composer = document.getElementById(`lead-note-${activeLead.id}`);
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
          )}
        </footer>

        <ChangeStatusSheet
          isOpen={statusSheetOpen}
          currentStatus={activeLead.status}
          leadName={activeLead.name}
          saving={saving}
          onClose={() => setStatusSheetOpen(false)}
          onSelectStatus={async (newStatus) => {
            setStatusSheetOpen(false);
            await onStatusChange(newStatus);
          }}
        />

        {editDetailsOpen && activeLead && (
          <EditLeadDetailsModal
            isOpen={editDetailsOpen}
            lead={activeLead}
            onClose={() => setEditDetailsOpen(false)}
            onSaved={(updatedLead) => {
              setCurrentLead(updatedLead);
              onLeadUpdated?.(updatedLead);
              onRefreshActivities?.();
            }}
          />
        )}
      </aside>
    </div>
  );
}
