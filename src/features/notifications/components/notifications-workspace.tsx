"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLeadNavigation } from "@/features/leads/lead-navigation-provider";
import {
  Bell,
  CheckCheck,
  Flame,
  Clock,
  Sparkles,
  CheckCircle2,
  Search,
  X,
} from "lucide-react";
import type {
  SmartNotification,
  NotificationFilter,
  NotificationsProps,
} from "../types";

import { NotificationCard } from "./notification-card";

const FILTER_TABS: Array<{ value: NotificationFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "important", label: "Important" },
  { value: "today", label: "Today" },
  { value: "overdue", label: "Overdue" },
  { value: "ai_suggestions", label: "AI Suggestions" },
  { value: "resolved", label: "Resolved" },
];

export function NotificationsWorkspace({
  initialNotifications = [],
  onMarkRead,
  onMarkDone,
  onDismiss,
  onAddFollowUp,
  onOpenLead,
}: NotificationsProps) {
  const [notifications, setNotifications] = useState<SmartNotification[]>(
    initialNotifications
  );
  const [selectedFilter, setSelectedFilter] = useState<NotificationFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Unread count
  const unreadCount = useMemo(
    () => notifications.filter((n) => n.status === "unread").length,
    [notifications]
  );

  // Filtered list
  const filteredNotifications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return notifications.filter((n) => {
      // Exclude dismissed unless specifically searching
      if (n.status === "dismissed") return false;

      // Filter category
      let matchesFilter = true;
      if (selectedFilter === "critical") {
        matchesFilter = n.priority === "critical" && n.status !== "resolved";
      } else if (selectedFilter === "important") {
        matchesFilter = n.priority === "important" && n.status !== "resolved";
      } else if (selectedFilter === "today") {
        matchesFilter = n.type === "followup_due_today" || n.type === "new_lead_uncontacted";
      } else if (selectedFilter === "overdue") {
        matchesFilter = n.type === "overdue_followup" || n.type === "missed_followup";
      } else if (selectedFilter === "ai_suggestions") {
        matchesFilter =
          n.type === "ai_recommended_action" ||
          n.type === "hot_lead_attention" ||
          n.type === "lead_becoming_stale";
      } else if (selectedFilter === "resolved") {
        matchesFilter = n.status === "resolved";
      } else if (selectedFilter === "all") {
        matchesFilter = n.status !== "resolved";
      }

      // Search match
      const matchesSearch =
        !q ||
        n.leadName.toLowerCase().includes(q) ||
        (n.business && n.business.toLowerCase().includes(q)) ||
        n.reason.toLowerCase().includes(q) ||
        n.typeLabel.toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [notifications, selectedFilter, searchQuery]);

  // Groupings
  const groups = useMemo(() => {
    if (selectedFilter === "resolved") {
      return [
        {
          key: "resolved",
          title: "Resolved Notifications",
          icon: CheckCircle2,
          iconColor: "text-emerald-600",
          items: filteredNotifications,
        },
      ];
    }

    const attentionNow = filteredNotifications.filter(
      (n) =>
        (n.priority === "critical" ||
          n.type === "overdue_followup" ||
          n.type === "lead_becoming_stale") &&
        n.status !== "resolved"
    );

    const todayItems = filteredNotifications.filter(
      (n) =>
        (n.type === "followup_due_today" || n.type === "new_lead_uncontacted") &&
        !attentionNow.includes(n) &&
        n.status !== "resolved"
    );

    const otherUpcoming = filteredNotifications.filter(
      (n) => !attentionNow.includes(n) && !todayItems.includes(n) && n.status !== "resolved"
    );

    const result = [];
    if (attentionNow.length > 0) {
      result.push({
        key: "attention_now",
        title: "Needs Attention Now",
        icon: Flame,
        iconColor: "text-rose-600",
        items: attentionNow,
      });
    }
    if (todayItems.length > 0) {
      result.push({
        key: "today",
        title: "Today's Schedule & Inbound",
        icon: Clock,
        iconColor: "text-blue-600",
        items: todayItems,
      });
    }
    if (otherUpcoming.length > 0) {
      result.push({
        key: "upcoming",
        title: "Follow-ups & AI Insights",
        icon: Sparkles,
        iconColor: "text-indigo-600",
        items: otherUpcoming,
      });
    }

    return result;
  }, [filteredNotifications, selectedFilter]);

  // Actions
  const handleMarkAllRead = () => {
    setNotifications((prev) =>
      prev.map((n) => (n.status === "unread" ? { ...n, status: "read" } : n))
    );
  };

  const handleMarkDone = async (id: string) => {
    if (onMarkDone) await onMarkDone(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: "resolved" } : n))
    );
  };

  const handleDismiss = async (id: string) => {
    if (onDismiss) await onDismiss(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: "dismissed" } : n))
    );
  };

  const handleMarkRead = async (id: string) => {
    if (onMarkRead) await onMarkRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: "read" } : n))
    );
  };

  const router = useRouter();
  const navigation = useLeadNavigation();

  const handleOpenLead = (leadId: string) => {
    if (onOpenLead) {
      onOpenLead(leadId);
    } else {
      if (navigation) navigation.openLead(leadId);
      else router.push(`/leads?selected=${encodeURIComponent(leadId)}`);
    }
  };

  const handleAddFollowUp = (notification: SmartNotification) => {
    if (onAddFollowUp) {
      onAddFollowUp(notification);
    } else {
      if (!notification.leadId) return;
      if (navigation) navigation.openFollowUp({ id: notification.leadId, name: notification.leadName });
      else router.push(`/follow-ups?new=true&leadId=${encodeURIComponent(notification.leadId)}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
              Notifications & Attention Center
            </h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-rose-500 px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
                {unreadCount} new
              </span>
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Real-time sales alerts, overdue follow-ups, and AI recommendations.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors self-start sm:self-auto"
          >
            <CheckCheck size={15} className="text-blue-600" aria-hidden="true" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <label htmlFor="notifications-search-input" className="sr-only">
          Search notifications
        </label>
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          id="notifications-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search alerts, lead names, reasons, or recommendations..."
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 grid size-6 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Filter Tabs (Mobile Scrollable) */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1.5 min-w-max">
          {FILTER_TABS.map((tab) => {
            const isSelected = selectedFilter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setSelectedFilter(tab.value)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200/90 hover:bg-slate-50"
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications List Container */}
      <div className="space-y-6">
        {filteredNotifications.length === 0 ? (
          /* Empty State: You're all caught up 🎉 */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 sm:p-12 text-center">
            <span className="text-3xl select-none" aria-hidden="true">
              🎉
            </span>
            <h3 className="mt-3 text-base font-bold text-slate-900">
              You&apos;re all caught up 🎉
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-sm leading-relaxed">
              No pending notifications match your current filter. Great job staying on top of your sales pipeline!
            </p>
          </div>
        ) : (
          groups.map((group) => {
            const GroupIcon = group.icon || Bell;
            return (
              <section key={group.key} aria-label={group.title} className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <GroupIcon
                    size={14}
                    className={group.iconColor || "text-slate-400"}
                    aria-hidden="true"
                  />
                  <span>
                    {group.title} ({group.items.length})
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((notification) => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      onOpenLead={handleOpenLead}
                      onMarkDone={handleMarkDone}
                      onDismiss={handleDismiss}
                      onAddFollowUp={handleAddFollowUp}
                      onMarkRead={handleMarkRead}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
