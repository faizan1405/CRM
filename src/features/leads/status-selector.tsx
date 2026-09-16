"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, Circle } from "lucide-react";
import type { LeadStatus } from "./types";

export type StatusOption = {
  id: LeadStatus;
  label: string;
  chipClass: string;
  dotClass: string;
};

export const STATUS_CONFIG: Record<LeadStatus, StatusOption> = {
  New: {
    id: "New",
    label: "New",
    chipClass: "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100/80",
    dotClass: "text-sky-500",
  },
  Contacted: {
    id: "Contacted",
    label: "Contacted",
    chipClass: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100/80",
    dotClass: "text-violet-500",
  },
  Qualified: {
    id: "Qualified",
    label: "Qualified",
    chipClass: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-100/80",
    dotClass: "text-fuchsia-500",
  },
  "Proposal Sent": {
    id: "Proposal Sent",
    label: "Proposal Sent",
    chipClass: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100/80",
    dotClass: "text-indigo-500",
  },
  Won: {
    id: "Won",
    label: "Won",
    chipClass: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80",
    dotClass: "text-emerald-500",
  },
  Lost: {
    id: "Lost",
    label: "Lost",
    chipClass: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/80",
    dotClass: "text-rose-500",
  },
};

export const STATUS_LIST: StatusOption[] = [
  STATUS_CONFIG.New,
  STATUS_CONFIG.Contacted,
  STATUS_CONFIG.Qualified,
  STATUS_CONFIG["Proposal Sent"],
  STATUS_CONFIG.Won,
  STATUS_CONFIG.Lost,
];

type StatusSelectorProps = {
  status: LeadStatus;
  onSelectStatus?: (status: LeadStatus) => void;
  readOnly?: boolean;
  size?: "sm" | "md";
};

export function StatusSelector({
  status,
  onSelectStatus,
  readOnly = false,
  size = "md",
}: StatusSelectorProps) {
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

  const currentConfig = STATUS_CONFIG[status] || STATUS_CONFIG.New;

  const sizeClass = size === "sm"
    ? "px-2 py-0.5 text-xs gap-1"
    : "px-2.5 py-1 text-xs sm:text-[13px] gap-1.5";

  if (readOnly || !onSelectStatus) {
    return (
      <span className={`inline-flex items-center rounded-full border font-medium transition-colors ${sizeClass} ${currentConfig.chipClass}`}>
        <Circle size={size === "sm" ? 8 : 10} className={`shrink-0 fill-current ${currentConfig.dotClass}`} />
        <span>{currentConfig.label}</span>
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
        className={`inline-flex items-center rounded-full border font-medium transition-all duration-150 shadow-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 ${sizeClass} ${currentConfig.chipClass}`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Status: ${currentConfig.label}. Click to change status.`}
      >
        <Circle size={size === "sm" ? 8 : 10} className={`shrink-0 fill-current ${currentConfig.dotClass}`} />
        <span className="font-semibold">{currentConfig.label}</span>
        <ChevronDown size={size === "sm" ? 11 : 12} className={`shrink-0 opacity-60 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1.5 w-48 origin-top-left rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150"
          role="menu"
          aria-orientation="vertical"
        >
          <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Select Status
          </div>
          <div className="flex flex-col gap-0.5">
            {STATUS_LIST.map((opt) => {
              const isSelected = currentConfig.id === opt.id;
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
                  <Circle size={10} className={`shrink-0 fill-current ${opt.dotClass}`} />
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
