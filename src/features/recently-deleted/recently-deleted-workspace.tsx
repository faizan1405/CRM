"use client";

import { useState, useRef } from "react";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast-provider";
import { restoreLead, permanentlyDeleteLead } from "@/app/actions/leads";
import { useDialogAccessibility } from "@/components/use-dialog-accessibility";
import { RotateCcw, Trash2, Phone, AlertTriangle, UserCheck } from "lucide-react";

export type RecentlyDeletedLead = {
  id: string;
  name: string;
  phone: string;
  status: string;
  deletedAt: string;
};

type RecentlyDeletedWorkspaceProps = {
  initialLeads: RecentlyDeletedLead[];
};

export function RecentlyDeletedWorkspace({ initialLeads }: RecentlyDeletedWorkspaceProps) {
  const [leads, setLeads] = useState<RecentlyDeletedLead[]>(initialLeads);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmLead, setConfirmLead] = useState<RecentlyDeletedLead | null>(null);
  const [permanentlyDeleting, setPermanentlyDeleting] = useState(false);
  const { showToast } = useToast();

  const handleRestore = async (lead: RecentlyDeletedLead) => {
    setRestoringId(lead.id);
    try {
      const res = await restoreLead(lead.id);
      if (res.success) {
        setLeads((prev) => prev.filter((l) => l.id !== lead.id));
        showToast(`Restored "${lead.name}" to active pipeline`, "success");
      } else {
        showToast(res.error || "Failed to restore lead", "error");
      }
    } catch {
      showToast("Network error while restoring lead", "error");
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDeleteConfirm = async () => {
    if (!confirmLead) return;
    setPermanentlyDeleting(true);
    try {
      const res = await permanentlyDeleteLead(confirmLead.id);
      if (res.success) {
        setLeads((prev) => prev.filter((l) => l.id !== confirmLead.id));
        showToast(`Permanently deleted "${confirmLead.name}"`, "info");
        setConfirmLead(null);
      } else {
        showToast(res.error || "Failed to permanently delete lead", "error");
      }
    } catch {
      showToast("Network error while permanently deleting lead", "error");
    } finally {
      setPermanentlyDeleting(false);
    }
  };

  const formatDeletedDate = (dateStr: string) => {
    if (!dateStr) return "Unknown";
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const statusColors: Record<string, string> = {
    New: "bg-blue-50 text-blue-700 border-blue-200",
    Contacted: "bg-cyan-50 text-cyan-700 border-cyan-200",
    Qualified: "bg-purple-50 text-purple-700 border-purple-200",
    "Proposal Sent": "bg-amber-50 text-amber-700 border-amber-200",
    Won: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Lost: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <div className="flex h-full flex-col space-y-6">
      <PageHeader
        title="Recently Deleted"
        description="Review soft-deleted leads. You can restore them back to the active pipeline or permanently erase them."
      />

      {leads.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <UserCheck size={28} />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900">No deleted leads</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            When you delete leads from your CRM, they will be kept here safely before permanent removal.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-6 py-4">Lead Name</th>
                  <th scope="col" className="px-6 py-4">Phone</th>
                  <th scope="col" className="px-6 py-4">Previous Status</th>
                  <th scope="col" className="px-6 py-4">Deleted Date / Time</th>
                  <th scope="col" className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => {
                  const isRestoring = restoringId === lead.id;
                  const badgeClass = statusColors[lead.status] || "bg-slate-50 text-slate-700 border-slate-200";

                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {lead.name}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-700">
                          <Phone size={14} className="text-slate-400 shrink-0" />
                          <span>{lead.phone || "—"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {formatDeletedDate(lead.deletedAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={isRestoring || permanentlyDeleting}
                            onClick={() => handleRestore(lead)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50"
                          >
                            <RotateCcw size={13} className={isRestoring ? "animate-spin" : ""} />
                            {isRestoring ? "Restoring..." : "Restore"}
                          </button>
                          <button
                            type="button"
                            disabled={isRestoring || permanentlyDeleting}
                            onClick={() => setConfirmLead(lead)}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/60 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-xs hover:bg-rose-100 hover:text-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                            Permanently Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="divide-y divide-slate-100 md:hidden">
            {leads.map((lead) => {
              const isRestoring = restoringId === lead.id;
              const badgeClass = statusColors[lead.status] || "bg-slate-50 text-slate-700 border-slate-200";

              return (
                <div key={lead.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-slate-900 text-base">{lead.name}</h4>
                      <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                        <Phone size={14} className="text-slate-400" />
                        <span>{lead.phone || "—"}</span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}>
                      {lead.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400">
                    Deleted: {formatDeletedDate(lead.deletedAt)}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isRestoring || permanentlyDeleting}
                      onClick={() => handleRestore(lead)}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50"
                    >
                      <RotateCcw size={15} className={isRestoring ? "animate-spin" : ""} />
                      {isRestoring ? "Restoring..." : "Restore"}
                    </button>
                    <button
                      type="button"
                      disabled={isRestoring || permanentlyDeleting}
                      onClick={() => setConfirmLead(lead)}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 shadow-xs hover:bg-rose-100 active:bg-rose-200 disabled:opacity-50"
                    >
                      <Trash2 size={15} />
                      Permanently Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <PermanentDeleteModal
        lead={confirmLead}
        deleting={permanentlyDeleting}
        onCancel={() => {
          if (!permanentlyDeleting) setConfirmLead(null);
        }}
        onConfirm={handlePermanentDeleteConfirm}
      />
    </div>
  );
}

function PermanentDeleteModal({
  lead,
  deleting,
  onCancel,
  onConfirm,
}: {
  lead: RecentlyDeletedLead | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useDialogAccessibility(Boolean(lead), onCancel, deleting, cancelRef);

  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="perm-delete-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 id="perm-delete-title" className="text-lg font-bold text-slate-900">
              Permanently delete lead?
            </h3>
            <p className="text-xs text-slate-500">This action cannot be reversed.</p>
          </div>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          Are you sure you want to permanently delete <strong className="text-slate-900">{lead.name}</strong> ({lead.phone})? All associated follow-ups, activities, and AI insights will be destroyed forever.
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            ref={cancelRef}
            type="button"
            disabled={deleting}
            onClick={onCancel}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void onConfirm()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-rose-700 active:bg-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 disabled:opacity-50"
          >
            <Trash2 size={16} />
            {deleting ? "Deleting..." : "Permanently Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
