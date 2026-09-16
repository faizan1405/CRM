import type { LeadOperationalState } from "@/features/leads/types";

const operationalStyles: Record<LeadOperationalState, { badge: string; accent: string }> = {
  FOLLOW_UP_NOW: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    accent: "border-l-emerald-400",
  },
  FUTURE_FOLLOW_UP: {
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    accent: "border-l-amber-400",
  },
  LOST: {
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
    accent: "border-l-rose-400",
  },
  WASTE: {
    badge: "bg-slate-100 text-slate-500 ring-slate-200",
    accent: "border-l-slate-300",
  },
  ACTIVE_NEUTRAL: {
    badge: "",
    accent: "",
  },
};

const operationalLabels: Record<LeadOperationalState, string> = {
  FOLLOW_UP_NOW: "Follow up now",
  FUTURE_FOLLOW_UP: "Future follow-up",
  LOST: "Lost",
  WASTE: "Waste",
  ACTIVE_NEUTRAL: "",
};

export function OperationalStateBadge({ state }: { state: LeadOperationalState }) {
  if (state === "ACTIVE_NEUTRAL" || !state) return null;

  const styles = operationalStyles[state];
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${styles.badge}`}
      aria-label={`Operational state: ${operationalLabels[state]}`}
    >
      {operationalLabels[state]}
    </span>
  );
}

export function getOperationalAccent(state: LeadOperationalState): string {
  return operationalStyles[state]?.accent || "";
}
