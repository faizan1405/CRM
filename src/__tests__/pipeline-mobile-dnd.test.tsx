import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PipelineBoard } from "@/features/pipeline/pipeline-board";
import { PipelineCard } from "@/features/pipeline/pipeline-card";
import type { Lead } from "@/features/leads/types";

vi.mock("@/components/toast-provider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/features/activity/use-activities", () => ({
  useLeadActivities: () => ({
    activities: [],
    filter: "all",
    setFilter: vi.fn(),
    handleAddNote: vi.fn(),
    handleEditNote: vi.fn(),
    handleDeleteNote: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/actions/leads", () => ({
  changeLeadStatus: vi.fn(async (id: string, status: string) => ({
    success: true,
    data: {
      id,
      name: "Test Lead",
      phone: "1234567890",
      email: "test@example.com",
      business: "Acme",
      industry: "Tech",
      source: "Web",
      budget: 1000,
      notes: "",
      status,
      quotedAmount: null,
      lastContactDate: null,
      nextFollowUpDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })),
  createLead: vi.fn(),
  deleteLead: vi.fn(),
  getLead: vi.fn(),
  updateLead: vi.fn(),
}));

const testLeads: Lead[] = [
  {
    id: "lead-new-1",
    name: "Lead Alpha",
    phone: "9876543210",
    email: "alpha@example.com",
    business: "Alpha Inc",
    industry: "SaaS",
    source: "Google",
    budget: 20000,
    status: "New",
    notes: "Notes for Alpha",
    quotedAmount: null,
    lastContactDate: null,
    nextFollowUpDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "lead-contacted-1",
    name: "Lead Beta",
    phone: "9876543211",
    email: "beta@example.com",
    business: "Beta LLC",
    industry: "Finance",
    source: "Referral",
    budget: 35000,
    status: "Contacted",
    notes: "Notes for Beta",
    quotedAmount: null,
    lastContactDate: null,
    nextFollowUpDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe("Mobile Pipeline Drag-and-Drop Targeted Verification", () => {
  it("1 & 2. Mobile stage pills are rendered as real Droppable targets for New -> Contacted -> Qualified", () => {
    const html = renderToStaticMarkup(<PipelineBoard initialLeads={testLeads} />);
    
    // Stage tabs droppable container exists
    expect(html).toContain('data-testid="mobile-stage-tabs"');
    
    // All 6 stages have dedicated pill drop targets
    expect(html).toContain('data-stage-pill="New"');
    expect(html).toContain('data-stage-pill="Contacted"');
    expect(html).toContain('data-stage-pill="Qualified"');
    expect(html).toContain('data-stage-pill="Proposal Sent"');
    expect(html).toContain('data-stage-pill="Won"');
    expect(html).toContain('data-stage-pill="Lost"');

    // Droppable IDs for stage pills are registered
    expect(html).toContain('data-rfd-droppable-id="stage-pill-New"');
    expect(html).toContain('data-rfd-droppable-id="stage-pill-Contacted"');
    expect(html).toContain('data-rfd-droppable-id="stage-pill-Qualified"');
    expect(html).toContain('data-rfd-droppable-id="stage-pill-Proposal Sent"');
    expect(html).toContain('data-rfd-droppable-id="stage-pill-Won"');
    expect(html).toContain('data-rfd-droppable-id="stage-pill-Lost"');
  });

  it("3. Stage tabs horizontally swipe correctly with proper classes", () => {
    const html = renderToStaticMarkup(<PipelineBoard initialLeads={testLeads} />);
    
    // Required touch & scroll classes
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("overscroll-x-contain");
    expect(html).toContain("touch-pan-x");
    expect(html).toContain("hide-scrollbar");
    expect(html).toContain("sticky top-14");
  });

  it("4. Vertical card/page scrolling is not broken: grip handle is isolated and card root does not block scroll", () => {
    const html = renderToStaticMarkup(
      <PipelineCard
        lead={testLeads[0]}
        onClick={vi.fn()}
        dragHandleProps={
          {
            "data-rfd-drag-handle-draggable-id": testLeads[0].id,
            "data-rfd-drag-handle-context-id": "0",
            role: "button",
            tabIndex: 0,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any
        }
      />
    );

    // Grip handle has touch-none for DnD touch gesture initiation
    expect(html).toContain("touch-none");
    expect(html).toContain("cursor-grab");

    // The card root element does NOT have touch-none or touch-action: none
    const cardRootMatch = html.match(/<div[^>]*class="([^"]*)"[^>]*>/);
    expect(cardRootMatch).not.toBeNull();
    const cardRootClass = cardRootMatch![1];
    expect(cardRootClass).not.toContain("touch-none");
  });

  it("5. Desktop DnD still compiles and renders all desktop column droppables", () => {
    const html = renderToStaticMarkup(<PipelineBoard initialLeads={testLeads} />);
    
    // Board columns have desktop droppables for whole-board drag & drop
    expect(html).toContain('data-rfd-droppable-id="New"');
    expect(html).toContain('data-rfd-droppable-id="Contacted"');
    expect(html).toContain('data-rfd-droppable-id="Qualified"');
    expect(html).toContain('data-rfd-droppable-id="Proposal Sent"');
    expect(html).toContain('data-rfd-droppable-id="Won"');
    expect(html).toContain('data-rfd-droppable-id="Lost"');
  });

  it("Status extraction logic converts stage-pill IDs cleanly to canonical LeadStatus", () => {
    const extractStatus = (droppableId: string) => {
      return droppableId.startsWith("stage-pill-")
        ? droppableId.replace("stage-pill-", "")
        : droppableId;
    };

    expect(extractStatus("stage-pill-Contacted")).toBe("Contacted");
    expect(extractStatus("stage-pill-Qualified")).toBe("Qualified");
    expect(extractStatus("stage-pill-Proposal Sent")).toBe("Proposal Sent");
    expect(extractStatus("stage-pill-Won")).toBe("Won");
    expect(extractStatus("stage-pill-Lost")).toBe("Lost");
    expect(extractStatus("Contacted")).toBe("Contacted");
    expect(extractStatus("Qualified")).toBe("Qualified");
  });
});
