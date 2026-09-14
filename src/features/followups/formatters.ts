import { formatDate } from "@/features/leads/formatters";

function getKolkataDate(dateString: string): Date {
  const date = new Date(dateString);
  const str = date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  return new Date(str);
}

export function formatFollowUpDate(dateStr: string): string {
  const today = getKolkataDate(new Date().toISOString());
  today.setHours(0, 0, 0, 0);
  
  const target = getKolkataDate(dateStr);
  target.setHours(0, 0, 0, 0);
  
  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays < -1) return `${Math.abs(diffDays)} days ago`;
  if (diffDays <= 7) return `In ${diffDays} days`;

  return formatDate(dateStr);
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", { 
    timeZone: "Asia/Kolkata",
    hour: "numeric", 
    minute: "2-digit",
    hour12: true 
  });
}

export function getFollowUpStatusInfo(followUp: { scheduledAt: string; status: string }) {
  if (followUp.status === "Completed") return "Completed";
  if (followUp.status === "Cancelled") return "Cancelled";
  
  const today = getKolkataDate(new Date().toISOString());
  today.setHours(0, 0, 0, 0);
  
  const target = getKolkataDate(followUp.scheduledAt);
  target.setHours(0, 0, 0, 0);
  
  const diffMs = target.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Today";
  return "Upcoming";
}

export function isFollowUpOverdue(followUp: { scheduledAt: string; status: string }): boolean {
  if (followUp.status !== "Pending") return false;
  return getFollowUpStatusInfo(followUp) === "Overdue";
}

export function isFollowUpToday(followUp: { scheduledAt: string; status: string }): boolean {
  if (followUp.status !== "Pending") return false;
  return getFollowUpStatusInfo(followUp) === "Today";
}

export function isFollowUpUpcoming(followUp: { scheduledAt: string; status: string }): boolean {
  if (followUp.status !== "Pending") return false;
  return getFollowUpStatusInfo(followUp) === "Upcoming";
}
