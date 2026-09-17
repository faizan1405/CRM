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
    options.category === "OVERDUE_FOLLOWUP"
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
    vibrate: options.category === "OVERDUE_FOLLOWUP" ? [300, 100, 300, 100, 300] : [200, 100, 200],
    requireInteraction: options.requireInteraction ?? (options.category === "OVERDUE_FOLLOWUP"),
  };
}

/**
 * Evaluates CRM data and generates candidate mobile alerts for:
 * 1. Follow-up reminders (due soon or today)
 * 2. Overdue follow-ups
 * 3. Urgent / High-priority leads
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
  const pendingFollowUps = await db.followUp.findMany({
    where: {
      status: "PENDING",
      lead: { isWaste: false, status: { notIn: ["WON", "LOST"] } },
    },
    include: { lead: true },
    orderBy: { scheduledAt: "asc" },
  });

  for (const f of pendingFollowUps) {
    if (!f.lead) continue;
    const scheduledTime = f.scheduledAt.getTime();
    const scheduledISTDate = formatISTDate(f.scheduledAt);
    const scheduledISTTime = formatISTTime(f.scheduledAt);

    // 1. OVERDUE FOLLOW-UP
    if (scheduledTime < now.getTime()) {
      const dedupeKey = `mobile_overdue_${f.id}_${todayIST}`;
      const title = `⚠️ Overdue Follow-up: ${f.lead.name}`;
      const body = `Scheduled ${f.type} follow-up was due at ${scheduledISTTime}. Tap to call or reschedule immediately.`;
      const payload = buildMobilePushPayload({
        category: "OVERDUE_FOLLOWUP",
        title,
        body,
        tag: dedupeKey,
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
      continue;
    }

    // 2. FOLLOW-UP REMINDER (within window or due today)
    if (scheduledTime <= reminderThreshold.getTime() || scheduledISTDate === todayIST) {
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
