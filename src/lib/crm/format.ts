export const getTodayIST = (): string => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

export const TODAY = getTodayIST();

export const inr = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const inrCompact = (n: number | null | undefined) => {
  if (n == null) return "—";
  if (n >= 10000000) return `₹${+(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${+(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${Math.round(n / 1000)}k`;
  return `₹${n}`;
};

export const fmtDate = (d: string | null | undefined) =>
  !d ? "—" : new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });

export const dayOf = (iso: string) => (iso ? iso.slice(0, 10) : "");

export const relativeDay = (d: string | null) => {
  if (!d) return "—";
  const day = dayOf(d);
  const today = getTodayIST();
  if (day === today) return "Today";
  const diff = Math.round((new Date(day).getTime() - new Date(today).getTime()) / 86400000);
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${-diff}d overdue`;
  return fmtDate(day);
};

export const isOverdue = (d: string | null) => !!d && dayOf(d) < getTodayIST();
export const isToday = (d: string | null) => !!d && dayOf(d) === getTodayIST();

export const digits = (phone: string) => phone.replace(/\D/g, "");
export const waLink = (phone: string, text?: string) => `https://wa.me/${digits(phone)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
export const telLink = (phone: string) => `tel:+${digits(phone)}`;
