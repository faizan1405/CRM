"use client";

import { useState, useMemo } from "react";
import {
  MessageSquare,
  Plus,
  Search,
  X,
  Eye,
  Send,
} from "lucide-react";
import type {
  WhatsAppTemplate,
  WhatsAppTemplateCategory,
  WhatsAppTemplatesProps,
} from "../types";
import { initialMockWhatsAppTemplates } from "../mock-data";
import { TemplateCard } from "./template-card";
import { TemplateEditor } from "./template-editor";
import { TemplatePreviewCard } from "./template-preview-card";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { WhatsAppLeadComposer } from "./whatsapp-lead-composer";

const CATEGORY_TABS: Array<{ value: "all" | WhatsAppTemplateCategory; label: string }> = [
  { value: "all", label: "All Templates" },
  { value: "first_contact", label: "First Contact" },
  { value: "after_call", label: "After Call" },
  { value: "follow_up", label: "Follow-up" },
  { value: "quotation_sent", label: "Quotation Sent" },
  { value: "quotation_followup", label: "Quotation Follow-up" },
  { value: "no_response", label: "No Response" },
  { value: "final_followup", label: "Final Follow-up" },
  { value: "converted", label: "Converted" },
];

export function WhatsAppTemplatesWorkspace({
  initialTemplates = initialMockWhatsAppTemplates,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onDuplicateTemplate,
}: WhatsAppTemplatesProps) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(initialTemplates);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | WhatsAppTemplateCategory>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(templates[0] || null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Test composer modal trigger
  const [testComposerOpen, setTestComposerOpen] = useState(false);

  // Filter templates by search and category
  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return templates.filter((t) => {
      const matchesQuery = !q || t.title.toLowerCase().includes(q) || t.body.toLowerCase().includes(q);
      const matchesCategory = selectedCategory === "all" || t.category === selectedCategory;
      return matchesQuery && matchesCategory;
    });
  }, [templates, searchQuery, selectedCategory]);

  // Create or Update template
  const handleSaveTemplate = async (data: {
    id?: string;
    title: string;
    category: WhatsAppTemplateCategory;
    categoryLabel: string;
    body: string;
    active: boolean;
  }) => {
    setIsSaving(true);
    try {
      if (data.id) {
        if (onUpdateTemplate) {
          await onUpdateTemplate(data.id, data);
        }
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === data.id
              ? {
                  ...t,
                  ...data,
                  updatedAt: new Date().toISOString(),
                }
              : t
          )
        );
      } else {
        if (onCreateTemplate) {
          const created = await onCreateTemplate(data);
          if (created) {
            setTemplates((prev) => [created, ...prev]);
          }
        } else {
          const newTpl: WhatsAppTemplate = {
            id: `tpl-${Date.now()}`,
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setTemplates((prev) => [newTpl, ...prev]);
        }
      }
      setIsEditorOpen(false);
      setEditingTemplate(null);
    } finally {
      setIsSaving(false);
    }
  };

  // Duplicate template
  const handleDuplicateTemplate = async (tpl: WhatsAppTemplate) => {
    const duplicateData = {
      title: `${tpl.title} (Copy)`,
      category: tpl.category,
      categoryLabel: tpl.categoryLabel,
      body: tpl.body,
      active: true,
    };

    if (onDuplicateTemplate) {
      const created = await onDuplicateTemplate(tpl);
      if (created) setTemplates((prev) => [created, ...prev]);
    } else {
      const newTpl: WhatsAppTemplate = {
        id: `tpl-${Date.now()}`,
        ...duplicateData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setTemplates((prev) => [newTpl, ...prev]);
    }
  };

  // Toggle active state
  const handleToggleActive = async (tpl: WhatsAppTemplate) => {
    const nextActive = !tpl.active;
    if (onUpdateTemplate) {
      await onUpdateTemplate(tpl.id, { active: nextActive });
    }
    setTemplates((prev) =>
      prev.map((t) => (t.id === tpl.id ? { ...t, active: nextActive } : t))
    );
  };

  // Delete template
  const handleConfirmDelete = async () => {
    if (!deletingTemplate) return;
    setIsDeleting(true);
    try {
      if (onDeleteTemplate) {
        await onDeleteTemplate(deletingTemplate.id);
      }
      setTemplates((prev) => prev.filter((t) => t.id !== deletingTemplate.id));
      if (selectedTemplate?.id === deletingTemplate.id) {
        setSelectedTemplate(null);
      }
    } finally {
      setIsDeleting(false);
      setDeletingTemplate(null);
    }
  };

  const handleOpenEditor = (tpl: WhatsAppTemplate | null = null) => {
    setEditingTemplate(tpl);
    setIsEditorOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
              WhatsApp Templates
            </h1>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
              {templates.length} Templates
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Speed up client communication with personalized outreach templates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Test Lead Composer Demo Button */}
          <button
            type="button"
            onClick={() => setTestComposerOpen(true)}
            className="inline-flex min-h-11 flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs sm:text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <Send size={15} className="text-emerald-600" aria-hidden="true" />
            <span>Test Lead Composer</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenEditor(null)}
            className="inline-flex min-h-11 flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 active:bg-emerald-800 transition-colors"
          >
            <Plus size={18} aria-hidden="true" />
            <span>New Template</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <label htmlFor="template-search-input" className="sr-only">
          Search WhatsApp templates
        </label>
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          id="template-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search templates by title or message content..."
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 grid size-6 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Category Filter Tabs (Mobile Scrollable) */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1.5 min-w-max">
          {CATEGORY_TABS.map((tab) => {
            const isSelected = selectedCategory === tab.value;
            const count =
              tab.value === "all"
                ? templates.length
                : templates.filter((t) => t.category === tab.value).length;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setSelectedCategory(tab.value)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-white text-slate-600 border border-slate-200/90 hover:bg-slate-50"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split Layout: Desktop Template List | Preview vs Mobile List */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Templates List (Left Column) */}
        <div className="space-y-4 lg:col-span-7">
          {filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-8 sm:p-12 text-center">
              <MessageSquare size={28} className="text-slate-400 mb-2" aria-hidden="true" />
              <h3 className="text-base font-bold text-slate-900">No templates found</h3>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">
                {searchQuery
                  ? "Try changing your search query or clear the filter."
                  : "Create your first template to speed up WhatsApp outreach."}
              </p>
              <button
                type="button"
                onClick={() => handleOpenEditor(null)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Plus size={14} aria-hidden="true" />
                <span>Create Template</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredTemplates.map((tpl) => (
                <TemplateCard
                  key={tpl.id}
                  template={tpl}
                  isSelected={selectedTemplate?.id === tpl.id}
                  onSelect={(t) => setSelectedTemplate(t)}
                  onEdit={(t) => handleOpenEditor(t)}
                  onDuplicate={handleDuplicateTemplate}
                  onToggleActive={handleToggleActive}
                  onDeleteRequest={(t) => setDeletingTemplate(t)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Desktop Live Preview / Detail Panel (Right Column) */}
        <div className="hidden lg:block lg:col-span-5 sticky top-6 self-start space-y-4">
          {selectedTemplate ? (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <span className="rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    {selectedTemplate.categoryLabel}
                  </span>
                  <h3 className="mt-1 font-bold text-slate-950 text-base">
                    {selectedTemplate.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenEditor(selectedTemplate)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Edit
                </button>
              </div>

              <TemplatePreviewCard body={selectedTemplate.body} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <Eye size={22} className="text-slate-400 mb-2" aria-hidden="true" />
              <p className="text-xs font-semibold text-slate-600">Select a template to preview</p>
            </div>
          )}
        </div>
      </div>

      {/* Editor Modal (Slide up / Full dialog) */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-2 sm:p-4">
          <div className="flex-1 w-full max-w-3xl max-h-[92vh] overflow-hidden">
            <TemplateEditor
              template={editingTemplate}
              onSave={handleSaveTemplate}
              onClose={() => {
                setIsEditorOpen(false);
                setEditingTemplate(null);
              }}
              isSaving={isSaving}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={Boolean(deletingTemplate)}
        title={deletingTemplate?.title || ""}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingTemplate(null)}
        isDeleting={isDeleting}
      />

      {/* Test Lead Message Composer Dialog */}
      <WhatsAppLeadComposer
        isOpen={testComposerOpen}
        lead={{
          id: "demo-lead-1",
          name: "Rahul Sharma",
          phone: "+91 98765 43210",
          business: "Apex Logistics",
          requirement: "Enterprise CRM & Automation",
          budget: "₹45,000",
          followUpDate: "Tomorrow",
          followUpTime: "11:30 AM",
          status: "Proposal Sent",
        }}
        templates={templates}
        initialTemplateId={selectedTemplate?.id}
        onClose={() => setTestComposerOpen(false)}
      />
    </div>
  );
}
