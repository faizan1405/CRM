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
import { PageHeader, Segmented } from "@/components/crm/primitives";
import { Plus } from "lucide-react";
import type { FollowUp, NewFollowUpInput } from "./types";
import { scheduleLeadFollowUp, markFollowUpComplete, cancelFollowUp } from "@/app/actions/follow-ups";
import { togglePinLead } from "@/app/actions/leads";
import {
  getFollowUpStatusInfo,
  isFollowUpToday,
  isFollowUpUpcoming,
  isFollowUpOverdue,
} from "./formatters";
import { useToast } from "@/components/toast-provider";

type TabKey = "today" | "overdue" | "upcoming";

const TABS: { key: TabKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "overdue", label: "Overdue" },
  { key: "upcoming", label: "Upcoming" },
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
  const { showToast, showUndoToast } = useToast();
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

  const handleTogglePin = async (followUp: FollowUp) => {
    if (!followUp.lead) return;
    const currentPinned = Boolean(followUp.lead.isPinned);
    const nextPinned = !currentPinned;
    setFollowUps((prev) =>
      prev.map((f) =>
        f.leadId === followUp.leadId && f.lead
          ? { ...f, lead: { ...f.lead, isPinned: nextPinned } }
          : f
      )
    );
    try {
      const result = await togglePinLead(followUp.leadId, nextPinned);
      if (!result.success) {
        setFollowUps((prev) =>
          prev.map((f) =>
            f.leadId === followUp.leadId && f.lead
              ? { ...f, lead: { ...f.lead, isPinned: currentPinned } }
              : f
          )
        );
        showToast(result.error, "error");
      }
    } catch {
      setFollowUps((prev) =>
        prev.map((f) =>
          f.leadId === followUp.leadId && f.lead
            ? { ...f, lead: { ...f.lead, isPinned: currentPinned } }
            : f
        )
      );
      showToast("Failed to update pin state.", "error");
    }
  };

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

        const msg = isRescheduled ? "Follow-up rescheduled" : "Follow-up scheduled";
        if (result.undoId) {
          showUndoToast(msg, result.undoId);
        } else {
          showToast(msg, "success");
        }
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
    } else {
      if (result.undoId) {
        showUndoToast("Follow-up completed", result.undoId);
      } else {
        showToast("Follow-up completed", "success");
      }
    }
  };

  const handleCancel = async (followUp: FollowUp) => {
    localUpdateFollowUp(followUp.id, { status: "Cancelled" });
    const result = await cancelFollowUp(followUp.id);
    if (!result.success) {
      localUpdateFollowUp(followUp.id, { status: "Pending" });
      alert(result.error || "Failed to cancel follow-up.");
    } else {
      if (result.undoId) {
        showUndoToast("Follow-up cancelled", result.undoId);
      } else {
        showToast("Follow-up cancelled", "success");
      }
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
      default:
        return { title: "No follow-ups.", description: "" };
    }
  };

  const emptyConfig = getEmptyConfig();

  return (
    <div className="flex h-full flex-col overflow-hidden pb-4">
      <PageHeader
        title="Follow-ups"
        description={
          <>
            <span className="font-medium text-destructive">{stats.Overdue} overdue</span> ·{" "}
            <span className="font-medium text-foreground">{stats.Today} today</span> ·{" "}
            <span className="text-muted-foreground">{stats.Overdue + stats.Today + stats.Upcoming} pending in total</span>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="rounded-[10px] bg-muted p-1"
              role="tablist"
              aria-label="Follow-up status tabs"
            >
              <div className="flex gap-1">
                {TABS.map((tab) => {
                  const isActive = activeTab === tab.key;
                  const count =
                    tab.key === "overdue"
                      ? stats.Overdue
                      : tab.key === "today"
                      ? stats.Today
                      : stats.Upcoming;
                  return (
                    <button
                      key={tab.key}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveTab(tab.key)}
                      className={`press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-all duration-200 cursor-pointer ${
                        isActive
                          ? "bg-card text-foreground shadow-[var(--shadow-card)] font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`tabular text-[11.5px] px-1.5 py-0.2 rounded-full ${
                          tab.key === "overdue" && count > 0
                            ? "bg-destructive/15 text-destructive font-semibold"
                            : isActive
                            ? "bg-accent text-accent-foreground"
                            : "text-subtle"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => { setEditingFollowUp(null); setFormOpen(true); }}
              className="press inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-ink px-4 text-[13px] font-medium text-ink-foreground shadow-sm hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>New Follow-up</span>
            </button>
          </div>
        }
      />

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
                  onTogglePin={() => handleTogglePin(followUp)}
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
