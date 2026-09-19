"use client";

import { useState, useEffect } from "react";
import { CheckCheck, Eye, Code2, Sparkles } from "lucide-react";
import { interpolatePlaceholders } from "../placeholders";
import type { WhatsAppComposerLead } from "../types";
import type { WebsitePackage } from "@prisma/client";
import { getCachedPackages, subscribePackagesUpdated } from "@/features/sales-assets/packages-sync";

interface TemplatePreviewCardProps {
  body: string;
  lead?: WhatsAppComposerLead | null;
  packages?: WebsitePackage[];
  className?: string;
}

export function TemplatePreviewCard({
  body,
  lead,
  packages: propPackages,
  className = "",
}: TemplatePreviewCardProps) {
  const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");
  const [packages, setPackages] = useState<WebsitePackage[]>(() => propPackages || getCachedPackages() || []);

  useEffect(() => {
    if (propPackages) {
      setPackages(propPackages);
    }
  }, [propPackages]);

  useEffect(() => {
    const unsubscribe = subscribePackagesUpdated((updatedPkgs) => {
      setPackages(updatedPkgs);
    });
    return unsubscribe;
  }, []);

  const renderedMessage = interpolatePlaceholders(body, lead, true, packages);
  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div
      className={`rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/50 via-slate-50/30 to-white p-4 shadow-xs ${className}`}
    >
      {/* Header with Sample Data Badge and Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
            WhatsApp Live Preview
          </span>
          <span className="rounded bg-emerald-100/80 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
            {lead ? `Preview for ${lead.name}` : "Sample Preview Data"}
          </span>
        </div>

        <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode("rendered")}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
              viewMode === "rendered"
                ? "bg-emerald-600 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Eye size={12} aria-hidden="true" />
            <span>Personalized</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("raw")}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
              viewMode === "raw"
                ? "bg-slate-800 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Code2 size={12} aria-hidden="true" />
            <span>Raw Template</span>
          </button>
        </div>
      </div>

      {/* WhatsApp Message Bubble Simulation */}
      <div className="mt-4 rounded-xl bg-[#e5ddd5]/60 p-3 sm:p-4 border border-[#d1d7db]">
        <div className="relative max-w-sm rounded-lg rounded-tl-xs bg-[#d9fdd3] p-3 shadow-xs text-xs text-slate-900 leading-relaxed font-sans whitespace-pre-wrap break-words">
          {viewMode === "rendered" ? (
            renderedMessage || <span className="italic text-slate-400">Empty message...</span>
          ) : (
            body || <span className="italic text-slate-400">Empty template body...</span>
          )}

          <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-500 font-medium select-none">
            <span>{currentTime}</span>
            <CheckCheck size={14} className="text-blue-500" aria-label="Delivered" />
          </div>
        </div>
      </div>

      <p className="mt-2.5 text-[11px] text-slate-500 flex items-center gap-1">
        <Sparkles size={11} className="text-emerald-600 shrink-0" aria-hidden="true" />
        <span>
          {lead
            ? "Placeholders populated with active lead profile data."
            : "Sample values are substituted for placeholders during preview."}
        </span>
      </p>
    </div>
  );
}
