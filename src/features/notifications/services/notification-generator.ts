import { db } from "@/lib/db";
import {
  NotificationPriority,
  NotificationType,
  NotificationStatus,
} from "@prisma/client";

/**
 * Returns today's ISO date string (YYYY-MM-DD) and current week identifier in Asia/Kolkata
 */
function getIndiaTimeTokens() {
  const now = new Date();
  const todayDateString = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  const weekString = `${now.getFullYear()}-W${weekNumber}`;

  return { todayDateString, weekString, now };
}

interface NotificationCandidate {
  leadId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  reason: string;
  recommendedAction: string;
  dedupeKey: string;
}

/**
 * Generates smart notifications from REAL deterministic CRM facts and stored AI attention insights.
 * Uses stable deduplication keys to prevent spamming duplicate notifications.
 * Runs efficiently without needing a new Groq request for every notification.
 */
export async function generateSmartNotifications(): Promise<{
  created: number;
  skipped: number;
}> {
  const { todayDateString, weekString, now } = getIndiaTimeTokens();
  const candidates: NotificationCandidate[] = [];

  // 1. Fetch Active Leads and Pending Follow-Ups
  const [activeLeads, pendingFollowUps] = await Promise.all([
    db.lead.findMany({
      where: { status: { notIn: ["WON", "LOST"] } },
      include: {
        aiInsight: true,
        activities: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        followUps: {
          where: { status: "PENDING" },
          orderBy: { scheduledAt: "asc" },
        },
      },
    }),
    db.followUp.findMany({
      where: { status: "PENDING" },
      include: { lead: true },
      orderBy: { scheduledAt: "asc" },
    }),
  ]);

  // Rule A: Overdue Follow-ups (CRITICAL)
  for (const f of pendingFollowUps) {
    if (!f.lead) continue;
    if (f.scheduledAt.getTime() < now.getTime()) {
      const scheduledStr = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(f.scheduledAt);

      candidates.push({
        leadId: f.leadId,
        type: NotificationType.OVERDUE_FOLLOWUP,
        priority: NotificationPriority.CRITICAL,
        title: `Overdue Follow-up: ${f.lead.name}`,
        reason: `A scheduled ${f.type} follow-up was due on ${scheduledStr} and has not been marked completed.`,
        recommendedAction: `Call or message ${f.lead.name} immediately to reconnect.`,
        dedupeKey: `overdue_${f.id}`,
      });
    }
  }

  // Rule B: Follow-ups Due Today (IMPORTANT)
  for (const f of pendingFollowUps) {
    if (!f.lead) continue;
    const fDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(f.scheduledAt);

    if (fDateStr === todayDateString && f.scheduledAt.getTime() >= now.getTime()) {
      const timeStr = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(f.scheduledAt);

      candidates.push({
        leadId: f.leadId,
        type: NotificationType.FOLLOWUP_DUE_TODAY,
        priority: NotificationPriority.IMPORTANT,
        title: `Follow-up Due Today: ${f.lead.name}`,
        reason: `Scheduled ${f.type} follow-up is due today at ${timeStr}.`,
        recommendedAction: `Prepare talking points and reach out at ${timeStr}.`,
        dedupeKey: `due_today_${f.id}_${todayDateString}`,
      });
    }
  }

  // Rule C: New Lead Not Contacted (> 24 hours ago, status NEW)
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  for (const lead of activeLeads) {
    if (lead.status === "NEW" && lead.createdAt < twentyFourHoursAgo) {
      candidates.push({
        leadId: lead.id,
        type: NotificationType.NEW_LEAD_NOT_CONTACTED,
        priority: NotificationPriority.IMPORTANT,
        title: `Uncontacted New Lead: ${lead.name}`,
        reason: `Lead was created over 24 hours ago and is still in NEW status with no contact logged.`,
        recommendedAction: `Initiate discovery call or send an introductory WhatsApp message.`,
        dedupeKey: `new_uncontacted_${lead.id}`,
      });
    }
  }

  // Rule D: Stale Leads (> 7 days without activity)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  for (const lead of activeLeads) {
    const lastActivity = lead.activities[0]?.createdAt || lead.updatedAt;
    if (lastActivity < sevenDaysAgo) {
      const daysInactive = Math.floor(
        (now.getTime() - lastActivity.getTime()) / (24 * 60 * 60 * 1000)
      );
      const isHighValue = (lead.budget ? Number(lead.budget) : 0) >= 50000;

      candidates.push({
        leadId: lead.id,
        type: NotificationType.STALE_LEAD,
        priority: isHighValue ? NotificationPriority.IMPORTANT : NotificationPriority.NORMAL,
        title: `Stale Lead: ${lead.name}`,
        reason: `No activity recorded for ${daysInactive} days in ${lead.status} stage.`,
        recommendedAction: `Send a check-in follow-up or evaluate lead qualification.`,
        dedupeKey: `stale_${lead.id}_${weekString}`,
      });
    }
  }

  // Rule E: Hot Lead Attention (AI Score >= 80)
  for (const lead of activeLeads) {
    if (lead.aiInsight && lead.aiInsight.score >= 80) {
      candidates.push({
        leadId: lead.id,
        type: NotificationType.HOT_LEAD_ATTENTION,
        priority: NotificationPriority.CRITICAL,
        title: `Hot Lead Attention: ${lead.name} (${lead.aiInsight.score}/100)`,
        reason: lead.aiInsight.scoreReason || `High buying intent detected with score of ${lead.aiInsight.score}.`,
        recommendedAction: lead.aiInsight.recommendedAction || `Reach out promptly to advance toward deal closure.`,
        dedupeKey: `hot_${lead.id}_${todayDateString}`,
      });
    }
  }

  // Rule F: High Value Opportunity (Quoted amount >= ₹100,000)
  for (const lead of activeLeads) {
    const amount = lead.quotedAmount ? Number(lead.quotedAmount) : lead.budget ? Number(lead.budget) : 0;
    if (amount >= 100000) {
      candidates.push({
        leadId: lead.id,
        type: NotificationType.HIGH_VALUE_OPPORTUNITY,
        priority: NotificationPriority.IMPORTANT,
        title: `High-Value Opportunity: ${lead.name} (₹${amount.toLocaleString("en-IN")})`,
        reason: `Significant pipeline deal of ₹${amount.toLocaleString("en-IN")} in ${lead.status} stage.`,
        recommendedAction: `Ensure high-touch attention and prompt response to client inquiries.`,
        dedupeKey: `high_val_${lead.id}`,
      });
    }
  }

  // Rule G: Proposal Follow-up (PROPOSAL_SENT without pending follow-up)
  for (const lead of activeLeads) {
    if (lead.status === "PROPOSAL_SENT" && lead.followUps.length === 0) {
      candidates.push({
        leadId: lead.id,
        type: NotificationType.PROPOSAL_FOLLOWUP,
        priority: NotificationPriority.IMPORTANT,
        title: `Proposal Follow-up Needed: ${lead.name}`,
        reason: `Proposal is with the client, but no future follow-up is scheduled.`,
        recommendedAction: `Schedule a follow-up call to review quotation and address questions.`,
        dedupeKey: `proposal_followup_${lead.id}_${weekString}`,
      });
    }
  }

  // Rule H: AI Recommended Action (from stored LeadAIInsight if CRITICAL)
  for (const lead of activeLeads) {
    if (
      lead.aiInsight &&
      lead.aiInsight.priority === "CRITICAL" &&
      lead.aiInsight.score < 80 // avoid duplicate with HOT_LEAD_ATTENTION
    ) {
      candidates.push({
        leadId: lead.id,
        type: NotificationType.AI_RECOMMENDED_ACTION,
        priority: NotificationPriority.CRITICAL,
        title: `Action Required: ${lead.name}`,
        reason: lead.aiInsight.scoreReason,
        recommendedAction: lead.aiInsight.recommendedAction,
        dedupeKey: `ai_action_${lead.id}_${todayDateString}`,
      });
    }
  }

  // 2. Batch Persist Candidates with In-Memory and DB Deduplication
  if (candidates.length === 0) {
    return { created: 0, skipped: 0 };
  }

  // Deduplicate candidates in-memory first by dedupeKey
  const uniqueCandidatesMap = new Map<string, NotificationCandidate>();
  for (const c of candidates) {
    if (!uniqueCandidatesMap.has(c.dedupeKey)) {
      uniqueCandidatesMap.set(c.dedupeKey, c);
    }
  }
  const uniqueCandidates = Array.from(uniqueCandidatesMap.values());
  const allKeys = uniqueCandidates.map((c) => c.dedupeKey);

  // Fetch existing records in ONE single database query
  const existingRecords = await db.salesNotification.findMany({
    where: { dedupeKey: { in: allKeys } },
    select: { id: true, dedupeKey: true, status: true },
  });
  const existingKeyMap = new Map(existingRecords.map((r) => [r.dedupeKey, r]));

  const toCreate = uniqueCandidates.filter((c) => !existingKeyMap.has(c.dedupeKey));
  const skipped = uniqueCandidates.length - toCreate.length;

  let created = 0;
  if (toCreate.length > 0) {
    const validLeads = await db.lead.findMany({
      where: { id: { in: toCreate.map((c) => c.leadId) } },
      select: { id: true },
    });
    const validLeadIdSet = new Set(validLeads.map((l) => l.id));
    const validToCreate = toCreate.filter((c) => validLeadIdSet.has(c.leadId));

    if (validToCreate.length > 0) {
      const insertResult = await db.salesNotification.createMany({
        data: validToCreate.map((item) => ({
          leadId: item.leadId,
          type: item.type,
          priority: item.priority,
          title: item.title,
          reason: item.reason,
          recommendedAction: item.recommendedAction,
          dedupeKey: item.dedupeKey,
          status: NotificationStatus.UNREAD,
        })),
        skipDuplicates: true,
      });
      created = insertResult.count;
    }
  }

  return { created, skipped };
}
