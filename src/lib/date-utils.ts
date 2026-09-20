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
  if (isNaN(d.getTime())) return "No follow-up";

  const now = new Date();

  const getKolkataDateParts = (date: Date) => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  };

  const todayStr = getKolkataDateParts(now);
  const targetStr = getKolkataDateParts(d);

  const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = getKolkataDateParts(tomorrowDate);

  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getKolkataDateParts(yesterdayDate);

  const timeStr = d.toLocaleTimeString("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const isOverdue = targetStr < todayStr;
  const isToday = targetStr === todayStr;
  const isTomorrow = targetStr === tomorrowStr;
  const isYesterday = targetStr === yesterdayStr;

  if (isOverdue) {
    if (isYesterday) return `Overdue • Yesterday ${timeStr}`;
    return `Overdue • ${d.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })} ${timeStr}`;
  }

  if (isToday) return `Today • ${timeStr}`;
  if (isTomorrow) return `Tomorrow • ${timeStr}`;

  const targetDateOnly = new Date(`${targetStr}T00:00:00+05:30`).getTime();
  const todayDateOnly = new Date(`${todayStr}T00:00:00+05:30`).getTime();
  const diffDays = Math.round((targetDateOnly - todayDateOnly) / (1000 * 60 * 60 * 24));
  if (diffDays > 1 && diffDays <= 7) {
    return `In ${diffDays} days • ${timeStr}`;
  }

  return `${d.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })} • ${timeStr}`;
}

