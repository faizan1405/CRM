"use server";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { LeadStatus, FollowUpStatus } from "@prisma/client";
import type { AIAttentionSummaryItem } from "@/features/ai-attention/types";
import { deriveAIAttention } from "@/features/ai-attention/helpers";
import { statusFromDatabase } from "@/features/leads/types";

class UserFacingError extends Error {}

export type PriorityItem = {
  id: string;
  leadId: string;
  leadName: string;
  business: string;
  actionNeeded: string;
  time: string;
  phone: string;
  status: string;
  statusColor: string;
  type: "OVERDUE" | "TODAY" | "PROPOSAL" | "NEW";
};

export type DashboardData = {
  kpis: {
    totalLeads: number;
    newLeads: number;
    qualifiedLeads: number;
    wonClients: number;
    followUpsToday: number;
    wonRevenue: number;
  };
  needsAttention: {
    overdueFollowUps: number;
    proposalsPending: number;
    leadsNotContacted: number;
  };
  priorities: PriorityItem[];
  attentionLeads: AIAttentionSummaryItem[];
  pipeline: {
    new: number;
    contacted: number;
    qualified: number;
    proposal: number;
    won: number;
    lost: number;
  };
  revenue: {
    won: number;
    openPipeline: number;
    avgWonDeal: number;
  };
  todayFollowUps: Array<{
    id: string;
    leadId: string;
    leadName: string;
    type: string;
    time: string;
  }>;
  recentActivity: Array<{
    activityId: string;
    message: string;
    leadName: string;
    leadId: string;
    createdAt: string;
    type: string;
  }>;
};


export async function getDashboardData(): Promise<{ success: boolean; data?: DashboardData; error?: string }> {
  try {
    const session = await getSession();
    if (!session || typeof session.id !== "string") {
      throw new UserFacingError("You must be signed in.");
    }

    const now = new Date();
    
    const todayIST = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric", month: "numeric", day: "numeric"
    }).format(now);
    
    // Parse the MM/DD/YYYY from Intl.DateTimeFormat
    const [m, d, y] = todayIST.split('/').map(Number);

    // Convert IST midnight to UTC (subtract 5 hours 30 mins)
    const startOfTodayIST = new Date(Date.UTC(y, m - 1, d, -5, -30, 0, 0));
    const endOfTodayIST = new Date(Date.UTC(y, m - 1, d, 18, 29, 59, 999));

    // Parallel aggregate queries
    const [
      totalLeads,
      statusCounts,
      wonRevenueAgg,
      openPipelineAgg,
      overdueFollowUpsCount,
      todayFollowUpsCount,
      todayFollowUpsList,
      overdueFollowUpsList,
      proposalsPendingList,
      newLeadsList,
      recentActivities,
      activeLeadsWithAI
    ] = await Promise.all([
      db.lead.count({ where: { isWaste: false } }),
      db.lead.groupBy({ by: ["status"], _count: true, where: { isWaste: false } }),
      db.lead.aggregate({ _sum: { quotedAmount: true }, _avg: { quotedAmount: true }, where: { status: LeadStatus.WON, isWaste: false } }),
      db.lead.aggregate({ _sum: { quotedAmount: true }, where: { status: { in: [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED, LeadStatus.PROPOSAL_SENT] }, isWaste: false } }),
      db.followUp.count({ where: { status: FollowUpStatus.PENDING, scheduledAt: { lt: startOfTodayIST } } }),
      db.followUp.count({ where: { status: FollowUpStatus.PENDING, scheduledAt: { gte: startOfTodayIST, lte: endOfTodayIST } } }),
      db.followUp.findMany({
        where: { status: FollowUpStatus.PENDING, scheduledAt: { gte: startOfTodayIST, lte: endOfTodayIST } },
        include: { lead: { select: { id: true, name: true, phone: true, business: true, status: true } } },
        orderBy: { scheduledAt: "asc" }
      }),
      db.followUp.findMany({
        where: { status: FollowUpStatus.PENDING, scheduledAt: { lt: startOfTodayIST } },
        include: { lead: { select: { id: true, name: true, phone: true, business: true, status: true } } },
        orderBy: { scheduledAt: "asc" },
        take: 5
      }),
      db.lead.findMany({
        where: { isWaste: false,  status: LeadStatus.PROPOSAL_SENT },
        select: { id: true, name: true, phone: true, business: true, status: true },
        orderBy: { updatedAt: "desc" },
        take: 5
      }),
      db.lead.findMany({
        where: { isWaste: false,  status: LeadStatus.NEW },
        select: { id: true, name: true, phone: true, business: true, status: true },
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      db.leadActivity.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: { lead: { select: { id: true, name: true } } }
      }),
      db.lead.findMany({
        where: { isWaste: false, 
          status: { in: [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED, LeadStatus.PROPOSAL_SENT] },
        },
        include: {
          aiInsight: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 25,
      })
    ]);

    // Format KPIs
    const statusMap = Object.fromEntries(statusCounts.map(s => [s.status, s._count]));
    const getCount = (status: LeadStatus) => statusMap[status] || 0;

    const wonRevenue = Number(wonRevenueAgg._sum.quotedAmount || 0);
    const avgWonDeal = Number(wonRevenueAgg._avg.quotedAmount || 0);
    const openPipeline = Number(openPipelineAgg._sum.quotedAmount || 0);

    // Format Priorities
    const priorities: PriorityItem[] = [];
    const seenLeadIds = new Set<string>();

    const addPriority = (item: PriorityItem) => {
      if (!seenLeadIds.has(item.leadId) && priorities.length < 8) {
        priorities.push(item);
        seenLeadIds.add(item.leadId);
      }
    };

    const statusColors: Record<string, string> = {
      NEW: "bg-blue-100 text-blue-700",
      CONTACTED: "bg-cyan-100 text-cyan-700",
      QUALIFIED: "bg-purple-100 text-purple-700",
      PROPOSAL_SENT: "bg-amber-100 text-amber-700",
      WON: "bg-green-100 text-green-700",
      LOST: "bg-slate-100 text-slate-700",
    };
    
    const formatTimeIST = (date: Date) => {
      return date.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: 'numeric', minute: '2-digit' });
    };

    overdueFollowUpsList.forEach(f => addPriority({
      id: f.id,
      leadId: f.leadId,
      leadName: f.lead?.name || "Unknown Lead",
      business: f.lead?.business || "Unknown Business",
      actionNeeded: `Overdue: ${f.type}`,
      time: formatTimeIST(f.scheduledAt),
      phone: f.lead?.phone || "",
      status: f.lead ? f.lead.status.replace("_", " ") : "NEW",
      statusColor: (f.lead ? statusColors[f.lead.status] : null) || statusColors.NEW,
      type: "OVERDUE"
    }));

    todayFollowUpsList.forEach(f => addPriority({
      id: f.id,
      leadId: f.leadId,
      leadName: f.lead?.name || "Unknown Lead",
      business: f.lead?.business || "Unknown Business",
      actionNeeded: `Follow-up: ${f.type}`,
      time: formatTimeIST(f.scheduledAt),
      phone: f.lead?.phone || "",
      status: f.lead ? f.lead.status.replace("_", " ") : "NEW",
      statusColor: (f.lead ? statusColors[f.lead.status] : null) || statusColors.NEW,
      type: "TODAY"
    }));

    proposalsPendingList.forEach(l => addPriority({
      id: l.id,
      leadId: l.id,
      leadName: l.name,
      business: l.business || "Unknown Business",
      actionNeeded: "Review Proposal",
      time: "Pending",
      phone: l.phone,
      status: "Proposal Sent",
      statusColor: statusColors.PROPOSAL_SENT,
      type: "PROPOSAL"
    }));

    newLeadsList.forEach(l => addPriority({
      id: l.id,
      leadId: l.id,
      leadName: l.name,
      business: l.business || "Unknown Business",
      actionNeeded: "First Contact",
      time: "ASAP",
      phone: l.phone,
      status: "New",
      statusColor: statusColors.NEW,
      type: "NEW"
    }));

    // Format AI Attention Leads from stored snapshots
    const attentionLeads: AIAttentionSummaryItem[] = activeLeadsWithAI.map((l) => {
      const serialized = {
        id: l.id,
        name: l.name,
        phone: l.phone,
        email: l.email ?? "",
        business: l.business ?? "",
        industry: l.industry ?? "",
        source: l.leadSource ?? "",
        budget: l.budget === null ? null : Number(l.budget),
        status: statusFromDatabase[l.status as keyof typeof statusFromDatabase] || l.status,
        quotedAmount: l.quotedAmount === null ? null : Number(l.quotedAmount),
        lastContactDate: l.lastContactDate?.toISOString().slice(0, 10) ?? null,
        nextFollowUpDate: l.nextFollowUpDate?.toISOString().slice(0, 10) ?? null,
        notes: l.notes ?? "",
        createdAt: l.createdAt.toISOString().slice(0, 10),
        updatedAt: l.updatedAt.toISOString(),
        aiInsight: l.aiInsight,
      };

      const ai = deriveAIAttention(serialized);
      let attentionReason = ai.scoreReason;
      if (l.nextFollowUpDate && new Date(l.nextFollowUpDate).getTime() < now.getTime()) {
        attentionReason = "Overdue follow-up";
      } else if (ai.staleStatus.isStale) {
        attentionReason = ai.staleStatus.staleFor;
      } else if (ai.scoreCategory === "hot") {
        attentionReason = "High-value active opportunity";
      }

      return {
        id: l.id,
        leadId: l.id,
        leadName: l.name,
        business: l.business || undefined,
        phone: l.phone,
        score: ai.score,
        scoreCategory: ai.scoreCategory,
        priority: ai.priority,
        attentionReason,
        recommendedAction: ai.recommendedAction,
        stage: serialized.status,
        staleFor: ai.staleStatus.staleFor,
        stageAge: ai.stageAging.timeInStage,
      };
    });

    const priorityWeight = { critical: 3, important: 2, normal: 1 };
    attentionLeads.sort((a, b) => {
      const pDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (pDiff !== 0) return pDiff;
      return b.score - a.score;
    });

    // Format Recent Activity Time
    const formatTimeAgo = (date: Date) => {
      const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (seconds < 60) return "Just now";
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''} ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
      const days = Math.floor(hours / 24);
      if (days === 1) return "Yesterday";
      return `${days} days ago`;
    };

    return {
      success: true,
      data: {
        kpis: {
          totalLeads,
          newLeads: getCount(LeadStatus.NEW),
          qualifiedLeads: getCount(LeadStatus.QUALIFIED),
          wonClients: getCount(LeadStatus.WON),
          followUpsToday: todayFollowUpsCount,
          wonRevenue,
        },
        needsAttention: {
          overdueFollowUps: overdueFollowUpsCount,
          proposalsPending: getCount(LeadStatus.PROPOSAL_SENT),
          leadsNotContacted: getCount(LeadStatus.NEW),
        },
        priorities,
        attentionLeads: attentionLeads.slice(0, 8),
        pipeline: {
          new: getCount(LeadStatus.NEW),
          contacted: getCount(LeadStatus.CONTACTED),
          qualified: getCount(LeadStatus.QUALIFIED),
          proposal: getCount(LeadStatus.PROPOSAL_SENT),
          won: getCount(LeadStatus.WON),
          lost: getCount(LeadStatus.LOST),
        },
        revenue: {
          won: wonRevenue,
          openPipeline,
          avgWonDeal,
        },
        todayFollowUps: todayFollowUpsList.map(f => ({
          id: f.id,
          leadId: f.leadId,
          leadName: f.lead?.name || "Unknown Lead",
          type: f.type,
          time: formatTimeIST(f.scheduledAt),
        })),
        recentActivity: recentActivities.map(a => ({
          activityId: a.id,
          message: a.message,
          leadName: a.lead?.name || "Unknown Lead",
          leadId: a.leadId,
          createdAt: formatTimeAgo(a.createdAt),
          type: a.type
        }))
      }
    };

  } catch (error) {
    if (error instanceof UserFacingError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Could not load dashboard data." };
  }
}
