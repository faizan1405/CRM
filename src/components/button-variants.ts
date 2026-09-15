/**
 * Shared button class strings for consistent button design across the CRM.
 *
 * Usage: className={`${btnPrimary} ...additional classes...`}
 *
 * All variants include:
 * - Hover feedback
 * - Active press feedback (scale)
 * - Disabled state
 * - Smooth 150ms transitions
 * - Consistent min-height (11)
 */

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 hover:shadow-md active:bg-blue-800 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150";

export const btnSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:shadow-md active:bg-slate-100 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150";

export const btnDestructive =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150";

export const btnSuccess =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 active:bg-emerald-900 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150";

export const btnGhost =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 active:bg-slate-200 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150";

export const btnAI =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 hover:shadow-lg active:bg-blue-800 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150";

export const btnSmall =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed";

export const btnIcon =
  "grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all duration-150 active:scale-[0.92] disabled:opacity-50";
