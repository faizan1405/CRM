"use client";

import { LucideIcon } from "lucide-react";
import type { InterestLevel } from "./types";

interface StructuredFieldRowProps {
  label: string;
  fieldKey: string;
  value: string | null;
  onChange: (val: string | null) => void;
  icon?: LucideIcon;
  placeholder?: string;
  isInterestLevel?: boolean;
  disabled?: boolean;
}

export function StructuredFieldRow({
  label,
  fieldKey,
  value,
  onChange,
  icon: Icon,
  placeholder = "Not provided",
  isInterestLevel = false,
  disabled = false,
}: StructuredFieldRowProps) {
  const isProvided = value !== null && value !== undefined && value.trim() !== "";

  if (isInterestLevel) {
    const levels: InterestLevel[] = ["High", "Medium", "Low"];
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="size-4 text-slate-500" aria-hidden="true" />}
            <label
              htmlFor={`field-${fieldKey}`}
              className="text-xs font-semibold uppercase tracking-wider text-slate-700"
            >
              {label}
            </label>
          </div>
          {!isProvided && (
            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 border border-slate-200">
              Not provided
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={label}>
          {levels.map((level) => {
            const isSelected = value?.toLowerCase() === level.toLowerCase();
            const badgeColor =
              level === "High"
                ? "bg-emerald-600 text-white border-emerald-600"
                : level === "Medium"
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-slate-600 text-white border-slate-600";

            return (
              <button
                key={level}
                type="button"
                id={`interest-${level.toLowerCase()}`}
                disabled={disabled}
                onClick={() => onChange(isSelected ? null : level)}
                className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-3.5 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-50 ${
                  isSelected
                    ? badgeColor
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {level}
              </button>
            );
          })}
          {isProvided && (
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={disabled}
              className="inline-flex min-h-11 items-center justify-center px-2 text-xs text-slate-400 hover:text-slate-600 disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="size-4 text-slate-500" aria-hidden="true" />}
          <label
            htmlFor={`field-${fieldKey}`}
            className="text-xs font-semibold uppercase tracking-wider text-slate-700"
          >
            {label}
          </label>
        </div>
        {!isProvided && (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 border border-slate-200">
            Not provided
          </span>
        )}
      </div>

      <div className="mt-1.5">
        <input
          id={`field-${fieldKey}`}
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value.trim() === "" ? null : e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-base sm:text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 placeholder:italic focus:border-blue-500 focus:bg-white focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
    </div>
  );
}
