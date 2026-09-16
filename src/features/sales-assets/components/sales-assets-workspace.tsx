"use client";

import { useState } from "react";
import { Package, Globe, MessageSquare } from "lucide-react";
import { WhatsAppTemplatesWorkspace } from "@/features/whatsapp-templates/components/templates-workspace";
import { PackagesWorkspace } from "./packages-workspace";
import { SamplesWorkspace } from "./samples-workspace";

import { 
  createWhatsAppTemplate, 
  updateWhatsAppTemplate, 
  deleteWhatsAppTemplate, 
  duplicateWhatsAppTemplate 
} from "@/app/actions/whatsapp-templates";

import type { WebsitePackage, WebsiteSample, WhatsAppTemplate, WhatsAppTemplateCategory } from "@prisma/client";

export function SalesAssetsWorkspace({
  initialPackages,
  initialSamples,
  initialTemplates,
}: {
  initialPackages: WebsitePackage[];
  initialSamples: WebsiteSample[];
  initialTemplates: WhatsAppTemplate[];
}) {
  const [activeTab, setActiveTab] = useState<"packages" | "samples" | "templates">("packages");

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
            Sales Assets
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage packages, samples, and WhatsApp templates.
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("packages")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "packages" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Package size={16} />
            Packages
          </button>
          <button
            onClick={() => setActiveTab("samples")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "samples" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Globe size={16} />
            Samples
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "templates" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <MessageSquare size={16} />
            Templates
          </button>
        </div>
      </div>

      <div className="mt-6">
        {activeTab === "packages" && (
          <PackagesWorkspace initialPackages={initialPackages} />
        )}
        {activeTab === "samples" && (
          <SamplesWorkspace initialSamples={initialSamples} />
        )}
        {activeTab === "templates" && (
          <WhatsAppTemplatesWorkspace 
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            initialTemplates={initialTemplates as any}
            onCreateTemplate={async (data) => {
              const res = await createWhatsAppTemplate({
                title: data.title,
                category: data.category as WhatsAppTemplateCategory,
                message: data.body,
                isActive: data.active,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any);
              if (!res.success) throw new Error(res.error);
              return;
            }}
            onUpdateTemplate={async (id, data) => {
              const res = await updateWhatsAppTemplate(id, {
                title: data.title,
                category: data.category as WhatsAppTemplateCategory,
                message: data.body,
                isActive: data.active
              });
              if (!res.success) throw new Error(res.error);
              return;
            }}
            onDeleteTemplate={async (id) => {
              const res = await deleteWhatsAppTemplate(id);
              if (!res.success) throw new Error(res.error);
              return;
            }}
            onDuplicateTemplate={async (tpl) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const res = await duplicateWhatsAppTemplate((tpl as any).id);
              if (!res.success) throw new Error(res.error);
              return;
            }}
          />
        )}
      </div>
    </div>
  );
}
