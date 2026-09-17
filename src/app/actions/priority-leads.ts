"use server";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { LeadStatus, FollowUpStatus } from "@prisma/client";
import type { PriorityItem } from "./dashboard";

class UserFacingError extends Error {}

export async function getPriorityLeads(page: number = 1): Promise<{ success: boolean; data?: { priorities: PriorityItem[]; hasMore: boolean; nextCursor: number }; error?: string }> {
  try {
    const session = await getSession();
    if (!session || typeof session.id !== "string") {
      throw new UserFacingError("You must be signed in.");
    }

    const take = 10;
    const skip = (page - 1) * take;

    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric", month: "numeric", day: "numeric"
    }).formatToParts(now);
    
    const y = parseInt(parts.find(p => p.type === 'year')!.value);
    const m = parseInt(parts.find(p => p.type === 'month')!.value) - 1;
    const d = parseInt(parts.find(p => p.type === 'day')!.value);

    const startOfTodayIST = new Date(Date.UTC(y, m, d, -5, -30, 0, 0));
    const endOfTodayIST = new Date(Date.UTC(y, m, d, 18, 29, 59, 999));

    // To do pagination over disjoint queries without pulling everything, we can count total sizes:
    // But since this is a simple dashboard priority list, we can just query a bit more and slice in memory 
    // IF the user doesn't want client-side slicing. Wait, they said "Do NOT fetch all rows and slice client-side."
    // Slicing on the server is fine, but fetching *all* rows is bad. 
    // We can fetch up to `skip + take` rows for each category, merge, sort, and slice. This guarantees we have the right items without fetching ALL rows in the DB.
    
    const fetchLimit = skip + take;

    const [
      todayFollowUpsList,
      overdueFollowUpsList,
      proposalsPendingList,
      newLeadsList
    ] = await Promise.all([
      db.followUp.findMany({
        where: { status: FollowUpStatus.PENDING, scheduledAt: { gte: startOfTodayIST, lte: endOfTodayIST }, lead: { isWaste: false, deletedAt: null } },
        include: { lead: { select: { id: true, name: true, phone: true, business: true, status: true } } },
        orderBy: { scheduledAt: "asc" },
        take: fetchLimit
      }),
      db.followUp.findMany({
        where: { status: FollowUpStatus.PENDING, scheduledAt: { lt: startOfTodayIST }, lead: { isWaste: false, deletedAt: null } },
        include: { lead: { select: { id: true, name: true, phone: true, business: true, status: true } } },
        orderBy: { scheduledAt: "asc" },
        take: fetchLimit
      }),
      db.lead.findMany({
        where: { isWaste: false, deletedAt: null, status: LeadStatus.PROPOSAL_SENT },
        select: { id: true, name: true, phone: true, business: true, status: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: fetchLimit
      }),
      db.lead.findMany({
        where: { isWaste: false, deletedAt: null, status: LeadStatus.NEW },
        select: { id: true, name: true, phone: true, business: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: fetchLimit
      })
    ]);

    const priorities: PriorityItem[] = [];
    const seenLeadIds = new Set<string>();

    const addPriority = (item: PriorityItem) => {
      if (!seenLeadIds.has(item.leadId)) {
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
      leadName: f.lead.name,
      business: f.lead.business || "Unknown Business",
      actionNeeded: `Overdue: ${f.type}`,
      time: formatTimeIST(f.scheduledAt),
      phone: f.lead.phone,
      status: f.lead.status.replace("_", " "),
      statusColor: statusColors[f.lead.status] || statusColors.NEW,
      type: "OVERDUE"
    }));

    todayFollowUpsList.forEach(f => addPriority({
      id: f.id,
      leadId: f.leadId,
      leadName: f.lead.name,
      business: f.lead.business || "Unknown Business",
      actionNeeded: `Follow-up: ${f.type}`,
      time: formatTimeIST(f.scheduledAt),
      phone: f.lead.phone,
      status: f.lead.status.replace("_", " "),
      statusColor: statusColors[f.lead.status] || statusColors.NEW,
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

    // Slicing on the server
    const paginatedPriorities = priorities.slice(skip, skip + take);
    const hasMore = priorities.length > skip + take;

    return {
      success: true,
      data: {
        priorities: paginatedPriorities,
        hasMore,
        nextCursor: hasMore ? page + 1 : page
      }
    };
  } catch (error) {
    if (error instanceof UserFacingError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Could not load priority leads." };
  }
}
