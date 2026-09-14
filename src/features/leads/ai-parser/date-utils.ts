export const BUSINESS_TIMEZONE = "Asia/Kolkata";

export function getReferenceDateTimeContext(now = new Date()): {
  iso: string;
  formattedKolkata: string;
  todayDateStr: string;
  dayOfWeek: string;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";

  const dayOfWeek = getPart("weekday");
  const monthName = getPart("month");
  const day = getPart("day");
  const year = getPart("year");
  const hour = getPart("hour");
  const minute = getPart("minute");
  const dayPeriod = getPart("dayPeriod");

  const yyyy = year;
  const monthNum = String(new Date(`${monthName} 1, 2000`).getMonth() + 1).padStart(2, "0");
  const dd = day.padStart(2, "0");
  const todayDateStr = `${yyyy}-${monthNum}-${dd}`;

  return {
    iso: now.toISOString(),
    formattedKolkata: `${dayOfWeek}, ${day} ${monthName} ${year} at ${hour}:${minute} ${dayPeriod} (Asia/Kolkata / IST)`,
    todayDateStr,
    dayOfWeek,
  };
}

export function isValidDateStr(dateStr: string | null | undefined): boolean {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(`${dateStr}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dateStr;
}

export function isValidTimeStr(timeStr: string | null | undefined): boolean {
  if (!timeStr || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(timeStr)) return false;
  return true;
}

export function parseKolkataDateTime(dateStr: string, timeStr?: string | null): Date | null {
  if (!isValidDateStr(dateStr)) return null;

  const validTime = isValidTimeStr(timeStr) ? timeStr! : "10:00";
  const isoWithOffset = `${dateStr}T${validTime}:00+05:30`;
  const parsed = new Date(isoWithOffset);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
