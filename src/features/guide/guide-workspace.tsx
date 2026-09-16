"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  Contact,
  Palette,
  CheckCircle2,
  Kanban,
  CalendarClock,
  FileText,
  Trash2,
  PhoneCall,
  UploadCloud,
  Bell,
  Sun,
  Search,
  BookOpen,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";

type GuideSection = {
  id: string;
  letter: string;
  title: string;
  category: string;
  icon: typeof LayoutDashboard;
  summary: string;
  details: {
    heading: string;
    items: { label: string; text: string; badge?: string; badgeColor?: string }[];
  }[];
};

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "dashboard",
    letter: "A",
    title: "Dashboard",
    category: "Overview",
    icon: LayoutDashboard,
    summary: "Your daily sales control center showing KPI numbers, priority actions, and live team activity.",
    details: [
      {
        heading: "KPI Cards (Horizontal Scroll on Mobile)",
        items: [
          { label: "Total Leads", text: "Every non-waste prospect entered into your CRM system.", badge: "All" },
          { label: "New Leads", text: "Fresh leads waiting for initial contact and qualification.", badge: "New", badgeColor: "bg-blue-100 text-blue-800" },
          { label: "Qualified", text: "Leads with verified requirements and confirmed budget fit.", badge: "Qualified", badgeColor: "bg-purple-100 text-purple-800" },
          { label: "Warm Clients / Won", text: "Deals successfully closed or converted into active clients.", badge: "Won", badgeColor: "bg-emerald-100 text-emerald-800" },
          { label: "Follow-up Today", text: "Follow-ups scheduled specifically for today in Asia/Kolkata timezone.", badge: "Today", badgeColor: "bg-amber-100 text-amber-800" },
          { label: "Revenue", text: "Total closed pipeline value from won deals.", badge: "INR", badgeColor: "bg-emerald-100 text-emerald-800" },
        ],
      },
      {
        heading: "Dashboard Modules",
        items: [
          { label: "Priority Leads", text: "Leads requiring immediate attention based on engagement and stage aging." },
          { label: "Recent Activity", text: "Chronological feed of status changes, follow-up updates, and notes added by your team." },
        ],
      },
    ],
  },
  {
    id: "lead-card",
    letter: "B",
    title: "Lead Card",
    category: "Lead Management",
    icon: Contact,
    summary: "At-a-glance card designed to answer 'Why am I calling this person?' without opening details.",
    details: [
      {
        heading: "Visible Context",
        items: [
          { label: "Name & Business", text: "Prospect's name with business name immediately below." },
          { label: "Phone Number", text: "One-tap direct dial link that triggers your device phone app." },
          { label: "Quick Status", text: "Interactive status pill with one-click status switching popover." },
          { label: "Upfront Notes Preview", text: "2-4 line preview of the latest meaningful interaction note." },
          { label: "Quick Action Buttons", text: "Dedicated one-tap Call, WhatsApp, and Follow-up triggers." },
        ],
      },
    ],
  },
  {
    id: "operational-colors",
    letter: "C",
    title: "Operational Colors",
    category: "Visual System",
    icon: Palette,
    summary: "Standardized visual indicators indicating what immediate action is required on each lead.",
    details: [
      {
        heading: "Color Code Reference",
        items: [
          { label: "Green (Follow-up Now)", text: "Lead has a follow-up scheduled for today or is overdue. Take action immediately.", badge: "Green", badgeColor: "bg-emerald-100 text-emerald-800" },
          { label: "Yellow (Future Follow-up)", text: "Follow-up is set for a future date. No immediate action required today.", badge: "Yellow", badgeColor: "bg-amber-100 text-amber-800" },
          { label: "Red (Lost)", text: "Lead was marked as lost with a recorded loss reason for sales analytics.", badge: "Red", badgeColor: "bg-red-100 text-red-800" },
          { label: "White / Gray (Waste)", text: "Discarded junk or uncontactable spam kept isolated from active pipeline.", badge: "White", badgeColor: "bg-slate-100 text-slate-700" },
        ],
      },
    ],
  },
  {
    id: "quick-status",
    letter: "D",
    title: "Quick Status System",
    category: "Sales Workflow",
    icon: CheckCircle2,
    summary: "Fast pastel chips for instant outcome recording with a single tap.",
    details: [
      {
        heading: "Available Status Options",
        items: [
          { label: "📞 Contacted", text: "Mark when first outreach has been made. Soft lavender/purple chip.", badge: "Contacted", badgeColor: "bg-purple-100 text-purple-800" },
          { label: "💬 Interested", text: "Prospect showed positive interest; moves stage to Qualified. Soft yellow/amber chip.", badge: "Interested", badgeColor: "bg-amber-100 text-amber-800" },
          { label: "call not pick", text: "Call was unanswered or rejected. Soft pink chip.", badge: "call not pick", badgeColor: "bg-rose-100 text-rose-800" },
          { label: "call again", text: "Prospect requested a callback at another time. Soft lavender/indigo chip.", badge: "call again", badgeColor: "bg-indigo-100 text-indigo-800" },
          { label: "✅ Won", text: "Deal successfully closed. Soft emerald/green chip.", badge: "Won", badgeColor: "bg-emerald-100 text-emerald-800" },
          { label: "❌ Lost", text: "Deal not closing; opens the Lost Reason modal to select root cause. Soft red chip.", badge: "Lost", badgeColor: "bg-red-100 text-red-800" },
        ],
      },
    ],
  },
  {
    id: "pipeline",
    letter: "E",
    title: "Pipeline Stages",
    category: "Pipeline",
    icon: Kanban,
    summary: "Kanban board for tracking leads through standard sales progression stages.",
    details: [
      {
        heading: "Canonical Stages",
        items: [
          { label: "New", text: "Inbound or imported lead not yet engaged." },
          { label: "Contacted", text: "Initial phone call, message, or email outreach completed." },
          { label: "Qualified", text: "Budget, authority, need, and timeline verified." },
          { label: "Proposal Sent", text: "Formal quotation or commercial proposal delivered." },
          { label: "Won", text: "Contract signed, deposit received, or sale confirmed." },
          { label: "Lost", text: "Deal lost with structured loss analytics tracking." },
        ],
      },
    ],
  },
  {
    id: "followups",
    letter: "F",
    title: "Follow-ups",
    category: "Follow-ups",
    icon: CalendarClock,
    summary: "Schedule precise call, WhatsApp, and email reminders with exact dates and times.",
    details: [
      {
        heading: "How to Manage Follow-ups",
        items: [
          { label: "Adding Follow-up", text: "Click 'Follow-up' on any lead card or detail page. Pick exact date + time." },
          { label: "Today / Overdue / Upcoming", text: "Categorized automatically into Overdue (past due), Today, and Upcoming tabs." },
          { label: "Next Follow-up Sync", text: "Creating or completing follow-ups automatically synchronizes the lead's next follow-up date." },
        ],
      },
    ],
  },
  {
    id: "notes",
    letter: "G",
    title: "Notes & Interaction History",
    category: "Activity",
    icon: FileText,
    summary: "Record conversation takeaways so you and your team always have context.",
    details: [
      {
        heading: "Working with Notes",
        items: [
          { label: "Why Notes Matter", text: "Provides upfront context on lead cards so you never call a client unprepared." },
          { label: "Where Notes Appear", text: "Directly on lead cards, inside Lead Detail Notes timeline, and in recent activity feeds." },
          { label: "How to Add", text: "Type in the Note Composer on Lead Detail or quick note actions, then click Add Note." },
        ],
      },
    ],
  },
  {
    id: "waste-leads",
    letter: "H",
    title: "Waste Leads",
    category: "Hygiene",
    icon: Trash2,
    summary: "Clean up junk leads without permanently deleting records or skewing analytics.",
    details: [
      {
        heading: "Handling Waste Leads",
        items: [
          { label: "What Waste Means", text: "Invalid numbers, spam entries, or irrelevant inquiries marked as Waste." },
          { label: "Filtering Waste", text: "Use the Waste filter on the Leads page to view all isolated waste leads." },
          { label: "How to Restore", text: "Open any waste lead and click 'Restore from Waste' to return it to active pipeline." },
        ],
      },
    ],
  },
  {
    id: "whatsapp-calling",
    letter: "I",
    title: "WhatsApp & Calling",
    category: "Outreach",
    icon: PhoneCall,
    summary: "Instant one-tap communication tools for high-velocity sales teams.",
    details: [
      {
        heading: "One-Tap Actions",
        items: [
          { label: "One-Tap Calling", text: "Click the Call button on any card to dial immediately from your phone." },
          { label: "WhatsApp Quick Action", text: "Opens WhatsApp Web or mobile app with personalized message template." },
          { label: "WhatsApp Templates", text: "Manage pre-written templates in WhatsApp Templates section for quick follow-ups." },
        ],
      },
    ],
  },
  {
    id: "bulk-entry",
    letter: "J",
    title: "Bulk Lead Entry",
    category: "Import",
    icon: UploadCloud,
    summary: "Paste unformatted text, spreadsheets, or chat logs to create multiple leads simultaneously.",
    details: [
      {
        heading: "Bulk Workflow",
        items: [
          { label: "Paste Multiple Leads", text: "Paste raw lines of text with names, phone numbers, and notes into the bulk box." },
          { label: "Review & Edit", text: "Verify parsed fields in the interactive review table before committing." },
          { label: "Duplicate Handling", text: "Identifies duplicate phone numbers with options to merge, update, or skip." },
        ],
      },
    ],
  },
  {
    id: "notifications",
    letter: "K",
    title: "Notifications",
    category: "Alerts",
    icon: Bell,
    summary: "Automated sales reminders alerting you to urgent and overdue client needs.",
    details: [
      {
        heading: "Notification Categories",
        items: [
          { label: "Urgent Alerts", text: "High-priority leads that need immediate contact or hot opportunities." },
          { label: "Overdue Reminders", text: "Follow-ups that passed their scheduled time without completion." },
          { label: "Follow-up Due Today", text: "Morning checklist of all client calls and messages scheduled for today." },
        ],
      },
    ],
  },
  {
    id: "daily-briefing",
    letter: "L",
    title: "Daily Sales Briefing",
    category: "Intelligence",
    icon: Sun,
    summary: "Automated morning summary highlighting key priorities and pipeline health.",
    details: [
      {
        heading: "Briefing Overview",
        items: [
          { label: "Morning Summary", text: "AI-curated summary of yesterday's wins, today's schedule, and overdue bottlenecks." },
          { label: "Action Focus", text: "Clear list of the top 3-5 leads that deserve your immediate sales focus." },
        ],
      },
    ],
  },
];

export function GuideWorkspace() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const categories = ["All", ...Array.from(new Set(GUIDE_SECTIONS.map((s) => s.category)))];

  const filteredSections = GUIDE_SECTIONS.filter((section) => {
    const matchesCategory = activeCategory === "All" || section.category === activeCategory;
    const query = search.toLowerCase().trim();
    if (!query) return matchesCategory;

    const matchesSearch =
      section.title.toLowerCase().includes(query) ||
      section.summary.toLowerCase().includes(query) ||
      section.details.some((d) =>
        d.heading.toLowerCase().includes(query) ||
        d.items.some((i) => i.label.toLowerCase().includes(query) || i.text.toLowerCase().includes(query))
      );

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM Guide"
        description="Simple, practical explanations for every feature, status, color code, and workflow in Scale Flow CRM."
      />

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guide (e.g., Quick Status, Colors, Follow-ups)..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                activeCategory === cat
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Guide Cards Grid */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-2">
        {filteredSections.map((section) => {
          const SectionIcon = section.icon;
          return (
            <div
              key={section.id}
              id={section.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-slate-300 hover:shadow-md"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700 border border-blue-100 font-bold text-sm">
                      {section.letter}
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">{section.title}</h2>
                      <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {section.category}
                      </span>
                    </div>
                  </div>
                  <SectionIcon size={20} className="text-slate-400 mt-1" />
                </div>

                {/* Summary */}
                <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                  {section.summary}
                </p>

                {/* Detailed Breakdown */}
                <div className="mt-4 space-y-3.5 border-t border-slate-100 pt-3.5">
                  {section.details.map((group, gIdx) => (
                    <div key={gIdx} className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {group.heading}
                      </p>
                      <div className="space-y-2">
                        {group.items.map((item, iIdx) => (
                          <div key={iIdx} className="rounded-xl bg-slate-50/80 p-2.5 border border-slate-100 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-900">{item.label}</span>
                              {item.badge && (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.badgeColor || "bg-slate-200 text-slate-700"}`}>
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-slate-600 leading-normal">{item.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredSections.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <BookOpen size={36} className="mx-auto text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-slate-900">No matching guide topics found</p>
          <p className="mt-1 text-xs text-slate-500">Try searching for keywords like &quot;Follow-up&quot;, &quot;Lost&quot;, or &quot;Colors&quot;.</p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setActiveCategory("All");
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Reset filters
          </button>
        </div>
      )}
    </div>
  );
}
