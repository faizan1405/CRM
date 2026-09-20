import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LeadTable, LEAD_TABLE_GRID } from "@/features/leads/lead-table";
import { WhatsAppProvider } from "@/components/whatsapp-context";
import type { Lead } from "@/features/leads/types";

describe("LeadTable Desktop Alignment Verification", () => {
  const mockLeads: Lead[] = [
    // 1. lead with phone + quoted amount
    {
      id: "lead-1",
      name: "Alice Smith",
      phone: "+91 98765 43210",
      email: "alice@example.com",
      business: "Acme Corp",
      industry: "Tech",
      source: "Website",
      budget: 100000,
      status: "Qualified",
      quotedAmount: 50000,
      lastContactDate: "2026-09-18",
      nextFollowUpDate: "2026-09-25",
      notes: "Interested in enterprise tier",
      createdAt: "2026-09-01",
      updatedAt: "2026-09-18",
      isPinned: true,
    },
    // 2. lead with phone but no quoted amount
    {
      id: "lead-2",
      name: "Bob Jones",
      phone: "+91 91234 56789",
      email: "bob@example.com",
      business: "",
      industry: "Retail",
      source: "Referral",
      budget: null,
      status: "Contacted",
      quotedAmount: null,
      lastContactDate: "2026-09-19",
      nextFollowUpDate: "2026-09-22",
      notes: "Follow up next week",
      createdAt: "2026-09-10",
      updatedAt: "2026-09-19",
      isPinned: false,
    },
    // 3. Lost/New lead with no follow-up
    {
      id: "lead-3",
      name: "Charlie Brown",
      phone: "+91 99999 00000",
      email: "charlie@example.com",
      business: "",
      industry: "Finance",
      source: "Cold Call",
      budget: null,
      status: "Lost",
      quotedAmount: null,
      lastContactDate: null,
      nextFollowUpDate: null,
      notes: "Budget too low",
      createdAt: "2026-09-12",
      updatedAt: "2026-09-15",
      isPinned: false,
    },
  ];

  it("renders with shared grid definition on header and all rows", () => {
    expect(LEAD_TABLE_GRID).toBeDefined();
    expect(LEAD_TABLE_GRID).toContain("grid");
    expect(LEAD_TABLE_GRID).toContain("grid-cols-");

    const html = renderToStaticMarkup(
      <WhatsAppProvider>
        <LeadTable
          leads={mockLeads}
          onSelect={vi.fn()}
          onDelete={vi.fn()}
          onTogglePin={vi.fn()}
        />
      </WhatsAppProvider>
    );

    // Verify container
    expect(html).toContain("hidden overflow-x-auto lg:block");

    // Verify 7 headers
    expect(html).toContain("Name / Business");
    expect(html).toContain("AI Score");
    expect(html).toContain("Phone");
    expect(html).toContain("Status");
    expect(html).toContain("Next follow-up");
    expect(html).toContain("Quoted amount");
    expect(html).toContain("Actions");

    // Check header row column count
    expect(html).toContain('role="columnheader"');
    const headerColMatches = html.match(/role="columnheader"/g);
    expect(headerColMatches?.length).toBe(7);

    // Check each lead row has exactly 7 cells
    const cellMatches = html.match(/role="cell"/g);
    expect(cellMatches?.length).toBe(mockLeads.length * 7);

    // Row 1: Alice Smith (Phone + Quoted Amount + Follow-up)
    // Col 1: Alice Smith & Acme Corp
    expect(html).toContain("Alice Smith");
    expect(html).toContain("Acme Corp");
    // Col 2: AI Score
    // Col 3: Phone
    expect(html).toContain("+91 98765 43210");
    // Col 4: Status badge (Qualified)
    expect(html).toContain("Qualified");
    // Col 5: Next follow-up
    expect(html).toContain("25 Sep 2026");
    // Col 6: Quoted amount
    expect(html).toContain("₹50,000");
    // Col 7: Actions
    expect(html).toContain("Delete Alice Smith");
    expect(html).toContain("Call Alice Smith");
    expect(html).toContain("Message Alice Smith on WhatsApp");
    expect(html).toContain("View Alice Smith");

    // Row 2: Bob Jones (Phone + no Quoted Amount)
    expect(html).toContain("Bob Jones");
    expect(html).toContain("+91 91234 56789");
    expect(html).toContain("Contacted");
    expect(html).toContain("22 Sep 2026");

    // Row 3: Charlie Brown (Lost / New lead + no follow-up + no quoted amount)
    expect(html).toContain("Charlie Brown");
    expect(html).toContain("+91 99999 00000");
    expect(html).toContain("Lost");

    // Star icon inside Name / Business cell
    expect(html).toContain("Unpin Alice Smith");
    expect(html).toContain("Pin Bob Jones");
  });
});

