"use client";

import { useSearchParams } from "next/navigation";
import { useLeadNavigation } from "@/features/leads/lead-navigation-provider";
import { getTelephoneHref } from "@/features/leads/contact-links";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWhatsApp } from "@/components/whatsapp-context";
import { FollowUpCard } from "./follow-up-card";
import { FollowUpForm } from "./follow-up-form";
import { FollowUpEmptyState } from "./empty-state";
import { RescheduleDialog } from "./reschedule-dialog";
import { PageHeader } from "@/components/page-header";
import type { FollowUp, NewFollowUpInput } from "./types";
import { createFollowUp, markFollowUpComplete, cancelFollowUp, updateFollowUp } from "@/app/actions/follow-ups";
import {
  getFollowUpStatusInfo,
  isFollowUpToday,
  isFollowUpUpcoming,
  isFollowUpOverdue,
} from "./formatters";

type TabKey = "today" | "overdue" | "upcoming" | "completed";

const TABS: { key: TabKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "overdue", label: "Overdue" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];

type FollowUpsWorkspaceProps = {
  initialFollowUps: FollowUp[];
  leads?: { id: string; name: string }[];
};

export function FollowUpsWorkspace({
  initialFollowUps,
  leads = [],
}: FollowUpsWorkspaceProps) {
  const searchParams = useSearchParams();
  const navigation = useLeadNavigation();
  const { openWhatsApp } = useWhatsApp();
  const filterParam = searchParams.get("filter");
  const newParam = searchParams.get("new");
  const leadParam = searchParams.get("leadId");
  const [followUps, setFollowUps] = useState<FollowUp[]>(initialFollowUps);
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const hasOverdue = initialFollowUps.some((f) => isFollowUpOverdue(f));
    const hasToday = initialFollowUps.some((f) => isFollowUpToday(f));
    if (hasToday) return "today";
    if (hasOverdue) return "overdue";
    return "today";
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null);
  const [saving, setSaving] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<FollowUp | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  // Sync with incoming data (e.g., after revalidation)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFollowUps(initialFollowUps);
  }, [initialFollowUps]);

  useEffect(() => {
    if (newParam === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormOpen(true);
    }
  }, [newParam]);

  useEffect(() => {
    if (TABS.some(tab => tab.key === filterParam)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab(filterParam as TabKey);
    }
  }, [filterParam]);

  const stats = useMemo(() => {
    const pending = followUps.filter((f) => f.status === "Pending");
    return {
      Overdue: pending.filter(isFollowUpOverdue).length,
      Today: pending.filter(isFollowUpToday).length,
      Upcoming: pending.filter(isFollowUpUpcoming).length,
      Completed: followUps.filter((f) => f.status === "Completed").length,
    };
  }, [followUps]);

  const filteredFollowUps = useMemo(() => {
    const pending = followUps.filter((f) => f.status === "Pending");
    switch (activeTab) {
      case "overdue":
        return pending.filter(isFollowUpOverdue);
      case "today":
        return pending.filter(isFollowUpToday);
      case "upcoming":
        return pending.filter(isFollowUpUpcoming);
      case "completed":
        return followUps.filter((f) => f.status === "Completed");
      default:
        return [];
    }
  }, [followUps, activeTab]);

  const localUpdateFollowUp = useCallback(
    (id: string, updates: Partial<FollowUp>) => {
      setFollowUps((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
    },
    []
  );

  const handleCreate = async (data: NewFollowUpInput) => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("leadId", data.leadId);
      formData.append("scheduledAt", data.scheduledAt);
      formData.append("type", data.type);
      formData.append("note", data.note);

      let result;
      if (editingFollowUp) {
        result = await updateFollowUp(editingFollowUp.id, formData);
      } else {
        result = await createFollowUp(formData);
      }
      
      if (!result.success) {
        alert(result.error || "Failed to save follow-up.");
      } else {
        setFormOpen(false);
        setEditingFollowUp(null);
      }
    } catch {
      alert("Failed to save follow-up. Please retry.");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (followUp: FollowUp) => {
    localUpdateFollowUp(followUp.id, { status: "Completed" });
    const result = await markFollowUpComplete(followUp.id);
    if (!result.success) {
      localUpdateFollowUp(followUp.id, { status: "Pending" });
      alert(result.error || "Failed to complete follow-up.");
    }
  };

  const handleCancel = async (followUp: FollowUp) => {
    localUpdateFollowUp(followUp.id, { status: "Cancelled" });
    const result = await cancelFollowUp(followUp.id);
    if (!result.success) {
      localUpdateFollowUp(followUp.id, { status: "Pending" });
      alert(result.error || "Failed to cancel follow-up.");
    }
  };

  const handleReschedule = async (id: string, date: string, time: string) => {
    const scheduledAt = new Date(`${date}T${time}:00+05:30`).toISOString();
    localUpdateFollowUp(id, { scheduledAt });
    setRescheduling(true);
    
    // We need the other fields for updateFollowUp. Let's find the existing followUp
    const existing = followUps.find(f => f.id === id);
    if (existing) {
      const formData = new FormData();
      formData.append("leadId", existing.leadId);
      formData.append("scheduledAt", scheduledAt);
      formData.append("type", existing.type);
      formData.append("note", existing.note);
      
      const result = await updateFollowUp(id, formData);
      setRescheduling(false);
      if (!result.success) {
        alert(result.error || "Failed to reschedule.");
        setRescheduleTarget(null);
      }
    } else {
      setRescheduling(false);
    }
    setRescheduleTarget(null);
  };

  const getEmptyConfig = (): { title: string; description: string } => {
    switch (activeTab) {
      case "overdue":
        return { title: "No overdue follow-ups!", description: "Everything is on schedule." };
      case "today":
        return { title: "No follow-ups due today.", description: "Add one to get started." };
      case "upcoming":
        return { title: "Nothing upcoming.", description: "Follow-ups beyond today will appear here." };
      case "completed":
        return { title: "No completed follow-ups yet.", description: "Mark follow-ups as done to see them here." };
      default:
        return { title: "No follow-ups.", description: "" };
    }
  };

  const emptyConfig = getEmptyConfig();

  return (
    <div className="flex h-full flex-col overflow-hidden pb-4">
      <PageHeader
        title="Follow-ups"
        description="Keep track of upcoming conversations and next steps."
        actions={
          <button
            type="button"
            onClick={() => { setEditingFollowUp(null); setFormOpen(true); }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800"
          >
            New Follow-up
          </button>
        }
      />

      {/* Tab navigation */}
      <div
        className="shrink-0 overflow-x-auto border-b border-slate-200 bg-white"
        role="tablist"
        aria-label="Follow-up status tabs"
      >
        <div className="flex min-w-max">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count =
              tab.key === "overdue"
                ? stats.Overdue
                : tab.key === "today"
                ? stats.Today
                : tab.key === "upcoming"
                ? stats.Upcoming
                : stats.Completed;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex items-center gap-2 whitespace-nowrap px-5 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-blue-700"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tab.label}
                <span
                  className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                    tab.key === "overdue" && count > 0
                      ? "bg-amber-100 text-amber-700"
                      : isActive
                        ? count > 0
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-500"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Follow-ups list */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto py-4">
        {filteredFollowUps.length === 0 ? (
          <FollowUpEmptyState title={emptyConfig.title} description={emptyConfig.description} />
        ) : (
          <div className="flex flex-col gap-3">
            {filteredFollowUps.map((followUp) => {
              const statusInfo = getFollowUpStatusInfo(followUp);
              return (
                <FollowUpCard
                  key={followUp.id}
                  followUp={followUp}
                  statusInfo={statusInfo}
                  onCall={() => { if (followUp.lead?.phone) window.location.href = getTelephoneHref(followUp.lead.phone); }}
                  onWhatsApp={() => { if (followUp.lead) openWhatsApp(followUp.lead); }}
                  onComplete={() => handleComplete(followUp)}
                  onReschedule={() => setRescheduleTarget(followUp)}
                  onCancel={() => handleCancel(followUp)}
                  onOpenLead={() => navigation?.openLead(followUp.leadId, "followups")}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <FollowUpForm
        isOpen={formOpen}
        followUp={editingFollowUp}
        defaultLeadId={leadParam || undefined}
        leads={leads}
        saving={saving}
        onClose={() => { if (!saving) { setFormOpen(false); setEditingFollowUp(null); } }}
        onSubmit={handleCreate}
      />

      <RescheduleDialog
        isOpen={!!rescheduleTarget}
        followUp={rescheduleTarget}
        saving={rescheduling}
        onClose={() => setRescheduleTarget(null)}
        onConfirm={({ date, time }) => handleReschedule(rescheduleTarget!.id, date, time)}
      />
    </div>
  );
}
