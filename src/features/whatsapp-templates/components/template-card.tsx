"use client";

import { Edit3, Copy, Trash2, Eye, Power } from "lucide-react";
import type { WhatsAppTemplate } from "../types";

interface TemplateCardProps {
  template: WhatsAppTemplate;
  isSelected?: boolean;
  onSelect: (template: WhatsAppTemplate) => void;
  onEdit: (template: WhatsAppTemplate) => void;
  onDuplicate: (template: WhatsAppTemplate) => void;
  onToggleActive: (template: WhatsAppTemplate) => void;
  onDeleteRequest: (template: WhatsAppTemplate) => void;
  className?: string;
}

export function TemplateCard({
  template,
  isSelected = false,
  onSelect,
  onEdit,
  onDuplicate,
  onToggleActive,
  onDeleteRequest,
  className = "",
}: TemplateCardProps) {
  const categoryBadgeColors = {
    first_contact: "bg-blue-50 text-blue-700 border-blue-200",
    after_call: "bg-emerald-50 text-emerald-700 border-emerald-200",
    follow_up: "bg-purple-50 text-purple-700 border-purple-200",
    quotation_sent: "bg-amber-50 text-amber-800 border-amber-200",
    quotation_followup: "bg-orange-50 text-orange-800 border-orange-200",
    no_response: "bg-slate-100 text-slate-700 border-slate-200",
    final_followup: "bg-rose-50 text-rose-700 border-rose-200",
    converted: "bg-teal-50 text-teal-800 border-teal-200",
  }[template.category] || "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <article
      onClick={() => onSelect(template)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(template);
        }
      }}
      aria-label={`WhatsApp template: ${template.title}`}
      className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-150 cursor-pointer ${
        isSelected
          ? "border-emerald-600 bg-emerald-50/40 shadow-sm ring-2 ring-emerald-500/20"
          : !template.active
          ? "border-slate-200 bg-slate-50/60 opacity-75 hover:border-slate-300"
          : "border-slate-200 bg-white shadow-xs hover:border-emerald-300 hover:shadow-md"
      } ${className}`}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${categoryBadgeColors}`}
              >
                {template.categoryLabel}
              </span>
              {!template.active && (
                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                  Inactive
                </span>
              )}
            </div>
            <h3 className="mt-1.5 truncate text-sm font-bold text-slate-950">
              {template.title}
            </h3>
          </div>

          {/* Active Switch & Actions */}
          <div
            className="flex items-center gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onToggleActive(template)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${
                template.active
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
              }`}
              title={template.active ? "Click to deactivate" : "Click to activate"}
              aria-label={template.active ? `Deactivate ${template.title}` : `Activate ${template.title}`}
            >
              <Power size={11} aria-hidden="true" />
              <span>{template.active ? "Active" : "Inactive"}</span>
            </button>
          </div>
        </div>

        {/* Template Body Snippet */}
        <p className="mt-2.5 line-clamp-3 text-xs text-slate-600 leading-relaxed break-words font-sans">
          {template.body}
        </p>
      </div>

      {/* Action Bar */}
      <div
        className="mt-4 flex items-center justify-between border-t border-slate-100/90 pt-3 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onSelect(template)}
          className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800"
        >
          <Eye size={14} aria-hidden="true" />
          <span>Preview</span>
        </button>

        <div className="flex items-center gap-1">
          {/* Edit */}
          <button
            type="button"
            onClick={() => onEdit(template)}
            className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title="Edit template"
            aria-label={`Edit ${template.title}`}
          >
            <Edit3 size={14} aria-hidden="true" />
          </button>

          {/* Duplicate */}
          <button
            type="button"
            onClick={() => onDuplicate(template)}
            className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title="Duplicate template"
            aria-label={`Duplicate ${template.title}`}
          >
            <Copy size={14} aria-hidden="true" />
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={() => onDeleteRequest(template)}
            className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
            title="Delete template"
            aria-label={`Delete ${template.title}`}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
