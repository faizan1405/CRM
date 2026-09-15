"use client";

import { useState } from "react";
import {
  X,
  MessageCircle,
  Sparkles,
  RotateCcw,
  Check,
  Send,
} from "lucide-react";
import type { WhatsAppComposerLead, WhatsAppTemplate } from "../types";

import { interpolatePlaceholders } from "../placeholders";
import { PlaceholderChips } from "./placeholder-chips";
import { personalizeWhatsAppMessage } from "@/app/actions/whatsapp-templates";

interface WhatsAppLeadComposerProps {
  isOpen: boolean;
  lead: WhatsAppComposerLead | null;
  templates?: WhatsAppTemplate[];
  initialTemplateId?: string;
  onClose: () => void;
  onAIPersonalize?: (lead: WhatsAppComposerLead, templateBody: string) => Promise<string> | string;
  className?: string;
}

export function WhatsAppLeadComposer({
  isOpen,
  lead,
  templates = [],
  initialTemplateId,
  onClose,
  onAIPersonalize,
  className = "",
}: WhatsAppLeadComposerProps) {
  const activeTemplates = templates.filter((t) => t.active);

  const initialId = initialTemplateId || activeTemplates[0]?.id || "";
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialId);
  const [customMessage, setCustomMessage] = useState<string>(() => {
    const tpl = activeTemplates.find((t) => t.id === initialId);
    return tpl && lead ? interpolatePlaceholders(tpl.body, lead, false) : "";
  });
  const [isPersonalizing, setIsPersonalizing] = useState(false);
  const [aiPreview, setAiPreview] = useState<{
    original: string;
    personalized: string;
  } | null>(null);

  const handleTemplateChange = (newTemplateId: string) => {
    setSelectedTemplateId(newTemplateId);
    const tpl = activeTemplates.find((t) => t.id === newTemplateId);
    if (tpl && lead) {
      setCustomMessage(interpolatePlaceholders(tpl.body, lead, false));
    }
    setAiPreview(null);
  };

  if (!isOpen || !lead) return null;

  const handleInsertPlaceholder = (key: string) => {
    setCustomMessage((prev) => `${prev} ${key}`);
  };

  /**
   * AI Personalization trigger
   */
  const handleAIPersonalize = async () => {
    if (!customMessage.trim()) return;
    setIsPersonalizing(true);

    try {
      let personalized = "";

      if (onAIPersonalize) {
        personalized = await onAIPersonalize(lead, customMessage);
      } else {
        const result = await personalizeWhatsAppMessage({ leadId: lead.id, templateMessage: customMessage });
        if (!result.success || !result.data) throw new Error(result.error || "AI personalization failed.");
        personalized = result.data.personalizedMessage;
      }

      // Show preview first - NEVER silently overwrite
      setAiPreview({
        original: customMessage,
        personalized,
      });
    } catch (err) {
      console.error("AI Personalization failed", err);
    } finally {
      setIsPersonalizing(false);
    }
  };

  const applyAIPersonalize = () => {
    if (!aiPreview) return;
    setCustomMessage(aiPreview.personalized);
    setAiPreview(null);
  };

  const dismissAIPersonalize = () => {
    setAiPreview(null);
  };

  /**
   * Open WhatsApp via deep-link
   */
  const handleOpenWhatsApp = () => {
    const rawPhone = lead.phone.replace(/[^0-9]/g, "");
    const encodedMessage = encodeURIComponent(customMessage);
    const whatsappUrl = `https://wa.me/${rawPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    onClose();
  };

  const charCount = customMessage.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/45 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whatsapp-composer-title"
        className={`relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden ${className}`}
      >
        {/* Modal Header */}
        <header className="flex items-center justify-between border-b border-slate-100 bg-[#075e54] px-4 py-3.5 sm:px-6 text-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid size-8 place-items-center rounded-lg bg-white/20 text-white">
              <MessageCircle size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id="whatsapp-composer-title" className="text-base font-bold truncate">
                Compose WhatsApp to {lead.name}
              </h2>
              <p className="text-xs text-white/80 truncate">
                {lead.phone} {lead.business ? `· ${lead.business}` : ""}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Close WhatsApp composer"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Template Selector Row */}
          <div>
            <label
              htmlFor="composer-template-select"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Choose Template
            </label>
            <select
              id="composer-template-select"
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              {activeTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.categoryLabel}] {t.title}
                </option>
              ))}
            </select>
          </div>

          {/* AI Personalize Preview Banner */}
          {aiPreview && (
            <div
              role="region"
              aria-label="AI Personalized Preview"
              className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-white to-white p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                  <Sparkles size={15} className="text-indigo-600" aria-hidden="true" />
                  <span>AI Personalized Message Preview</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={dismissAIPersonalize}
                    className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <RotateCcw size={13} aria-hidden="true" />
                    <span>Keep Original</span>
                  </button>
                  <button
                    type="button"
                    onClick={applyAIPersonalize}
                    className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors"
                  >
                    <Check size={14} aria-hidden="true" />
                    <span>Apply</span>
                  </button>
                </div>
              </div>

              <div className="rounded-lg border border-indigo-100 bg-white p-3 text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                {aiPreview.personalized}
              </div>

              <p className="text-[11px] text-slate-500 italic">
                Original text is kept until you explicitly click &quot;Apply&quot;.
              </p>
            </div>
          )}

          {/* Message Textarea (Editable before sending) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="composer-message-textarea"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-600"
              >
                Message (Editable Before Sending)
              </label>
              <span className="text-[11px] text-slate-400">{charCount} characters</span>
            </div>
            <textarea
              id="composer-message-textarea"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Edit your personalized WhatsApp message..."
              rows={6}
              className="w-full rounded-xl border border-slate-200 p-3.5 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 min-h-[140px]"
            />
          </div>

          {/* Placeholder Insert Chips */}
          <PlaceholderChips onInsert={handleInsertPlaceholder} />

          {/* AI Personalize Trigger */}
          <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-600 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-xs font-bold text-slate-900">AI Outreach Refinement</p>
                <p className="text-[11px] text-slate-500">
                  Polishes the tone based on {lead.name}&apos;s sales stage & details.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isPersonalizing || !customMessage.trim()}
              onClick={handleAIPersonalize}
              className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white shadow-2xs hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-40 transition-colors"
            >
              <Sparkles size={13} aria-hidden="true" />
              <span>{isPersonalizing ? "Refining..." : "Personalize with AI"}</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <footer className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleOpenWhatsApp}
            disabled={!customMessage.trim()}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#25d366] px-5 text-xs sm:text-sm font-bold text-slate-950 shadow-xs hover:bg-[#20bd5a] active:bg-[#1caa51] disabled:opacity-40 transition-colors"
          >
            <Send size={16} aria-hidden="true" />
            <span>Open WhatsApp</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
