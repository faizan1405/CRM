import type { LeadOperationalState } from "@/features/leads/types";

export function deriveOperationalState(
  lead: { status: string; isWaste: boolean; nextFollowUpDate: string | null } & { followUps?: { scheduledAt: string; status: string }[] }
): LeadOperationalState {
  if (lead.status === "LOST") return "LOST";
  if (lead.isWaste) return "WASTE";

  const todayIST = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric", month: "numeric", day: "numeric"
  }).formatToParts(todayIST);
  const y = parseInt(parts.find(p => p.type === 'year')!.value);
  const m = parseInt(parts.find(p => p.type === 'month')!.value) - 1;
  const d = parseInt(parts.find(p => p.type === 'day')!.value);
  const startOfToday = new Date(Date.UTC(y, m, d, -5, -30, 0, 0));
  const endOfToday = new Date(Date.UTC(y, m, d, 18, 29, 59, 999));

  const pendingFollowUps = (lead.followUps ?? []).filter(
    f => f.status === "PENDING"
  );

  const hasOverdueOrToday = pendingFollowUps.some(f => {
    const scheduled = new Date(f.scheduledAt);
    return scheduled >= startOfToday && scheduled <= endOfToday || scheduled < startOfToday;
  });

  if (hasOverdueOrToday) return "FOLLOW_UP_NOW";

  const hasFutureFollowUp = pendingFollowUps.some(f => {
    const scheduled = new Date(f.scheduledAt);
    return scheduled > endOfToday;
  });

  if (hasFutureFollowUp) return "FUTURE_FOLLOW_UP";

  return "ACTIVE_NEUTRAL";
}
