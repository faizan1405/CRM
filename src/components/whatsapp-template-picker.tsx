"use client";

import { useState, useEffect } from "react";
import { MessageCircle, X, Send, Plus, Minus, Search } from "lucide-react";
import { getWebsitePackages, getWebsiteSamples } from "@/app/actions/sales-assets";
import { getWhatsAppTemplates } from "@/app/actions/whatsapp-templates";
import { logWhatsAppOpened } from "@/app/actions/whatsapp-logger";

import type { WebsitePackage, WebsiteSample, Lead } from "@prisma/client";
import type { WhatsAppTemplate } from "@/features/whatsapp-templates/types";

import type { WhatsAppConfig } from "./whatsapp-context";

let cachedPackages: WebsitePackage[] | null = null;
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
  const [packages, setPackages] = useState<WebsitePackage[]>([]);
  const [samples, setSamples] = useState<WebsiteSample[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [customMessage, setCustomMessage] = useState<string>("");

  // Sub-selections
  const [sampleCategory, setSampleCategory] = useState<string>("");
  const [sampleType, setSampleType] = useState<string>("ALL"); // LIVE, DEMO, ALL
  const [selectedPackageIds, setSelectedPackageIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      const loadData = async () => {
        if (!cachedTemplates || !cachedPackages || !cachedSamples) {
          setLoading(true);
          const [p, s, t] = await Promise.all([
            getWebsitePackages(),
            getWebsiteSamples(),
            getWhatsAppTemplates(),
          ]);
          if (p.success) cachedPackages = p.data || [];
          if (s.success) cachedSamples = s.data || [];
          if (t.success) cachedTemplates = t.data || [];
          setLoading(false);
        }
        setPackages(cachedPackages || []);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setSamples((cachedSamples as any[]) || []);
        // @ts-expect-error - compatibility
        setTemplates((cachedTemplates || []).filter(t => t.isActive || t.active));
      };
      loadData();
    }
  }, [isOpen]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const interpolateMessage = (tpl: any) => {
    let msg = tpl?.message || tpl?.body || "";
    
    // Replace standard variables safely
    msg = msg.replace(/{{leadName}}/g, lead?.name || "{{leadName}}");
    msg = msg.replace(/{{phone}}/g, lead?.phone || "{{phone}}");
    msg = msg.replace(/{{quotedAmount}}/g, lead?.quotedAmount ? `₹${Number(lead.quotedAmount).toLocaleString('en-IN')}` : "{{quotedAmount}}");
    msg = msg.replace(/{{status}}/g, lead?.status || "{{status}}");
    msg = msg.replace(/{{followUpDate}}/g, lead?.followUpDate || "{{followUpDate}}");

    if (tpl?.title === "Website Samples") {
      const filteredSamples = samples.filter(s => 
        (sampleCategory ? s.category === sampleCategory : true) &&
        (sampleType === "ALL" ? true : s.type === sampleType) &&
        s.isActive
      );
      
      if (config?.sampleId || config?.category) {
        // Use exact requested format for direct sample sharing
        if (config.sampleId) {
          const s = samples.find(s => s.id === config.sampleId);
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
      const selectedPkgs = packages.filter(p => selectedPackageIds.has(p.id) && p.isActive);
      
      if (config?.packageId && selectedPkgs.length === 1) {
        // Exact requested format for direct package sharing
        const p = selectedPkgs[0];
        msg = `What's up from you?\n\nSharing our ${p.name} Website Package:\n\n${p.name} Package — ₹${Number(p.price).toLocaleString('en-IN')}\n\n${p.inclusions.split('\n').map(l => `• ${l.trim()}`).join('\n')}\n\nLet me know if you'd like to proceed or discuss the requirement.`;
      } else {
        const links = selectedPkgs.map(p => `• ${p.name} — ${p.isStartingPrice ? "starting " : ""}₹${Number(p.price).toLocaleString('en-IN')}\n  ${p.inclusions.replace(/\n/g, "\n  ")}`).join("\n\n");
        msg = msg.replace(/{{packagePricingLinks}}/g, links || "(No packages selected)");
      }
    }

    return msg;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSelectTemplate = (tpl: any) => {
    setSelectedTemplateId(tpl.id);
    setCustomMessage(interpolateMessage(tpl));
  };

  // When templates load or config changes, set default
  useEffect(() => {
    if (isOpen && templates.length > 0) {
      if (config?.templateTitle) {
        const tpl = templates.find(t => t.title === config.templateTitle) || templates[0];
        if (config.packageId) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setSelectedPackageIds(new Set([config.packageId]));
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
        handleSelectTemplate(tpl);
      } else if (!selectedTemplateId) {
        const defaultTpl = templates.find(t => t.title === "Introduction") || templates[0];
        handleSelectTemplate(defaultTpl);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, templates, config]);

  // Re-generate message if sub-selections change
  useEffect(() => {
    const tpl = templates.find(t => t.id === selectedTemplateId);
    if (!tpl) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomMessage(interpolateMessage(tpl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleCategory, sampleType, selectedPackageIds]);


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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-950/45 transition-opacity" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div className="relative flex w-full max-w-xl max-h-[90vh] sm:max-h-[85vh] flex-col rounded-t-2xl sm:rounded-2xl border-t sm:border border-slate-200 bg-white shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-100 bg-[#25d366]/10 px-4 py-3">
          <div className="flex flex-col min-w-0">
            <h2 className="text-sm font-bold text-slate-900 truncate flex items-center gap-2">
              <MessageCircle size={16} className="text-[#25d366]" /> Send WhatsApp
            </h2>
            <p className="text-xs text-slate-500 truncate">
              {lead.name} • {lead.phone}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <X size={18} />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && <div className="text-center py-4 text-xs text-slate-500">Loading templates...</div>}
          
          {/* Templates Grid */}
          {!loading && (
            <div className="grid grid-cols-2 gap-2">
              {templates.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl)}
                  className={`text-left p-2 rounded-xl border text-xs font-semibold transition-colors ${
                    selectedTemplateId === tpl.id ? "bg-emerald-50 border-emerald-500 text-emerald-800" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {tpl.title}
                </button>
              ))}
              <button
                onClick={() => {
                  setSelectedTemplateId("custom");
                  setCustomMessage("");
                }}
                className={`text-left p-2 rounded-xl border text-xs font-semibold transition-colors ${
                  selectedTemplateId === "custom" ? "bg-emerald-50 border-emerald-500 text-emerald-800" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                Custom Message
              </button>
            </div>
          )}

          {/* Sub-selections based on Template */}
          {activeTemplate?.title === "Website Samples" && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
              <p className="text-xs font-bold text-slate-700 mb-1">Select Sample Category</p>
              <div className="flex flex-wrap gap-1.5">
                {sampleCategories.map(cat => (
                  <button key={cat} onClick={() => setSampleCategory(cat === sampleCategory ? "" : cat)} className={`px-2 py-1 rounded text-xs font-medium border ${sampleCategory === cat ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 mt-2">
                {["LIVE", "DEMO", "ALL"].map(type => (
                  <button key={type} onClick={() => setSampleType(type)} className={`px-2 py-1 rounded text-xs font-medium border ${sampleType === type ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"}`}>
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTemplate?.title === "Packages / Pricing" && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2">
              <div className="flex justify-between items-center mb-1">
                <p className="text-xs font-bold text-slate-700">Select Packages</p>
                <button onClick={() => setSelectedPackageIds(new Set(packages.filter(p=>p.isActive).map(p=>p.id)))} className="text-[10px] font-semibold text-emerald-600 hover:underline">Select All</button>
              </div>
              <div className="flex flex-col gap-1.5">
                {packages.filter(p => p.isActive).map(pkg => (
                  <label key={pkg.id} className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer p-1.5 hover:bg-slate-100 rounded">
                    <input 
                      type="checkbox" 
                      checked={selectedPackageIds.has(pkg.id)} 
                      onChange={(e) => {
                        const newSet = new Set(selectedPackageIds);
                        if (e.target.checked) newSet.add(pkg.id);
                        else newSet.delete(pkg.id);
                        setSelectedPackageIds(newSet);
                      }} 
                    />
                    {pkg.name} — ₹{Number(pkg.price).toLocaleString('en-IN')}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Preview Editor */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Message Preview (Editable)</label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 min-h-[160px]"
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-slate-100 p-4 bg-slate-50/50 rounded-b-2xl flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button onClick={handleOpenWhatsApp} disabled={!customMessage.trim()} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-[#25d366] text-white hover:bg-[#20bd5a] disabled:opacity-50">
            <Send size={16} /> Open WhatsApp
          </button>
        </footer>
      </div>
    </div>
  );
}
