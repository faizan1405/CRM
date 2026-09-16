"use client";

import { useState, useRef, useEffect } from "react";
import { Phone, MessageSquare, PhoneMissed, Check, X, RotateCcw, ChevronDown } from "lucide-react";
import type { QuickStatusType, LeadStatus } from "./types";

export type QuickStatusOption = {
  id: QuickStatusType | "WON" | "LOST";
  label: string;
  icon: typeof Phone;
  chipClass: string;
  dotColor: string;
};

export const QUICK_STATUS_CONFIG: Record<string, QuickStatusOption> = {
  CONTACTED: {
    id: "CONTACTED",
    label: "Contacted",
    icon: Phone,
    chipClass: "bg-purple-100 text-purple-900 border-purple-200 hover:bg-purple-200/80",
    dotColor: "bg-purple-500",
  },
  INTERESTED: {
    id: "INTERESTED",
    label: "Interested",
    icon: MessageSquare,
    chipClass: "bg-amber-100 text-amber-900 border-amber-200 hover:bg-amber-200/80",
    dotColor: "bg-amber-500",
  },
  CALL_NOT_PICK: {
    id: "CALL_NOT_PICK",
    label: "call not pick",
    icon: PhoneMissed,
    chipClass: "bg-rose-100 text-rose-900 border-rose-200 hover:bg-rose-200/80",
    dotColor: "bg-rose-400",
  },
  WON: {
    id: "WON",
    label: "Won",
    icon: Check,
    chipClass: "bg-emerald-100 text-emerald-900 border-emerald-200 hover:bg-emerald-200/80",
    dotColor: "bg-emerald-500",
  },
  LOST: {
    id: "LOST",
    label: "Lost",
    icon: X,
    chipClass: "bg-red-100 text-red-900 border-red-200 hover:bg-red-200/80",
    dotColor: "bg-red-500",
  },
  CALL_AGAIN: {
    id: "CALL_AGAIN",
    label: "call again",
    icon: RotateCcw,
    chipClass: "bg-indigo-100 text-indigo-900 border-indigo-200 hover:bg-indigo-200/80",
    dotColor: "bg-indigo-500",
  },
};

export const QUICK_STATUS_LIST: QuickStatusOption[] = [
  QUICK_STATUS_CONFIG.CONTACTED,
  QUICK_STATUS_CONFIG.INTERESTED,
  QUICK_STATUS_CONFIG.CALL_NOT_PICK,
  QUICK_STATUS_CONFIG.WON,
  QUICK_STATUS_CONFIG.LOST,
  QUICK_STATUS_CONFIG.CALL_AGAIN,
];

type QuickStatusChipProps = {
  quickStatus?: QuickStatusType;
  leadStatus?: LeadStatus;
  onSelectStatus?: (statusKey: QuickStatusType | "WON" | "LOST") => void;
  readOnly?: boolean;
  size?: "sm" | "md";
};

export function QuickStatusChip({
  quickStatus = "NONE",
  leadStatus,
  onSelectStatus,
  readOnly = false,
  size = "md",
}: QuickStatusChipProps) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Determine current active config
  let currentConfig: QuickStatusOption | null = null;
  if (leadStatus === "Won") {
    currentConfig = QUICK_STATUS_CONFIG.WON;
  } else if (leadStatus === "Lost") {
    currentConfig = QUICK_STATUS_CONFIG.LOST;
  } else if (quickStatus && quickStatus !== "NONE" && QUICK_STATUS_CONFIG[quickStatus]) {
    currentConfig = QUICK_STATUS_CONFIG[quickStatus];
  } else if (leadStatus === "Contacted") {
    currentConfig = QUICK_STATUS_CONFIG.CONTACTED;
  } else if (leadStatus === "Qualified") {
    currentConfig = QUICK_STATUS_CONFIG.INTERESTED;
  }

  const Icon = currentConfig?.icon || Phone;
  const label = currentConfig?.label || (leadStatus ? leadStatus : "Select status");
  const chipClass = currentConfig?.chipClass || "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/80";

  const sizeClass = size === "sm"
    ? "px-2 py-0.5 text-xs gap-1"
    : "px-2.5 py-1 text-xs sm:text-[13px] gap-1.5";

  if (readOnly || !onSelectStatus) {
    return (
      <span className={`inline-flex items-center rounded-full border font-medium transition-colors ${sizeClass} ${chipClass}`}>
        {currentConfig && <Icon size={size === "sm" ? 12 : 13} className="shrink-0" />}
        <span>{label}</span>
      </span>
    );
  }

  return (
    <div className="relative inline-block text-left" ref={popoverRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={`inline-flex items-center rounded-full border font-medium transition-all duration-150 shadow-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${sizeClass} ${chipClass}`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Status: ${label}. Click to change status.`}
      >
        {currentConfig && <Icon size={size === "sm" ? 12 : 13} className="shrink-0" />}
        <span className="font-semibold">{label}</span>
        <ChevronDown size={size === "sm" ? 11 : 12} className={`shrink-0 opacity-60 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1.5 w-48 origin-top-left rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150"
          role="menu"
          aria-orientation="vertical"
        >
          <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Quick Status
          </div>
          <div className="flex flex-col gap-0.5">
            {QUICK_STATUS_LIST.map((opt) => {
              const OptIcon = opt.icon;
              const isSelected = currentConfig?.id === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    onSelectStatus(opt.id);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-medium transition-colors cursor-pointer ${
                    isSelected ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className={`grid size-5 place-items-center rounded-md border ${opt.chipClass}`}>
                    <OptIcon size={12} />
                  </span>
                  <span className="flex-1">{opt.label}</span>
                  {isSelected && <Check size={14} className="text-blue-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
