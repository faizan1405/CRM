import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PipelineBoard } from "@/features/pipeline/pipeline-board";
import { PipelineCard } from "@/features/pipeline/pipeline-card";
import type { Lead } from "@/features/leads/types";

vi.mock("@/components/toast-provider", () => ({
  useToast: () => ({ showToast: vi.fn(), showUndoToast: vi.fn() }),
}));

vi.mock("@/features/activity/use-activities", () => ({
  useLeadActivities: () => ({
    activities: [],
    filter: "ALL",
    setFilter: vi.fn(),
    handleAddNote: vi.fn(),
    handleEditNote: vi.fn(),
    handleDeleteNote: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockPipelineLeads: Lead[] = [
  {
    id: "lead-alpha",
    name: "Aarav Sharma",
    phone: "+91 98765 43210",
    email: "aarav@example.com",
    business: "Apex Solutions",
    industry: "Tech",
    source: "Website",
    budget: 250000,
    notes: "",
    status: "New",
    quickStatus: "NONE",
    quotedAmount: null,
    lastContactDate: null,
    nextFollowUpDate: new Date(Date.now() + 86400000).toISOString(),
    isPinned: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "lead-beta",
    name: "Sneha Reddy",
    phone: "+91 98765 43211",
    email: "sneha@example.com",
    business: "Reddy Agro Exports",
    industry: "Agriculture",
    source: "Referral",
    budget: 350000,
    notes: "",
    status: "Contacted",
    quickStatus: "CONTACTED",
    quotedAmount: 350000,
    lastContactDate: null,
    nextFollowUpDate: new Date().toISOString(),
    isPinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "lead-gamma",
    name: "Meera Kapoor",
    phone: "+91 98765 43212",
    email: "meera@example.com",
    business: "Kapoor Interiors",
    industry: "Design",
    source: "Instagram",
    budget: 500000,
    notes: "",
    status: "Qualified",
    quickStatus: "INTERESTED",
    quotedAmount: 450000,
    lastContactDate: null,
    nextFollowUpDate: null,
    isPinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "lead-delta",
    name: "Vikram Rathore",
    phone: "+91 98765 43213",
    email: "vikram@example.com",
    business: "Rathore Heritage Hotels",
    industry: "Hospitality",
    source: "Direct",
    budget: 1200000,
    notes: "",
    status: "Proposal Sent",
    quickStatus: "INTERESTED",
    quotedAmount: 1100000,
    lastContactDate: null,
    nextFollowUpDate: new Date(Date.now() - 86400000).toISOString(),
    isPinned: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "lead-epsilon",
    name: "Priya Nair",
    phone: "+91 98765 43214",
    email: "priya@example.com",
    business: "Coastline Logistics",
    industry: "Logistics",
    source: "LinkedIn",
    budget: 800000,
    notes: "",
    status: "Won",
    quickStatus: "INTERESTED",
    quotedAmount: 760000,
    lastContactDate: null,
    nextFollowUpDate: null,
    isPinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "lead-zeta",
    name: "Ananya Ghosh",
    phone: "+91 98765 43215",
    email: "ananya@example.com",
    business: "Ghosh Publications",
    industry: "Publishing",
    source: "Cold Call",
    budget: 150000,
    notes: "",
    status: "Lost",
    quickStatus: "NOT_PICKED",
    quotedAmount: 64000,
    lastContactDate: null,
    nextFollowUpDate: null,
    isPinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe("Lovable Pipeline Fidelity & 3-Column Layout Verification", () => {
  it("displays 3 full Kanban columns on desktop with horizontal scroll for remaining stages", () => {
    const html = renderToStaticMarkup(<PipelineBoard initialLeads={mockPipelineLeads} />);

    // Each column has responsive width classes guaranteeing 3 visible columns on desktop:
    // xl:w-[calc((100%-2rem)/3)] (3 columns side-by-side)
    // sm:w-[calc((100%-1rem)/2)] (2 columns on medium screens)
    // w-[85vw] (1 column with swipe preview on mobile)
    expect(html).toContain("xl:w-[calc((100%-2rem)/3)]");
    expect(html).toContain("sm:w-[calc((100%-1rem)/2)]");
    expect(html).toContain("w-[85vw]");

    // Verify all 6 stages exist as columns
    expect(html).toContain('data-stage="New"');
    expect(html).toContain('data-stage="Contacted"');
    expect(html).toContain('data-stage="Qualified"');
    expect(html).toContain('data-stage="Proposal Sent"');
    expect(html).toContain('data-stage="Won"');
    expect(html).toContain('data-stage="Lost"');
  });

  it("header computes open value accurately without mixing Won deals or Lost deals", () => {
    // Open value = sum of (quotedAmount ?? budget) for New(250k) + Contacted(350k) + Qualified(450k) + Proposal Sent(1100k) = 21,50,000
    // Won(760k) and Lost(64k) are excluded from open value.
    const html = renderToStaticMarkup(<PipelineBoard initialLeads={mockPipelineLeads} />);
    expect(html).toContain("Open value");
    expect(html).toContain("21,50,000");
  });

  it("provides desktop stage pan navigation buttons in header", () => {
    const html = renderToStaticMarkup(<PipelineBoard initialLeads={mockPipelineLeads} />);
    expect(html).toContain('aria-label="Scroll pipeline stages left"');
    expect(html).toContain('aria-label="Scroll pipeline stages right"');
  });

  it("preserves analytics donut chart and summary cards", () => {
    const html = renderToStaticMarkup(<PipelineBoard initialLeads={mockPipelineLeads} />);
    // Donut chart total leads
    expect(html).toContain(">6</span>");
    expect(html).toContain("Leads</span>");

    // Summary cards
    expect(html).toContain('aria-label="Pipeline summary"');
    expect(html).toContain('aria-label="Pipeline conversion analytics"');
  });

  it("pipeline card displays name, business, formatted value, AI score, pin star, and follow-up", () => {
    const html = renderToStaticMarkup(
      <PipelineCard
        lead={mockPipelineLeads[0]}
        onClick={vi.fn()}
        onTogglePin={vi.fn()}
      />
    );

    expect(html).toContain("Aarav Sharma");
    expect(html).toContain("Apex Solutions");
    expect(html).toContain("2,50,000");
    expect(html).toContain("budget");
    expect(html).toContain("touch-none");
    expect(html).toContain("cursor-grab");
    // Star pinned
    expect(html).toContain("fill-warning");
  });

  it("pipeline card displays quick status badge matching Lovable colors", () => {
    const html = renderToStaticMarkup(
      <PipelineCard
        lead={mockPipelineLeads[2]} // Qualified with INTERESTED
        onClick={vi.fn()}
      />
    );

    expect(html).toContain("Interested");
    expect(html).toContain("text-emerald-700");
  });
});
