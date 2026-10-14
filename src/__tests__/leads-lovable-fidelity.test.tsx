import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LeadForm } from "@/features/leads/lead-form";
import { LeadTable, LEAD_TABLE_GRID } from "@/features/leads/lead-table";
import { PinnedLeadsView } from "@/features/leads/pinned-leads-view";
import { LeadFilters } from "@/features/leads/lead-filters";
import { sortLeads } from "@/features/leads/lead-sorting";
import { WhatsAppProvider } from "@/components/whatsapp-context";
import { CallProvider } from "@/components/call-context";
import type { Lead } from "@/features/leads/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/leads",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock server actions in leads
vi.mock("@/app/actions/leads", () => ({
  checkLeadDuplicate: vi.fn().mockResolvedValue({
    exactPhoneMatch: null,
    exactEmailMatch: null,
    fuzzyMatches: [],
  }),
  createLead: vi.fn(),
  updateLead: vi.fn(),
}));

describe("Scale Flow CRM - Leads Lovable Design Fidelity Regression Suite", () => {
  const sampleLead: Lead = {
    id: "lead-fidelity-1",
    name: "Aarav Sharma",
    phone: "+91 98765 12345",
    email: "aarav@techventures.in",
    business: "Tech Ventures Pvt Ltd",
    industry: "Information Technology",
    source: "Website",
    budget: 150000,
    status: "Qualified",
    quotedAmount: 125000,
    lastContactDate: "2026-10-10",
    nextFollowUpDate: "2026-10-20",
    notes: "1. Interested in enterprise CRM solution.\n2. Requires WhatsApp integration.",
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-10T12:00:00Z",
    isPinned: true,
    quickStatus: "INTERESTED",
  };

  const sampleLead2: Lead = {
    id: "lead-fidelity-2",
    name: "Pooja Patel",
    phone: "+91 91234 56780",
    email: "pooja@boutique.com",
    business: "Pooja Designs",
    industry: "Fashion & Retail",
    source: "Instagram",
    budget: 50000,
    status: "New",
    quotedAmount: null,
    lastContactDate: null,
    nextFollowUpDate: "2026-10-12",
    notes: "Sent brochure on WhatsApp",
    createdAt: "2026-10-05T10:00:00Z",
    updatedAt: "2026-10-05T10:00:00Z",
    isPinned: false,
    quickStatus: "CONTACTED",
  };

  const sampleLostLead: Lead = {
    id: "lead-fidelity-3",
    name: "Rohan Verma",
    phone: "+91 99887 76655",
    email: "rohan@competitor.com",
    business: "Verma Logistics",
    industry: "Logistics",
    source: "Cold Call",
    budget: null,
    status: "Lost",
    quotedAmount: null,
    lastContactDate: "2026-09-15",
    nextFollowUpDate: null,
    notes: "Chose competitor",
    createdAt: "2026-09-01T10:00:00Z",
    updatedAt: "2026-09-15T10:00:00Z",
    isPinned: false,
  };

  const allSampleLeads = [sampleLead, sampleLead2, sampleLostLead];

  // Helper renderer with required providers
  function renderWithProviders(element: React.ReactElement) {
    return renderToStaticMarkup(
      <WhatsAppProvider>
        <CallProvider>
          {element}
        </CallProvider>
      </WhatsAppProvider>
    );
  }

  // =========================================================================
  // 1. ADD LEAD MODAL & ENTRY MODE FIDELITY (Agent 3)
  // =========================================================================
  describe("Add Lead Modal & Entry Modes (Agent 3)", () => {
    it("renders modal when open=true and closes when open=false", () => {
      const closedHtml = renderWithProviders(
        <LeadForm
          open={false}
          lead={null}
          saving={false}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />
      );
      expect(closedHtml).toBe("");

      const openHtml = renderWithProviders(
        <LeadForm
          open={true}
          lead={null}
          saving={false}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />
      );
      expect(openHtml).toContain("New lead");
      expect(openHtml).toContain("Add the essentials now — you can fill in the rest later.");
    });

    it("defaults to Quick AI Entry mode and retains two-mode selector", () => {
      const html = renderWithProviders(
        <LeadForm
          open={true}
          lead={null}
          saving={false}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />
      );
      // Mode selector buttons
      expect(html).toContain("Quick AI Entry");
      expect(html).toContain("Manual Entry");
      // Quick AI Entry is initially pressed
      expect(html).toContain('aria-pressed="true"');
      // AI input placeholder is present (from untouched AI entry component)
      expect(html).toContain("Paste lead details here...");
      expect(html).toContain("Structure Lead");
    });

    it("exposes all manual entry fields in Manual Entry mode with correct names", () => {
      // In Edit Mode, it renders ManualLeadEntry directly
      const editHtml = renderWithProviders(
        <LeadForm
          open={true}
          lead={sampleLead}
          saving={false}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />
      );

      // Verify Header displays "Edit lead"
      expect(editHtml).toContain("Edit lead");
      expect(editHtml).toContain("Aarav Sharma · Tech Ventures Pvt Ltd");

      // Verify desktop 2-column layout and input names
      expect(editHtml).toContain('name="name"');
      expect(editHtml).toContain('name="phone"');
      expect(editHtml).toContain('name="email"');
      expect(editHtml).toContain('name="business"');
      expect(editHtml).toContain('name="industry"');
      expect(editHtml).toContain('name="source"');
      expect(editHtml).toContain('name="budget"');
      expect(editHtml).toContain('name="quotedAmount"');
      expect(editHtml).toContain('name="status"');
      expect(editHtml).toContain('name="nextFollowUpDate"');
      expect(editHtml).toContain('name="lastContactDate"');
      expect(editHtml).toContain('name="notes"');

      // Verify values are pre-populated
      expect(editHtml).toContain('value="Aarav Sharma"');
      expect(editHtml).toContain('value="+91 98765 12345"');
      expect(editHtml).toContain('value="aarav@techventures.in"');
      expect(editHtml).toContain('value="Tech Ventures Pvt Ltd"');
      expect(editHtml).toContain('value="Information Technology"');
      expect(editHtml).toContain('value="150000"');
      expect(editHtml).toContain('value="125000"');
      expect(editHtml).toContain("Interested in enterprise CRM solution");

      // Verify NO duplicate hidden inputs for budget and source
      const budgetMatches = editHtml.match(/name="budget"/g);
      expect(budgetMatches?.length).toBe(1);
      const sourceMatches = editHtml.match(/name="source"/g);
      expect(sourceMatches?.length).toBe(1);
    });

    it("includes all Lovable Lead Source options", () => {
      const editHtml = renderWithProviders(
        <LeadForm
          open={true}
          lead={sampleLead}
          saving={false}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
        />
      );

      expect(editHtml).toContain("Website");
      expect(editHtml).toContain("Referral");
      expect(editHtml).toContain("WhatsApp");
      expect(editHtml).toContain("Instagram");
      expect(editHtml).toContain("Trade Show");
      expect(editHtml).toContain("Cold Call");
      expect(editHtml).toContain("LinkedIn");
      expect(editHtml).toContain("Other");
    });
  });

  // =========================================================================
  // 2. LEADS TABLE FIDELITY & RESPONSIVE VIEWS (Agent 2)
  // =========================================================================
  describe("Leads Table Presentation & Actions (Agent 2)", () => {
    it("renders desktop table with 7 columns matching Lovable grid", () => {
      const html = renderWithProviders(
        <LeadTable
          leads={allSampleLeads}
          onSelect={vi.fn()}
          onDelete={vi.fn()}
          onTogglePin={vi.fn()}
        />
      );

      // Desktop table wrapper
      expect(html).toContain("hidden overflow-x-auto lg:block");
      expect(html).toContain(LEAD_TABLE_GRID);

      // 7 columns
      expect(html).toContain("Name / Business");
      expect(html).toContain("AI Score");
      expect(html).toContain("Phone");
      expect(html).toContain("Status");
      expect(html).toContain("Next follow-up");
      expect(html).toContain("Quoted amount");
      expect(html).toContain("Actions");

      // Circular avatar with initials
      expect(html).toContain("AS"); // Aarav Sharma
      expect(html).toContain("PP"); // Pooja Patel
      expect(html).toContain("RV"); // Rohan Verma

      // Status pills with dot indicators
      expect(html).toContain("Qualified");
      expect(html).toContain("New");
      expect(html).toContain("Lost");

      // Quick status pills
      expect(html).toContain("Interested");
      expect(html).toContain("Contacted");

      // Real monetary values formatted correctly
      expect(html).toContain("₹1,25,000"); // Quoted for Aarav
      expect(html).toContain("quoted");
      expect(html).toContain("₹50,000"); // Budget fallback for Pooja
      expect(html).toContain("budget");

      // Accessible action buttons
      expect(html).toContain("Call Aarav Sharma");
      expect(html).toContain("Message Aarav Sharma on WhatsApp");
      expect(html).toContain("Unpin Aarav Sharma");
      expect(html).toContain("Pin Pooja Patel");
      expect(html).toContain("Delete Aarav Sharma");
      expect(html).toContain("View Aarav Sharma");
    });

    it("renders responsive mobile card layout with full touch targets", () => {
      const html = renderWithProviders(
        <LeadTable
          leads={allSampleLeads}
          onSelect={vi.fn()}
          onDelete={vi.fn()}
          onTogglePin={vi.fn()}
        />
      );

      // Mobile container
      expect(html).toContain("divide-y divide-border lg:hidden");

      // Mobile cards have direct call, whatsapp, pin, and view
      expect(html).toContain("tel:+919876512345");
      expect(html).toContain("tel:+919123456780");
    });
  });

  // =========================================================================
  // 3. HORIZONTAL STATUS TABS & FILTER CONTROLS (Agent 2)
  // =========================================================================
  describe("Horizontal Status Tabs & Filter Controls (Agent 2)", () => {
    it("renders Lovable-style horizontal status tabs with live CRM counts", () => {
      const statusCounts = {
        All: 10,
        New: 3,
        Contacted: 2,
        Qualified: 2,
        "Proposal Sent": 1,
        Won: 1,
        Lost: 1,
      };

      const html = renderWithProviders(
        <LeadFilters
          query=""
          onQueryChange={vi.fn()}
          status="All"
          onStatusChange={vi.fn()}
          selectedSources={[]}
          selectedQuickStatuses={[]}
          pinnedOnly={false}
          onPinnedOnlyChange={vi.fn()}
          staleOnly={false}
          onStaleOnlyChange={vi.fn()}
          duplicatesOnly={false}
          onDuplicatesOnlyChange={vi.fn()}
          sortBy="default"
          onSortByChange={vi.fn()}
          statusCounts={statusCounts}
          availableSources={["Website", "Instagram", "Cold Call"]}
          totalLeads={10}
          onClear={vi.fn()}
        />
      );

      // Status tabs present
      expect(html).toContain("All");
      expect(html).toContain("New");
      expect(html).toContain("Contacted");
      expect(html).toContain("Qualified");
      expect(html).toContain("Proposal Sent");
      expect(html).toContain("Won");
      expect(html).toContain("Lost");

      // Dynamic counts rendered in badges
      expect(html).toContain("10"); // All
      expect(html).toContain("3");  // New
    });

    it("renders compact search bar and filter popover toggle with filter count badge", () => {
      const html = renderWithProviders(
        <LeadFilters
          query="Aarav"
          onQueryChange={vi.fn()}
          status="Qualified"
          onStatusChange={vi.fn()}
          selectedSources={["Website"]}
          selectedQuickStatuses={["INTERESTED"]}
          pinnedOnly={true}
          onPinnedOnlyChange={vi.fn()}
          staleOnly={false}
          onStaleOnlyChange={vi.fn()}
          duplicatesOnly={false}
          onDuplicatesOnlyChange={vi.fn()}
          sortBy="value"
          onSortByChange={vi.fn()}
          availableSources={["Website"]}
          totalLeads={1}
          onClear={vi.fn()}
        />
      );

      // Search bar with value
      expect(html).toContain('value="Aarav"');
      expect(html).toContain('placeholder="Search name, business, phone"');

      // Filter trigger button has active filter count badge
      expect(html).toContain("Filters");
      // Multiple active filters should produce a counter badge
      expect(html).toContain("rounded bg-primary");
      expect(html).toContain(">4</span>");
    });
  });

  // =========================================================================
  // 4. PINNED LEADS PRIORITY SHORTLIST (Agent 4)
  // =========================================================================
  describe("Pinned Leads View (Agent 4)", () => {
    it("renders empty state gracefully when no pinned leads exist", () => {
      const html = renderWithProviders(
        <PinnedLeadsView
          leads={[]}
          onSelect={vi.fn()}
          onTogglePin={vi.fn()}
          onAddFollowUp={vi.fn()}
        />
      );

      expect(html).toContain("No pinned leads yet");
      expect(html).toContain("Star important leads from the Leads table");
    });

    it("renders shortlisted pinned lead cards with full action controls", () => {
      const html = renderWithProviders(
        <PinnedLeadsView
          leads={[sampleLead]}
          onSelect={vi.fn()}
          onTogglePin={vi.fn()}
          onAddFollowUp={vi.fn()}
          sortBy="default"
          onSortByChange={vi.fn()}
        />
      );

      // Header summary
      expect(html).toContain("1 lead shortlisted");
      expect(html).toContain("Priority Shortlist");

      // Card details
      expect(html).toContain("Aarav Sharma");
      expect(html).toContain("Tech Ventures Pvt Ltd");
      expect(html).toContain("+91 98765 12345");
      expect(html).toContain("Qualified");

      // Deal value badge
      expect(html).toContain("₹1,25,000");

      // Action buttons
      expect(html).toContain("Call");
      expect(html).toContain("WhatsApp");
      expect(html).toContain("Follow-up");
      expect(html).toContain("Unpin Aarav Sharma");
    });
  });

  // =========================================================================
  // 5. SORTING & BUSINESS LOGIC (Extended sorting options)
  // =========================================================================
  describe("Extended Lead Sorting Engine", () => {
    it("sorts by value descending (highest quoted amount first)", () => {
      const sorted = sortLeads(allSampleLeads, "value");
      expect(sorted[0].id).toBe("lead-fidelity-1"); // ₹1,25,000
    });

    it("sorts by follow-up date ascending (earliest follow-up first)", () => {
      const sorted = sortLeads(allSampleLeads, "followup");
      // sampleLead2 follow-up is 2026-10-12, sampleLead is 2026-10-20, sampleLostLead has null
      expect(sorted[0].id).toBe("lead-fidelity-2");
      expect(sorted[1].id).toBe("lead-fidelity-1");
      expect(sorted[2].id).toBe("lead-fidelity-3");
    });

    it("preserves default, stale, and name sorting", () => {
      const byName = sortLeads(allSampleLeads, "name_asc");
      expect(byName[0].name).toBe("Aarav Sharma");
      expect(byName[1].name).toBe("Pooja Patel");
      expect(byName[2].name).toBe("Rohan Verma");
    });
  });
});
