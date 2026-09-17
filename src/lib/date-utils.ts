import { formatDistanceToNow, differenceInHours, differenceInDays } from "date-fns";

export function formatLeadAge(createdAt: string | Date): string {
  const d = new Date(createdAt);
  const hours = differenceInHours(new Date(), d);
  
  if (hours < 24) {
    return `${hours}h`;
  }
  
  const days = differenceInDays(new Date(), d);
  return `${days}d`;
}

export function formatLastContacted(lastContactDate: string | Date | null): string {
  if (!lastContactDate) return "Never contacted";
  
  const d = new Date(lastContactDate);
  const hours = differenceInHours(new Date(), d);
  const days = differenceInDays(new Date(), d);

  if (hours < 24) {
    if (hours === 0) return "Just now";
    return `${hours}h ago`;
  }
  
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function formatNextFollowUp(nextFollowUpDate: string | Date | null): string {
  if (!nextFollowUpDate) return "No follow-up";
  
  const d = new Date(nextFollowUpDate);
  const now = new Date();
  
  const isOverdue = d < now;
  const isToday = d.toDateString() === now.toDateString();
  const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === d.toDateString();
  
  const timeStr = d.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });
  
  if (isOverdue && !isToday) {
    const days = differenceInDays(now, d);
    if (days === 1) return `Overdue • Yesterday ${timeStr}`;
    return `Overdue • ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${timeStr}`;
  }
  
  if (isToday) return `Today • ${timeStr}`;
  if (isTomorrow) return `Tomorrow • ${timeStr}`;
  
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} • ${timeStr}`;
}
