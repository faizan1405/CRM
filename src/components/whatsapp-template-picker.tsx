"use client";

import { useState, useEffect } from "react";
import { MessageCircle, X, Send, Plus, Minus, Search, Sparkles, RotateCcw } from "lucide-react";
import { getWebsitePackages, getWebsiteSamples } from "@/app/actions/sales-assets";
import { getWhatsAppTemplates, improveWhatsAppMessage } from "@/app/actions/whatsapp-templates";
import { logWhatsAppOpened } from "@/app/actions/whatsapp-logger";

import type { WebsitePackage, WebsiteSample, Lead } from "@prisma/client";
import type { WhatsAppTemplate } from "@/features/whatsapp-templates/types";

import type { WhatsAppConfig } from "./whatsapp-context";
import { BottomSheet } from "@/components/ui/bottom-sheet";

import {
  getCachedPackages,
  setCachedPackages,
  subscribePackagesUpdated,
  formatPackageListForMessage,
  formatSinglePackageForMessage,
} from "@/features/sales-assets/packages-sync";

let cachedSamples: WebsiteSample[] | null = null;
let cachedTemplates: WhatsAppTemplate[] | null = null;

export function WhatsAppTemplatePicker({
  isOpen,
  lead,
  config,
  onClose,
}: {
  isOpen: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lead: any; // { id, name, phone, quotedAmount, ... }
  config?: WhatsAppConfig;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<WebsitePackage[]>(() => getCachedPackages() || []);
  const [samples, setSamples] = useState<WebsiteSample[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [customMessage, setCustomMessage] = useState<string>("");
  const [isImproving, setIsImproving] = useState(false);
  const [lastOriginalDraft, setLastOriginalDraft] = useState<string | null>(null);
  const [improveError, setImproveError] = useState<string | null>(null);

  // Sub-selections
  const [sampleCategory, setSampleCategory] = useState<string>("");
  const [sampleType, setSampleType] = useState<string>("ALL"); // LIVE, DEMO, ALL
  const [selectedPackageIds, setSelectedPackageIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) {
      setLastOriginalDraft(null);
      setImproveError(null);
      setIsImproving(false);
    }
  }, [isOpen]);

  // Subscribe to real-time package updates across components
  useEffect(() => {
    const unsubscribe = subscribePackagesUpdated((updatedPkgs) => {
      setPackages(updatedPkgs);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isOpen) {
      const cached = getCachedPackages();
      if (cached && cached.length > 0) {
        setPackages(cached);
      }

      const loadData = async () => {
        const needInitialData = !cachedTemplates || !cachedSamples || !cached;
        if (needInitialData) {
          setLoading(true);
        }

        const [p, s, t] = await Promise.all([
          getWebsitePackages(),
          cachedSamples ? Promise.resolve({ success: true, data: cachedSamples }) : getWebsiteSamples(),
          cachedTemplates ? Promise.resolve({ success: true, data: cachedTemplates }) : getWhatsAppTemplates(),
        ]);

        if (p.success && p.data) {
          setCachedPackages(p.data);
          setPackages(p.data);
        }
        if (s.success && s.data) {
          cachedSamples = s.data;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setSamples((s.data as any[]) || []);
        }
        if (t.success && t.data) {
          cachedTemplates = t.data;
          // @ts-expect-error - compatibility
          setTemplates((t.data || []).filter(item => item.isActive || item.active));
        }
        setLoading(false);
      };
      loadData();
    }
  }, [isOpen]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const interpolateMessage = (
    tpl: any,
    currentPackages: WebsitePackage[] = packages,
    currentSelectedPkgIds: Set<string> = selectedPackageIds,
    currentSamples: WebsiteSample[] = samples
  ) => {
    let msg = tpl?.message || tpl?.body || "";
    
    // Replace standard variables safely
    msg = msg.replace(/{{leadName}}/g, lead?.name || "{{leadName}}");
    msg = msg.replace(/{{phone}}/g, lead?.phone || "{{phone}}");
    msg = msg.replace(/{{quotedAmount}}/g, lead?.quotedAmount ? `₹${Number(lead.quotedAmount).toLocaleString('en-IN')}` : "{{quotedAmount}}");
    msg = msg.replace(/{{status}}/g, lead?.status || "{{status}}");
    msg = msg.replace(/{{followUpDate}}/g, lead?.followUpDate || "{{followUpDate}}");

    if (tpl?.title === "Website Samples") {
      const filteredSamples = currentSamples.filter(s => 
        (sampleCategory ? s.category === sampleCategory : true) &&
        (sampleType === "ALL" ? true : s.type === sampleType) &&
        s.isActive
      );
      
      if (config?.sampleId || config?.category) {
        // Use exact requested format for direct sample sharing
        if (config.sampleId) {
          const s = currentSamples.find(s => s.id === config.sampleId);
          if (s) {
            msg = `What's up from you?\n\nSharing an ${s.category} website sample:\n\n${s.label || s.url}\n${s.url}\n\nPlease check it and let me know if you like this style.`;
          }
        } else if (config.category) {
          const links = filteredSamples.map(s => `• ${s.label ? s.label + " - " : ""}${s.url}`).join("\n");
          msg = `What's up from you?\n\nSharing some ${config.category} website samples:\n\n${links}\n\nPlease check them and let me know if you like this style.`;
        }
      } else {
        const links = filteredSamples.map(s => `• ${s.label ? s.label + " - " : ""}${s.url}`).join("\n");
        msg = msg.replace(/{{selectedSampleLinks}}/g, links || "(No samples selected)");
      }
    }

    if (tpl?.title === "Packages / Pricing") {
      const activePkgs = currentPackages.filter((p) => p.isActive);
      const selectedPkgs = activePkgs.filter((p) => currentSelectedPkgIds.has(p.id));
      
      if (config?.packageId && (currentSelectedPkgIds.has(config.packageId) || selectedPkgs.length === 1)) {
        // Direct package sharing with single package canonical format
        const p = currentPackages.find((pkg) => pkg.id === config.packageId) || selectedPkgs[0];
        if (p) {
          msg = formatSinglePackageForMessage(p);
        } else {
          msg = msg.replace(/{{packagePricingLinks}}/g, formatPackageListForMessage(selectedPkgs));
        }
      } else {
        const pkgsToFormat = selectedPkgs.length > 0 ? selectedPkgs : [];
        msg = msg.replace(/{{packagePricingLinks}}/g, formatPackageListForMessage(pkgsToFormat));
      }
    }

    return msg;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSelectTemplate = (
    tpl: any,
    overridePkgIds?: Set<string>,
    overridePackages?: WebsitePackage[]
  ) => {
    setSelectedTemplateId(tpl.id);
    const pkgsToUse = overridePackages || packages;
    let pkgIds = overridePkgIds || selectedPackageIds;
    if (tpl?.title === "Packages / Pricing" && pkgIds.size === 0 && !config?.packageId) {
      pkgIds = new Set(pkgsToUse.filter((p) => p.isActive).map((p) => p.id));
      setSelectedPackageIds(pkgIds);
    }
    setCustomMessage(interpolateMessage(tpl, pkgsToUse, pkgIds, samples));
    setLastOriginalDraft(null);
    setImproveError(null);
  };

  const handleImprove = async () => {
    const textToImprove = customMessage.trim();
    if (!textToImprove) {
      setImproveError("Write a message first.");
      return;
    }

    setIsImproving(true);
    setImproveError(null);

    try {
      const res = await improveWhatsAppMessage(textToImprove);
      if (res.success && (res.improvedMessage || res.data?.improvedMessage)) {
        const improved = res.improvedMessage || res.data?.improvedMessage || "";
        setLastOriginalDraft(customMessage);
        setCustomMessage(improved);
      } else {
        setImproveError(res.error || "Could not improve message. Please try again.");
      }
    } catch {
      // Keep original message untouched and show a small friendly error
      setImproveError("Could not improve message. Please try again.");
    } finally {
      setIsImproving(false);
    }
  };

  const handleUndoImprovement = () => {
    if (lastOriginalDraft !== null) {
      setCustomMessage(lastOriginalDraft);
      setLastOriginalDraft(null);
      setImproveError(null);
    }
  };

  // When templates load or config changes, set default
  useEffect(() => {
    if (isOpen && templates.length > 0) {
      if (config?.templateTitle) {
        const tpl = templates.find(t => t.title === config.templateTitle) || templates[0];
        let nextPkgIds = selectedPackageIds;
        if (config.packageId) {
          nextPkgIds = new Set([config.packageId]);
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setSelectedPackageIds(nextPkgIds);
        } else if (config.sampleId) {
          const s = samples.find(x => x.id === config.sampleId);
          if (s) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSampleCategory(s.category);
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSampleType(s.type);
          }
        } else if (config.category) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setSampleCategory(config.category);
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setSampleType("ALL");
        }
        handleSelectTemplate(tpl, nextPkgIds, packages);
      } else if (!selectedTemplateId) {
        const defaultTpl = templates.find(t => t.title === "Introduction") || templates[0];
        handleSelectTemplate(defaultTpl, undefined, packages);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, templates, config]);

  // Re-generate message if sub-selections or packages change
  useEffect(() => {
    const tpl = templates.find(t => t.id === selectedTemplateId);
    if (!tpl) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomMessage(interpolateMessage(tpl, packages, selectedPackageIds, samples));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleCategory, sampleType, selectedPackageIds, packages, samples, selectedTemplateId]);


  const handleOpenWhatsApp = () => {
    // Lightweight logging
    if (lead?.id) {
      logWhatsAppOpened(lead.id, templates.find(t => t.id === selectedTemplateId)?.title || "Custom").catch(console.error);
    }
    let rawPhone = (lead?.phone || "").replace(/[^0-9]/g, "");
    if (rawPhone.length === 10) {
      rawPhone = `91${rawPhone}`;
    } else if (rawPhone.length > 10 && !rawPhone.startsWith("91")) {
      // Just in case it's a different country code, let it be. But usually we just need to ensure no "+" is there.
    }
    const encodedMessage = encodeURIComponent(customMessage);
    const whatsappUrl = `https://wa.me/${rawPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    onClose();
  };

  if (!isOpen || !lead) return null;

  const activeTemplate = templates.find(t => t.id === selectedTemplateId);
  const sampleCategories = Array.from(new Set(samples.filter(s => s.isActive).map(s => s.category)));

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Send WhatsApp"
      headerIcon={<MessageCircle size={16} className="text-[#25d366]" />}
      footer={
        <>
          <button onClick={onClose} className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[15px] font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-sm">
            Cancel
          </button>
          <button onClick={handleOpenWhatsApp} disabled={!customMessage.trim()} className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#25d366] px-4 text-[15px] font-bold text-white shadow-sm hover:bg-[#20bd5a] active:bg-[#1da851] disabled:opacity-50 transition-colors">
            <Send size={16} /> Open WhatsApp
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500 truncate -mt-2 mb-2 font-medium">
          {lead.name} • {lead.phone}
        </p>

        {loading && <div className="text-center py-4 text-xs text-slate-500">Loading templates...</div>}
        
        {/* Templates Grid */}
        {!loading && (
          <div className="grid grid-cols-2 gap-2">
            {templates.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => handleSelectTemplate(tpl)}
                className={`text-left p-2.5 rounded-xl border text-[13px] font-semibold transition-colors ${
                  selectedTemplateId === tpl.id ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                }`}
              >
                {tpl.title}
              </button>
            ))}
            <button
              onClick={() => {
                setSelectedTemplateId("custom");
                setCustomMessage("");
                setLastOriginalDraft(null);
                setImproveError(null);
              }}
              className={`text-left p-2.5 rounded-xl border text-[13px] font-semibold transition-colors ${
                selectedTemplateId === "custom" ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 active:bg-slate-100"
              }`}
            >
              Custom Message
            </button>
          </div>
        )}

        {/* Sub-selections based on Template */}
        {activeTemplate?.title === "Website Samples" && (
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
            <p className="text-[13px] font-bold text-slate-700 mb-1">Select Sample Category</p>
            <div className="flex flex-wrap gap-1.5">
              {sampleCategories.map(cat => (
                <button key={cat} onClick={() => setSampleCategory(cat === sampleCategory ? "" : cat)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${sampleCategory === cat ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100 active:bg-slate-200"}`}>
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 mt-2">
              {["LIVE", "DEMO", "ALL"].map(type => (
                <button key={type} onClick={() => setSampleType(type)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${sampleType === type ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100 active:bg-slate-200"}`}>
                  {type}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTemplate?.title === "Packages / Pricing" && (
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
            <div className="flex justify-between items-center mb-1">
              <p className="text-[13px] font-bold text-slate-700">Select Packages</p>
              <button onClick={() => setSelectedPackageIds(new Set(packages.filter(p=>p.isActive).map(p=>p.id)))} className="text-[11px] font-semibold text-emerald-600 hover:underline">Select All</button>
            </div>
            <div className="flex flex-col gap-1.5">
              {packages.filter(p => p.isActive).map(pkg => (
                <label key={pkg.id} className="flex items-center gap-2 text-[13px] font-medium text-slate-700 cursor-pointer p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                  <input 
                    type="checkbox" 
                    checked={selectedPackageIds.has(pkg.id)} 
                    onChange={(e) => {
                      const newSet = new Set(selectedPackageIds);
                      if (e.target.checked) newSet.add(pkg.id);
                      else newSet.delete(pkg.id);
                      setSelectedPackageIds(newSet);
                    }}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                  />
                  <span>
                    {pkg.name} — {pkg.isStartingPrice ? "starting " : ""}₹{Number(pkg.price).toLocaleString('en-IN')}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Preview / Custom Message Editor */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[13px] font-bold text-slate-700">
              {selectedTemplateId === "custom" ? "Message" : "Message Preview (Editable)"}
            </label>
            {selectedTemplateId === "custom" && customMessage.length > 0 && (
              <span className="text-[11px] text-slate-400 font-medium">{customMessage.length} chars</span>
            )}
          </div>
          <textarea
            value={customMessage}
            onChange={(e) => {
              setCustomMessage(e.target.value);
              if (improveError) setImproveError(null);
            }}
            placeholder={selectedTemplateId === "custom" ? "Type your custom WhatsApp message here..." : undefined}
            className="w-full rounded-xl border border-slate-200 p-3 text-[14px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 min-h-[160px] resize-y"
          />

          {/* AI Improve feature - strictly for Custom Message workflow */}
          {selectedTemplateId === "custom" && (
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleImprove}
                    disabled={isImproving || !customMessage.trim()}
                    title={!customMessage.trim() ? "Write a message first." : "Improve message with AI"}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  >
                    <Sparkles
                      size={13}
                      className={isImproving ? "animate-spin text-emerald-600" : "text-emerald-600"}
                      aria-hidden="true"
                    />
                    <span>{isImproving ? "Improving..." : "✨ Improve"}</span>
                  </button>

                  {lastOriginalDraft !== null && (
                    <button
                      type="button"
                      onClick={handleUndoImprovement}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                    >
                      <RotateCcw size={12} aria-hidden="true" />
                      <span>Undo improvement</span>
                    </button>
                  )}
                </div>
              </div>

              {improveError && (
                <p className="text-xs text-rose-600 font-medium flex items-center gap-1">
                  {improveError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
