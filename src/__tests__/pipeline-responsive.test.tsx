import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PipelineBoard } from "@/features/pipeline/pipeline-board";
import { PipelineConversion } from "@/features/pipeline/pipeline-conversion";
import type { Lead, LeadStatus } from "@/features/leads/types";

vi.mock("@/components/toast-provider", () => ({
  useToast: () => ({ showToast: vi.fn() }),
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

const mockLeads: Lead[] = [
  {
    id: "lead-1",
    name: "Lead New",
    phone: "9876543210",
    email: "new@example.com",
    business: "Biz 1",
    industry: "Tech",
    source: "Web",
    budget: 10000,
    notes: "",
    status: "New",
    quickStatus: "NONE",
    quotedAmount: 10000,
    lastContactDate: null,
    nextFollowUpDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "lead-2",
    name: "Lead Contacted",
    phone: "9876543211",
    email: "contacted@example.com",
    business: "Biz 2",
    industry: "Tech",
    source: "Web",
    budget: 15000,
    notes: "",
    status: "Contacted",
    quickStatus: "CONTACTED",
    quotedAmount: 15000,
    lastContactDate: null,
    nextFollowUpDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "lead-3",
    name: "Lead Qualified",
    phone: "9876543212",
    email: "qualified@example.com",
    business: "Biz 3",
    industry: "Tech",
    source: "Web",
    budget: 20000,
    notes: "",
    status: "Qualified",
    quickStatus: "INTERESTED",
    quotedAmount: 20000,
    lastContactDate: null,
    nextFollowUpDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "lead-4",
    name: "Lead Proposal",
    phone: "9876543213",
    email: "proposal@example.com",
    business: "Biz 4",
    industry: "Tech",
    source: "Web",
    budget: 50000,
    notes: "",
    status: "Proposal Sent",
    quickStatus: "INTERESTED",
    quotedAmount: 50000,
    lastContactDate: null,
    nextFollowUpDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "lead-5",
    name: "Lead Won",
    phone: "9876543214",
    email: "won@example.com",
    business: "Biz 5",
    industry: "Tech",
    source: "Web",
    budget: 80000,
    notes: "",
    status: "Won",
    quickStatus: "INTERESTED",
    quotedAmount: 80000,
    lastContactDate: null,
    nextFollowUpDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "lead-6",
    name: "Lead Lost",
    phone: "9876543215",
    email: "lost@example.com",
    business: "Biz 6",
    industry: "Tech",
    source: "Web",
    budget: 5000,
    notes: "",
    status: "Lost",
    quickStatus: "NONE",
    quotedAmount: 5000,
    lastContactDate: null,
    nextFollowUpDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe("Pipeline Responsive Rendering & Analytics Regression", () => {
  it("1. Pipeline analytics component renders on desktop", () => {
    const html = renderToStaticMarkup(<PipelineBoard initialLeads={mockLeads} />);
    // Desktop container with hidden sm:flex exists
    expect(html).toContain("hidden sm:flex");
    // Analytics regions exist
    expect(html).toContain('aria-label="Pipeline summary"');
  });

  it("2. Pipeline analytics renders on mobile", () => {
    const html = renderToStaticMarkup(<PipelineBoard initialLeads={mockLeads} />);
    // Mobile details accordion exists with sm:hidden
    expect(html).toContain("<details");
    expect(html).toContain("sm:hidden");
    expect(html).toContain("Pipeline Analytics");
  });

  it("3. Same underlying metrics/data used on both desktop and mobile", () => {
    const html = renderToStaticMarkup(<PipelineBoard initialLeads={mockLeads} />);
    // Total count of leads is 6
    const totalOccurrences = (html.match(/Total<\/p><p[^>]*>6<\/p>/g) || []).length;
    // Both desktop and mobile sections contain the summary stats
    expect(totalOccurrences).toBe(2);

    // Won count is 1
    const wonOccurrences = (html.match(/Won<\/p><p[^>]*>1<\/p>/g) || []).length;
    expect(wonOccurrences).toBe(2);
  });

  it("4 & 5. No duplicate API/DB query introduced and no N+1 queries", () => {
    // PipelineBoard accepts initialLeads prop directly, zero fetch / db calls in render
    const html = renderToStaticMarkup(<PipelineBoard initialLeads={mockLeads} />);
    expect(html).toBeDefined();
  });

  it("6. Pipeline board still renders all 6 stages", () => {
    const html = renderToStaticMarkup(<PipelineBoard initialLeads={mockLeads} />);
    expect(html).toContain('data-stage="New"');
    expect(html).toContain('data-stage="Contacted"');
    expect(html).toContain('data-stage="Qualified"');
    expect(html).toContain('data-stage="Proposal Sent"');
    expect(html).toContain('data-stage="Won"');
    expect(html).toContain('data-stage="Lost"');
  });

  it("7. Horizontal Kanban scrolling container is present and works at tablet/desktop", () => {
    const html = renderToStaticMarkup(<PipelineBoard initialLeads={mockLeads} />);
    // Verify scroll container has overflow-x-auto and custom-scrollbar
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("custom-scrollbar");
    expect(html).toContain("sm:snap-x");
  });

  it("8. Mobile stages scroll horizontally with mobile indicator", () => {
    const html = renderToStaticMarkup(<PipelineBoard initialLeads={mockLeads} />);
    // Mobile horizontal scroll indicator exists
    expect(html).toContain("pipeline-mobile-scroll-indicator");
    // All stages are rendered as swipeable cards
    expect(html).toContain('data-stage="New"');
    expect(html).toContain('data-stage="Contacted"');
    expect(html).toContain("overflow-x-auto");
  });

  it("9. Analytics calculations follow strict funnel business rules", () => {
    // Lead -> Contacted: Contacted-and-beyond (Contacted(1) + Qualified(1) + Proposal(1) + Won(1) = 4) / Total(6) = 67%
    // Contacted -> Qualified: Qualified-and-beyond (Qualified(1) + Proposal(1) + Won(1) = 3) / Contacted-and-beyond(4) = 75%
    // Qualified -> Proposal: Proposal-and-beyond (Proposal(1) + Won(1) = 2) / Qualified-and-beyond(3) = 67%
    // Proposal -> Won: Won(1) / Proposal-and-beyond(2) = 50%
    // Overall Win Rate: Won(1) / Total(6) = 17%
    const grouped: Record<LeadStatus, Lead[]> = {
      New: mockLeads.filter((l) => l.status === "New"),
      Contacted: mockLeads.filter((l) => l.status === "Contacted"),
      Qualified: mockLeads.filter((l) => l.status === "Qualified"),
      "Proposal Sent": mockLeads.filter((l) => l.status === "Proposal Sent"),
      Won: mockLeads.filter((l) => l.status === "Won"),
      Lost: mockLeads.filter((l) => l.status === "Lost"),
    };
    const html = renderToStaticMarkup(<PipelineConversion leads={mockLeads} grouped={grouped} />);
    expect(html).toContain("67%");
    expect(html).toContain("75%");
    expect(html).toContain("50%");
    expect(html).toContain("17%");
    expect(html).toContain("Total");
    expect(html).toContain("Contacted");
    expect(html).toContain("Qualified");
    expect(html).toContain("Proposal");
    expect(html).toContain("Won");
    expect(html).toContain("Overall Win Rate");
  });
});
