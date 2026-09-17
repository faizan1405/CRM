"use client";

import { useSearchParams } from "next/navigation";
import { useLeadNavigation } from "@/features/leads/lead-navigation-provider";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWhatsApp } from "@/components/whatsapp-context";
import { useCall } from "@/components/call-context";
import { statusFromDatabase } from "@/features/leads/types";
import { FollowUpCard } from "./follow-up-card";
import { FollowUpForm } from "./follow-up-form";
import { FollowUpEmptyState } from "./empty-state";
import { PageHeader } from "@/components/page-header";
import type { FollowUp, NewFollowUpInput } from "./types";
import { scheduleLeadFollowUp, markFollowUpComplete, cancelFollowUp } from "@/app/actions/follow-ups";
import {
  getFollowUpStatusInfo,
  isFollowUpToday,
  isFollowUpUpcoming,
  isFollowUpOverdue,
} from "./formatters";
import { useToast } from "@/components/toast-provider";

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
  const { openCallModal } = useCall();
  const { showToast } = useToast();
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

  const leadsList = useMemo(() => {
    if (editingFollowUp?.lead && !leads.some((l) => l.id === editingFollowUp.leadId)) {
      return [{ id: editingFollowUp.lead.id, name: editingFollowUp.lead.name }, ...leads];
    }
    return leads;
  }, [editingFollowUp, leads]);

  const handleSaveFollowUp = async (data: NewFollowUpInput) => {
    setSaving(true);
    try {
      const formData = new FormData();
      if (data.id) {
        formData.append("id", data.id);
      } else if (editingFollowUp?.id) {
        formData.append("id", editingFollowUp.id);
      }
      formData.append("leadId", data.leadId);
      formData.append("scheduledAt", data.scheduledAt);
      formData.append("type", data.type);
      formData.append("note", data.note);
      if (data.submissionId) {
        formData.append("submissionId", data.submissionId);
      }

      const result = await scheduleLeadFollowUp(formData);
      if (!result.success) {
        alert(result.error || "Failed to save follow-up.");
      } else {
        const saved = result.data;
        const isRescheduled = Boolean(editingFollowUp || data.id);
        const prevFollowUp = editingFollowUp;
        const prevScheduledAt = prevFollowUp?.scheduledAt ? new Date(prevFollowUp.scheduledAt) : undefined;
        const prevType = prevFollowUp?.type;

        setFollowUps((prev) => {
          const exists = prev.some((f) => f.id === saved.id);
          if (exists) {
            return prev.map((f) => (f.id === saved.id ? saved : f));
          }
          return [saved, ...prev];
        });
        setFormOpen(false);
        setEditingFollowUp(null);

        showToast(isRescheduled ? "Follow-up rescheduled" : "Follow-up scheduled", "success", {
          label: "Undo",
          onClick: async () => {
            if (isRescheduled && prevScheduledAt && prevType) {
              const undoRes = await import("@/app/actions/follow-ups").then(m => m.undoRescheduleFollowUp(
                saved.id,
                prevScheduledAt,
                prevType
              ));
              if (undoRes.success) {
                showToast("Follow-up reschedule undone", "info");
                setFollowUps((prev) => prev.map((f) => (f.id === saved.id ? undoRes.data : f)));
              }
            } else {
              const undoRes = await import("@/app/actions/follow-ups").then(m => m.undoCreateFollowUp(saved.id));
              if (undoRes.success) {
                showToast("Follow-up creation undone", "info");
                setFollowUps((prev) => prev.filter((f) => f.id !== saved.id));
              }
            }
          }
        });
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
                      ? "bg-red-100 text-red-700"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            {filteredFollowUps.map((followUp) => {
              const statusInfo = getFollowUpStatusInfo(followUp);
              return (
                <FollowUpCard
                  key={followUp.id}
                  followUp={followUp}
                  statusInfo={statusInfo}
                  onCall={() => {
                    if (followUp.lead?.phone) {
                      openCallModal({
                        id: followUp.lead.id,
                        name: followUp.lead.name,
                        phone: followUp.lead.phone,
                        status: (statusFromDatabase[followUp.lead.status as keyof typeof statusFromDatabase] ?? followUp.lead.status) as import("@/features/leads/types").LeadStatus,
                        email: "",
                        business: followUp.lead.business || "",
                        industry: "",
                        source: "",
                        budget: null,
                        quotedAmount: null,
                        lastContactDate: null,
                        nextFollowUpDate: null,
                        notes: "",
                        createdAt: "",
                        updatedAt: "",
                      });
                    }
                  }}
                  onWhatsApp={() => { if (followUp.lead) openWhatsApp(followUp.lead); }}
                  onComplete={() => handleComplete(followUp)}
                  onReschedule={() => {
                    setEditingFollowUp(followUp);
                    setFormOpen(true);
                  }}
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
        defaultLeadId={editingFollowUp?.leadId || leadParam || undefined}
        leads={leadsList}
        saving={saving}
        onClose={() => { if (!saving) { setFormOpen(false); setEditingFollowUp(null); } }}
        onSubmit={handleSaveFollowUp}
      />
    </div>
  );
}
