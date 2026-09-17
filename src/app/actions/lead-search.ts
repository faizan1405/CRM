"use server";

import { db } from "@/lib/db";
import { statusFromDatabase } from "@/features/leads/types";

export async function searchLeadsForWhatsApp(query: string) {
  try {
    if (!query.trim() || query.length < 2) {
      return { success: true, data: [] };
    }
    const safeQuery = query.trim();
    
    // Search by name or phone
    const leads = await db.lead.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: safeQuery, mode: "insensitive" } },
          { phone: { contains: safeQuery } }
        ]
      },
      select: {
        id: true,
        name: true,
        phone: true,
        status: true,
        business: true
      },
      take: 10,
      orderBy: { updatedAt: "desc" }
    });

    const mapped = leads.map(l => ({ ...l, status: statusFromDatabase[l.status] }));
    return { success: true, data: mapped };
  } catch (error) {
    console.error("Lead search failed:", error);
    return { success: false, error: "Failed to search leads" };
  }
}

export async function globalQuickSearch(query: string) {
  try {
    if (!query.trim() || query.length < 2) {
      return { success: true, data: [] };
    }
    const safeQuery = query.trim();
    
    // Search by name, phone, or notes
    const leads = await db.lead.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: safeQuery, mode: "insensitive" } },
          { phone: { contains: safeQuery } }
        ]
      },
      select: {
        id: true,
        name: true,
        phone: true,
        status: true,
        nextFollowUpDate: true,
        notes: true
      },
      take: 15,
      orderBy: { updatedAt: "desc" }
    });

    const mapped = leads.map(l => ({ ...l, status: statusFromDatabase[l.status] }));
    return { success: true, data: mapped };
  } catch (error) {
    console.error("Global search failed:", error);
    return { success: false, error: "Failed to search leads" };
  }
}
