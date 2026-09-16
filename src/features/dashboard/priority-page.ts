import { getPriorityLeads } from "@/app/actions/priority-leads";
import type { LoadPriorityPage, PriorityLeadPage } from "./components/priority-leads";

export async function priorityPage(page: number): Promise<PriorityLeadPage> {
  const result = await getPriorityLeads(page);
  if (!result.success || !result.data) throw new Error(result.error || "Could not load priority leads.");
  const { priorities, hasMore, nextCursor } = result.data;
  return {
    items: priorities.map(item => ({ leadId: item.leadId, leadName: item.leadName, business: item.business, phone: item.phone, reason: `${item.actionNeeded} · ${item.time}`, stage: item.status })),
    // A full page may have more records even when the endpoint has no lookahead row.
    nextCursor: hasMore || priorities.length === 10 ? String(Math.max(page + 1, nextCursor)) : null,
  };
}

export const loadPriorityPage: LoadPriorityPage = ({ cursor }) => priorityPage(Number(cursor || 1));
