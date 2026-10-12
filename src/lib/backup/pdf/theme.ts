/**
 * Scale Flow brand system for every generated report.
 * Navy + white + blue with restrained accents; nothing decorative beyond the cover.
 */
export const COLORS = {
  navyDeep: "#071A33",
  navy: "#0B2545",
  navyMid: "#13395E",
  blue: "#1D4ED8",
  blueSoft: "#EFF6FF",
  accent: "#0EA5E9",
  accentSoft: "#E0F2FE",
  white: "#FFFFFF",
  slate900: "#0F172A",
  slate700: "#334155",
  slate600: "#475569",
  slate500: "#64748B",
  slate400: "#94A3B8",
  slate300: "#CBD5E1",
  slate200: "#E2E8F0",
  slate100: "#F1F5F9",
  slate50: "#F8FAFC",
  emerald: "#047857",
  emeraldSoft: "#ECFDF5",
  amber: "#B45309",
  amberSoft: "#FFFBEB",
  rose: "#B91C1C",
  roseSoft: "#FEF2F2",
} as const;

export const FONT_NAMES = {
  regular: "ScaleFlowRegular",
  bold: "ScaleFlowBold",
} as const;

/** A4 portrait geometry, in points (1pt = 1/72"). */
export const PAGE = {
  width: 595.28,
  height: 841.89,
  marginTop: 58,
  marginLeft: 42,
  marginRight: 42,
  marginBottom: 62,
} as const;

export const CONTENT_LEFT = PAGE.marginLeft;
export const CONTENT_WIDTH = PAGE.width - PAGE.marginLeft - PAGE.marginRight;
export const CONTENT_TOP = PAGE.marginTop;
export const CONTENT_BOTTOM = PAGE.height - PAGE.marginBottom;

export const SECTION_GAP = 22;

export const TEXT_SIZES = {
  cover: 30,
  coverSub: 12,
  section: 13.5,
  subSection: 10.5,
  body: 9,
  table: 8.2,
  tableHeader: 7.8,
  small: 7.4,
  kpiLabel: 7.2,
  kpiValue: 14,
} as const;