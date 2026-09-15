import type { LeadOperationalState } from "@/features/leads/types";

export function deriveOperationalState(
  lead: { status: string; isWaste: boolean; nextFollowUpDate: string | null } & { followUps?: { scheduledAt: string; status: string }[] }
): LeadOperationalState {
  if (lead.status === "LOST") return "LOST";
  if (lead.isWaste) return "WASTE";

  const getKolkataDateString = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const y = parts.find(p => p.type === 'year')!.value;
    const m = parts.find(p => p.type === 'month')!.value;
    const d = parts.find(p => p.type === 'day')!.value;
    return `${y}-${m}-${d}`;
  };

  const todayStr = getKolkataDateString(new Date());

  const pendingFollowUps = (lead.followUps ?? []).filter(
    f => f.status === "PENDING"
  );

  const hasOverdueOrToday = pendingFollowUps.some(f => {
    const scheduledStr = getKolkataDateString(new Date(f.scheduledAt));
    return scheduledStr <= todayStr;
  });

  if (hasOverdueOrToday) return "FOLLOW_UP_NOW";

  const hasFutureFollowUp = pendingFollowUps.some(f => {
    const scheduledStr = getKolkataDateString(new Date(f.scheduledAt));
    return scheduledStr > todayStr;
  });

  if (hasFutureFollowUp) return "FUTURE_FOLLOW_UP";

  return "ACTIVE_NEUTRAL";
}
