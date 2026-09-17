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
import { getLeadLossHistory } from "@/app/actions/lost-reasons";
import { LostLeadDetail } from "@/features/lost-reasons/lost-lead-detail";
import type { LeadLossRecord } from "@/features/lost-reasons/types";
import { CopyContactButton } from "@/components/copy-contact-button";
import { formatLeadAge, formatLastContacted, formatNextFollowUp } from "@/lib/date-utils";

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
  const statusSelectRef = useRef<HTMLSelectElement>(null);
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
              <DetailItem label="Name" value={lead.name} action={<CopyContactButton name={lead.name} phone={lead.phone} />} />
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
              <DetailItem label="Last contact" value={formatLastContacted(lead.lastContactDate)} />
              <DetailItem label="Next follow-up" value={formatNextFollowUp(lead.nextFollowUpDate)} />
              <DetailItem label="Age" value={formatLeadAge(lead.createdAt)} />
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

        <footer className="relative z-20 shrink-0 border-t border-slate-200 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] sm:px-6">
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
            className="mt-2"
          />
        </footer>
      </aside>
    </div>
  );
}
