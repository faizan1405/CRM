import { db } from "@/lib/db";
import type {
  MobileAlertItem,
  MobileAlertCategory,
  MobilePushPayload,
} from "../types/mobile";

export interface AlertEngineOptions {
  reminderWindowMinutes?: number; // e.g. 60 minutes ahead
  now?: Date;
}

export function formatISTTime(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatISTDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Builds standard mobile push payload with action buttons and deep linking
 */
export function buildMobilePushPayload(options: {
  category: MobileAlertCategory;
  title: string;
  body: string;
  tag: string;
  leadId: string;
  leadName: string;
  phone?: string | null;
  scheduledAt?: string | null;
  requireInteraction?: boolean;
}): MobilePushPayload {
  const actions =
    options.category === "OVERDUE_FOLLOWUP" || options.category === "FOLLOWUP_DUE"
      ? [
          { action: "call", title: "📞 Call Now" },
          { action: "reschedule", title: "📅 Reschedule" },
        ]
      : options.category === "FOLLOWUP_REMINDER"
      ? [
          { action: "call", title: "📞 Call Now" },
          { action: "view", title: "👁 View Lead" },
        ]
      : [
          { action: "call", title: "⚡ Contact Now" },
          { action: "view", title: "🔍 Review Details" },
        ];

  return {
    title: options.title,
    body: options.body,
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    tag: options.tag,
    data: {
      category: options.category,
      leadId: options.leadId,
      leadName: options.leadName,
      phone: options.phone || undefined,
      scheduledAt: options.scheduledAt || undefined,
      url: `/leads/${options.leadId}`,
      actionType: actions[0]?.action as "call" | "view" | "reschedule",
    },
    actions,
    vibrate:
      options.category === "OVERDUE_FOLLOWUP" || options.category === "FOLLOWUP_DUE"
        ? [300, 100, 300, 100, 300]
        : [200, 100, 200],
    requireInteraction:
      options.requireInteraction ??
      (options.category === "OVERDUE_FOLLOWUP" || options.category === "FOLLOWUP_DUE"),
  };
}

/**
 * Evaluates CRM data and generates candidate mobile alerts for:
 * 1. Follow-up due now (reached or passed scheduledAt)
 * 2. Follow-up reminders (upcoming within window)
 * 3. Overdue follow-ups (>60 min overdue)
 * 4. Urgent / High-priority leads
 */
export async function evaluateMobileAlerts(
  options: AlertEngineOptions = {}
): Promise<MobileAlertItem[]> {
  const now = options.now ?? new Date();
  const reminderWindowMinutes = options.reminderWindowMinutes ?? 60;
  const reminderThreshold = new Date(now.getTime() + reminderWindowMinutes * 60 * 1000);
  const todayIST = formatISTDate(now);

  const alerts: MobileAlertItem[] = [];

  // Fetch pending follow-ups with lead information
  const rawPendingFollowUps = await db.followUp.findMany({
    where: {
      status: "PENDING",
      lead: { isWaste: false, status: { notIn: ["WON", "LOST"] } },
    },
    include: { lead: true },
    orderBy: { updatedAt: "desc" },
  });

  // Enforce single canonical active follow-up per lead
  const pendingFollowUps: typeof rawPendingFollowUps = [];
  const seenLeadIds = new Set<string>();
  for (const f of rawPendingFollowUps) {
    if (!seenLeadIds.has(f.leadId)) {
      seenLeadIds.add(f.leadId);
      pendingFollowUps.push(f);
    }
  }

  for (const f of pendingFollowUps) {
    if (!f.lead) continue;
    const scheduledTime = f.scheduledAt.getTime();
    const scheduledISTDate = formatISTDate(f.scheduledAt);
    const scheduledISTTime = formatISTTime(f.scheduledAt);

    // 1. FOLLOW-UP DUE (scheduledAt reached or passed)
    if (scheduledTime <= now.getTime()) {
      // Due alert has durable dedupe key per specific scheduled instance
      const dueDedupeKey = `mobile_due_${f.id}_${f.scheduledAt.getTime()}`;
      const contextSnippet = f.note?.trim()
        ? ` Note: ${f.note.trim().slice(0, 60)}`
        : ` Type: ${f.type}`;
      const dueTitle = `⏰ Follow-up due now: ${f.lead.name}`;
      const dueBody = `Follow-up due now: ${f.lead.name} scheduled for ${scheduledISTTime}.${contextSnippet}`;

      const duePayload = buildMobilePushPayload({
        category: "FOLLOWUP_DUE",
        title: dueTitle,
        body: dueBody,
        tag: dueDedupeKey,
        leadId: f.lead.id,
        leadName: f.lead.name,
        phone: f.lead.phone,
        scheduledAt: f.scheduledAt.toISOString(),
        requireInteraction: true,
      });

      alerts.push({
        id: `alert-due-${f.id}-${f.scheduledAt.getTime()}`,
        category: "FOLLOWUP_DUE",
        priority: "CRITICAL",
        title: dueTitle,
        body: dueBody,
        leadId: f.lead.id,
        leadName: f.lead.name,
        phone: f.lead.phone,
        scheduledAt: f.scheduledAt.toISOString(),
        payload: duePayload,
        dedupeKey: dueDedupeKey,
        createdAt: now.toISOString(),
      });

      // If significantly overdue (> 60 minutes), also include OVERDUE_FOLLOWUP alert for daily escalation
      if (now.getTime() - scheduledTime >= 60 * 60 * 1000) {
        const overdueDedupeKey = `mobile_overdue_${f.id}_${todayIST}`;
        const overdueTitle = `⚠️ Overdue Follow-up: ${f.lead.name}`;
        const overdueBody = `Scheduled ${f.type} follow-up was due at ${scheduledISTTime}. Tap to call or reschedule immediately.`;
        const overduePayload = buildMobilePushPayload({
          category: "OVERDUE_FOLLOWUP",
          title: overdueTitle,
          body: overdueBody,
          tag: overdueDedupeKey,
          leadId: f.lead.id,
          leadName: f.lead.name,
          phone: f.lead.phone,
          scheduledAt: f.scheduledAt.toISOString(),
          requireInteraction: true,
        });

        alerts.push({
          id: `alert-overdue-${f.id}`,
          category: "OVERDUE_FOLLOWUP",
          priority: "CRITICAL",
          title: overdueTitle,
          body: overdueBody,
          leadId: f.lead.id,
          leadName: f.lead.name,
          phone: f.lead.phone,
          scheduledAt: f.scheduledAt.toISOString(),
          payload: overduePayload,
          dedupeKey: overdueDedupeKey,
          createdAt: now.toISOString(),
        });
      }

      continue;
    }

    // 2. FOLLOW-UP REMINDER (upcoming within window, scheduledTime > now.getTime())
    if (scheduledTime <= reminderThreshold.getTime()) {
      const dedupeKey = `mobile_reminder_${f.id}_${todayIST}`;
      const title = `⏰ Follow-up Reminder: ${f.lead.name}`;
      const body = `Upcoming ${f.type} follow-up scheduled for ${scheduledISTTime} today.`;
      const payload = buildMobilePushPayload({
        category: "FOLLOWUP_REMINDER",
        title,
        body,
        tag: dedupeKey,
        leadId: f.lead.id,
        leadName: f.lead.name,
        phone: f.lead.phone,
        scheduledAt: f.scheduledAt.toISOString(),
      });

      alerts.push({
        id: `alert-reminder-${f.id}`,
        category: "FOLLOWUP_REMINDER",
        priority: "HIGH",
        title,
        body,
        leadId: f.lead.id,
        leadName: f.lead.name,
        phone: f.lead.phone,
        scheduledAt: f.scheduledAt.toISOString(),
        payload,
        dedupeKey,
        createdAt: now.toISOString(),
      });
    }
  }

  // 3. URGENT / HIGH-PRIORITY LEADS
  const urgentLeads = await db.lead.findMany({
    where: {
      isWaste: false,
      status: { notIn: ["WON", "LOST"] },
      OR: [
        { quotedAmount: { gte: 50000 } },
        { budget: { gte: 50000 } },
        { status: "NEW", lastContactDate: null },
        { aiInsight: { priority: "CRITICAL" } },
        { aiInsight: { score: { gte: 80 } } },
      ],
    },
    include: { aiInsight: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  for (const lead of urgentLeads) {
    const isHighValue = (Number(lead.quotedAmount) >= 50000 || Number(lead.budget) >= 50000);
    const isUncontactedNew = lead.status === "NEW" && !lead.lastContactDate;
    const isAiUrgent = lead.aiInsight?.priority === "CRITICAL" || (lead.aiInsight?.score ?? 0) >= 80;

    if (isHighValue || isUncontactedNew || isAiUrgent) {
      const dedupeKey = `mobile_urgent_${lead.id}_${todayIST}`;
      const reasonDesc = isHighValue
        ? `High-value opportunity (₹${(lead.quotedAmount || lead.budget)?.toLocaleString()})`
        : isAiUrgent
        ? "AI Attention flagged as Urgent"
        : "Uncontacted new inbound lead";

      const title = `🔥 Priority Lead: ${lead.name}`;
      const body = `${reasonDesc}. Immediate outreach recommended.`;

      const payload = buildMobilePushPayload({
        category: "URGENT_LEAD",
        title,
        body,
        tag: dedupeKey,
        leadId: lead.id,
        leadName: lead.name,
        phone: lead.phone,
      });

      alerts.push({
        id: `alert-urgent-${lead.id}`,
        category: "URGENT_LEAD",
        priority: isHighValue || isAiUrgent ? "CRITICAL" : "HIGH",
        title,
        body,
        leadId: lead.id,
        leadName: lead.name,
        phone: lead.phone,
        payload,
        dedupeKey,
        createdAt: now.toISOString(),
      });
    }
  }

  return alerts;
}
