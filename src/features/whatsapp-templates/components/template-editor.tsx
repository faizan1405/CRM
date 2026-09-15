"use client";

import { useState, useRef } from "react";
import { Save, X, MessageSquare, Power } from "lucide-react";
import type { WhatsAppTemplate, WhatsAppTemplateCategoryKey } from "../types";
import { PlaceholderChips } from "./placeholder-chips";
import { TemplatePreviewCard } from "./template-preview-card";

interface TemplateEditorProps {
  template: WhatsAppTemplate | null;
  onSave: (data: {
    id?: string;
    title: string;
    category: WhatsAppTemplateCategoryKey;
    categoryLabel: string;
    body: string;
    active: boolean;
  }) => void;
  onClose: () => void;
  isSaving?: boolean;
}

const CATEGORY_OPTIONS: Array<{ value: WhatsAppTemplateCategoryKey; label: string }> = [
  { value: "first_contact", label: "First Contact" },
  { value: "after_call", label: "After Call" },
  { value: "follow_up", label: "Follow-up" },
  { value: "quotation_sent", label: "Quotation Sent" },
  { value: "quotation_followup", label: "Quotation Follow-up" },
  { value: "no_response", label: "No Response" },
  { value: "final_followup", label: "Final Follow-up" },
  { value: "converted", label: "Converted / Thank You" },
];

export function TemplateEditor({
  template,
  onSave,
  onClose,
  isSaving = false,
}: TemplateEditorProps) {
  const [title, setTitle] = useState(template?.title || "");
  const [category, setCategory] = useState<WhatsAppTemplateCategoryKey>(
    template?.category || "first_contact"
  );
  const [body, setBody] = useState(template?.body || "");
  const [active, setActive] = useState(template?.active ?? true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertPlaceholder = (placeholderKey: string) => {
    if (!textareaRef.current) {
      setBody((prev) => `${prev} ${placeholderKey}`);
      return;
    }

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = body.substring(0, start) + placeholderKey + body.substring(end);
    setBody(newText);

    // Set cursor position after inserted placeholder
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + placeholderKey.length;
    });
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    const categoryLabel =
      CATEGORY_OPTIONS.find((c) => c.value === category)?.label || "Template";

    onSave({
      id: template?.id,
      title: title.trim(),
      category,
      categoryLabel,
      body: body.trim(),
      active,
    });
  };

  const charCount = body.length;
  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <MessageSquare size={15} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-950">
              {template ? "Edit WhatsApp Template" : "New WhatsApp Template"}
            </h3>
            <p className="text-[11px] text-slate-500">
              Reusable outreach copy with dynamic personalization
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close editor"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {/* Title and Category Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="template-title-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
            >
              Template Title
            </label>
            <input
              id="template-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Initial Outreach & Intro..."
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <label
              htmlFor="template-category-select"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1"
            >
              Template Category
            </label>
            <select
              id="template-category-select"
              value={category}
              onChange={(e) => setCategory(e.target.value as WhatsAppTemplateCategoryKey)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Placeholder Chips Bar */}
        <PlaceholderChips onInsert={handleInsertPlaceholder} />

        {/* Message Body Textarea */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="template-body-textarea"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600"
            >
              Message Content (WhatsApp)
            </label>
            <span className="text-[11px] text-slate-400">
              {wordCount} words · {charCount} chars
            </span>
          </div>
          <textarea
            id="template-body-textarea"
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your WhatsApp template here... Use {name}, {business}, etc. for dynamic inserts..."
            rows={5}
            className="w-full rounded-xl border border-slate-200 p-3 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 min-h-[120px]"
          />
        </div>

        {/* Active Status Switch */}
        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div>
            <span className="text-xs font-bold text-slate-900">Template Status</span>
            <p className="text-[11px] text-slate-500">
              Active templates appear in quick-compose menus for leads.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActive(!active)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold transition-colors ${
              active
                ? "border-emerald-300 bg-emerald-600 text-white shadow-xs"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            <Power size={13} aria-hidden="true" />
            <span>{active ? "Active" : "Inactive"}</span>
          </button>
        </div>

        {/* Live Preview Card */}
        <TemplatePreviewCard body={body} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={!title.trim() || !body.trim() || isSaving}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-5 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 transition-colors"
        >
          <Save size={15} aria-hidden="true" />
          <span>{isSaving ? "Saving..." : "Save Template"}</span>
        </button>
      </div>
    </div>
  );
}
