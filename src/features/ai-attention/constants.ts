export const STALE_THRESHOLDS_DAYS: Record<string, number> = {
  NEW: 1,
  CONTACTED: 2,
  QUALIFIED: 3,
  PROPOSAL_SENT: 2,
  WON: 9999,
  LOST: 9999,
};

export const SCORE_THRESHOLDS = {
  HOT_MIN: 80,
  WARM_MIN: 50,
} as const;

export const PRIORITY_LEVELS = {
  CRITICAL: "CRITICAL",
  IMPORTANT: "IMPORTANT",
  NORMAL: "NORMAL",
} as const;
