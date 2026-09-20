import { describe, it, expect, vi } from "vitest";
import {
  compareLeadNames,
  sortLeads,
  parseSortParam,
  sortOptionToQueryParam,
} from "@/features/leads/lead-sorting";
import type { Lead, LeadSortOption } from "@/features/leads/types";

// Mock DB disconnect to prevent any network hang during teardown
vi.mock("@/lib/db", () => ({
  db: {
    $disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));

function createMockLead(overrides: Partial<Lead>): Lead {
  return {
    id: overrides.id || "lead-" + Math.random().toString(36).slice(2, 9),
    name: overrides.name || "Test Lead",
    phone: overrides.phone || "9876543210",
    email: overrides.email || "test@example.com",
    business: overrides.business || "Acme Corp",
    industry: overrides.industry || "Tech",
    source: overrides.source || "Web",
    budget: overrides.budget ?? 10000,
    status: overrides.status || "New",
    quotedAmount: overrides.quotedAmount ?? null,
    lastContactDate: overrides.lastContactDate || null,
    nextFollowUpDate: overrides.nextFollowUpDate || null,
    notes: overrides.notes || "",
    createdAt: overrides.createdAt || new Date("2026-09-01T00:00:00Z").toISOString(),
    updatedAt: overrides.updatedAt || new Date("2026-09-01T00:00:00Z").toISOString(),
    isPinned: overrides.isPinned ?? false,
    staleInfo: overrides.staleInfo,
    ...overrides,
  };
}

describe("Lead Name Sorting in Leads Workspace", () => {
  const baseLeads: Lead[] = [
    createMockLead({ id: "1", name: "Zoya", status: "New" }),
    createMockLead({ id: "2", name: "Akhil", status: "New", isPinned: true }),
    createMockLead({ id: "3", name: "Rahul", status: "Contacted" }),
    createMockLead({ id: "4", name: "Faizan", status: "New" }),
  ];

  // 1. A-Z PASS/FAIL
  describe("1. A-Z Sorting", () => {
    it("sorts leads alphabetically A -> Z: Akhil, Faizan, Rahul, Zoya", () => {
      const sorted = sortLeads(baseLeads, "name_asc");
      const names = sorted.map((l) => l.name);
      expect(names).toEqual(["Akhil", "Faizan", "Rahul", "Zoya"]);
    });

    it("ignores uppercase/lowercase differences and leading/trailing spaces", () => {
      const messyLeads: Lead[] = [
        createMockLead({ id: "1", name: "  zoya  " }),
        createMockLead({ id: "2", name: "AKHIL" }),
        createMockLead({ id: "3", name: "  rahul" }),
        createMockLead({ id: "4", name: "Faizan  " }),
        createMockLead({ id: "5", name: "aamir" }),
      ];
      const sorted = sortLeads(messyLeads, "name_asc");
      const names = sorted.map((l) => l.name.trim());
      expect(names).toEqual(["aamir", "AKHIL", "Faizan", "rahul", "zoya"]);
    });

    it("performs stable locale-aware comparison", () => {
      expect(compareLeadNames("Aamir", "Akhil")).toBeLessThan(0);
      expect(compareLeadNames("Akhil", "Faizan")).toBeLessThan(0);
      expect(compareLeadNames("Faizan", "Rahul")).toBeLessThan(0);
      expect(compareLeadNames("Rahul", "Zoya")).toBeLessThan(0);
      expect(compareLeadNames("  faizan  ", "FAIZAN")).toBe(0);
    });
  });

  // 2. Z-A PASS/FAIL
  describe("2. Z-A Sorting", () => {
    it("sorts leads alphabetically Z -> A: Zoya, Rahul, Faizan, Akhil", () => {
      const sorted = sortLeads(baseLeads, "name_desc");
      const names = sorted.map((l) => l.name);
      expect(names).toEqual(["Zoya", "Rahul", "Faizan", "Akhil"]);
    });

    it("handles reverse alphabetical order with case and whitespace variations", () => {
      const messyLeads: Lead[] = [
        createMockLead({ id: "1", name: "zoya" }),
        createMockLead({ id: "2", name: "Akhil" }),
        createMockLead({ id: "3", name: "  RAHUL  " }),
        createMockLead({ id: "4", name: "faizan" }),
        createMockLead({ id: "5", name: "Aamir" }),
      ];
      const sorted = sortLeads(messyLeads, "name_desc");
      const names = sorted.map((l) => l.name.trim());
      expect(names).toEqual(["zoya", "RAHUL", "faizan", "Akhil", "Aamir"]);
    });
  });

  // 3. SEARCH + SORT PASS/FAIL
  describe("3. Search + Sort Compatibility", () => {
    it("sorts search-filtered results alphabetically", () => {
      const dataset: Lead[] = [
        createMockLead({ id: "1", name: "Zoya", business: "Acme Tech" }),
        createMockLead({ id: "2", name: "Akhil", business: "Beta Corp" }),
        createMockLead({ id: "3", name: "Rahul", business: "Acme Logistics" }),
        createMockLead({ id: "4", name: "Faizan", business: "Acme Consulting" }),
      ];

      // Simulate search needle "Acme"
      const needle = "acme";
      const filtered = dataset.filter((l) =>
        [l.name, l.business, l.phone, l.email].join(" ").toLowerCase().includes(needle)
      );
      // Results contain Zoya, Rahul, Faizan
      const sortedAsc = sortLeads(filtered, "name_asc");
      expect(sortedAsc.map((l) => l.name)).toEqual(["Faizan", "Rahul", "Zoya"]);

      const sortedDesc = sortLeads(filtered, "name_desc");
      expect(sortedDesc.map((l) => l.name)).toEqual(["Zoya", "Rahul", "Faizan"]);
    });
  });

  // 4. STATUS FILTER + SORT PASS/FAIL
  describe("4. Status Filter + Sort Compatibility", () => {
    it("filters Status = New then sorts only NEW leads A -> Z and Z -> A", () => {
      // baseLeads: Zoya (New), Akhil (New), Rahul (Contacted), Faizan (New)
      const newLeadsOnly = baseLeads.filter((l) => l.status === "New");

      const sortedAZ = sortLeads(newLeadsOnly, "name_asc");
      expect(sortedAZ.map((l) => l.name)).toEqual(["Akhil", "Faizan", "Zoya"]);

      const sortedZA = sortLeads(newLeadsOnly, "name_desc");
      expect(sortedZA.map((l) => l.name)).toEqual(["Zoya", "Faizan", "Akhil"]);
    });
  });

  // 5. STALE + SORT PASS/FAIL
  describe("5. Stale Filter + Sort Compatibility", () => {
    it("sorts stale leads alphabetically A -> Z when Stale filter is active", () => {
      const mockActivity = { timestamp: new Date(), type: "NOTE", description: "Note" };
      const staleDataset: Lead[] = [
        createMockLead({ id: "1", name: "Zoya", staleInfo: { isStale: true, inactivityDays: 5, lastMeaningfulActivity: mockActivity, staleLabel: "Stale", warningMessage: "", inactivityText: "" } }),
        createMockLead({ id: "2", name: "Akhil", staleInfo: { isStale: false, inactivityDays: 1, lastMeaningfulActivity: mockActivity, staleLabel: "", warningMessage: "", inactivityText: "" } }),
        createMockLead({ id: "3", name: "Rahul", staleInfo: { isStale: true, inactivityDays: 8, lastMeaningfulActivity: mockActivity, staleLabel: "Stale", warningMessage: "", inactivityText: "" } }),
        createMockLead({ id: "4", name: "Faizan", staleInfo: { isStale: true, inactivityDays: 3, lastMeaningfulActivity: mockActivity, staleLabel: "Stale", warningMessage: "", inactivityText: "" } }),
      ];

      // Stale filter active
      const staleOnly = staleDataset.filter((l) => Boolean(l.staleInfo?.isStale));
      const sortedAZ = sortLeads(staleOnly, "name_asc");
      expect(sortedAZ.map((l) => l.name)).toEqual(["Faizan", "Rahul", "Zoya"]);
    });

    it("sorts by most_stale when selected", () => {
      const mockActivity = { timestamp: new Date(), type: "NOTE", description: "Note" };
      const staleDataset: Lead[] = [
        createMockLead({ id: "1", name: "Faizan", isPinned: false, staleInfo: { isStale: true, inactivityDays: 3, lastMeaningfulActivity: mockActivity, staleLabel: "", warningMessage: "", inactivityText: "" } }),
        createMockLead({ id: "2", name: "Rahul", isPinned: false, staleInfo: { isStale: true, inactivityDays: 8, lastMeaningfulActivity: mockActivity, staleLabel: "", warningMessage: "", inactivityText: "" } }),
        createMockLead({ id: "3", name: "Zoya", isPinned: false, staleInfo: { isStale: true, inactivityDays: 5, lastMeaningfulActivity: mockActivity, staleLabel: "", warningMessage: "", inactivityText: "" } }),
      ];

      const sortedStale = sortLeads(staleDataset, "most_stale");
      expect(sortedStale.map((l) => l.name)).toEqual(["Rahul", "Zoya", "Faizan"]);
    });
  });

  // 6. PINNED + SORT PASS/FAIL
  describe("6. Pinned Leads + Sort Behavior", () => {
    it("does NOT automatically float pinned leads to top when explicit A-Z / Z-A sort is active", () => {
      // Akhil is pinned, but in Z-A sort, Zoya and Rahul must come before Akhil!
      const sortedZA = sortLeads(baseLeads, "name_desc");
      expect(sortedZA.map((l) => l.name)).toEqual(["Zoya", "Rahul", "Faizan", "Akhil"]);

      // In A-Z sort, Akhil is first because of alphabet, not pinned status
      const sortedAZ = sortLeads(baseLeads, "name_asc");
      expect(sortedAZ.map((l) => l.name)).toEqual(["Akhil", "Faizan", "Rahul", "Zoya"]);
    });

    it("floats pinned leads to top only in default sort mode", () => {
      const defaultSorted = sortLeads(baseLeads, "default");
      expect(defaultSorted[0].name).toBe("Akhil");
      expect(defaultSorted[0].isPinned).toBe(true);
    });

    it("supports sorting within the dedicated Pinned Leads view", () => {
      const pinnedDataset: Lead[] = [
        createMockLead({ id: "1", name: "Zoya", isPinned: true }),
        createMockLead({ id: "2", name: "Akhil", isPinned: true }),
        createMockLead({ id: "3", name: "Rahul", isPinned: true }),
        createMockLead({ id: "4", name: "Faizan", isPinned: true }),
      ];

      const sortedPinnedAZ = sortLeads(pinnedDataset, "name_asc");
      expect(sortedPinnedAZ.map((l) => l.name)).toEqual(["Akhil", "Faizan", "Rahul", "Zoya"]);

      const sortedPinnedZA = sortLeads(pinnedDataset, "name_desc");
      expect(sortedPinnedZA.map((l) => l.name)).toEqual(["Zoya", "Rahul", "Faizan", "Akhil"]);
    });
  });

  // 7. MOBILE PASS/FAIL
  describe("7. Mobile & Filter UI Structure", () => {
    it("validates all supported LeadSortOption types", () => {
      const validSortOptions: LeadSortOption[] = ["default", "name_asc", "name_desc", "most_stale"];
      for (const opt of validSortOptions) {
        expect(() => sortLeads(baseLeads, opt)).not.toThrow();
      }
    });
  });

  // 8. URL/STATE PRESERVED PASS/FAIL
  describe("8. URL Query State Parsing & Serialization", () => {
    it("parses URL query params correctly", () => {
      expect(parseSortParam("name-asc")).toBe("name_asc");
      expect(parseSortParam("name_asc")).toBe("name_asc");
      expect(parseSortParam("NAME-ASC")).toBe("name_asc");
      expect(parseSortParam("name-desc")).toBe("name_desc");
      expect(parseSortParam("name_desc")).toBe("name_desc");
      expect(parseSortParam("stale")).toBe("most_stale");
      expect(parseSortParam("most_stale")).toBe("most_stale");
      expect(parseSortParam("most-stale")).toBe("most_stale");
      expect(parseSortParam("default")).toBe("default");
      expect(parseSortParam(null)).toBe("default");
      expect(parseSortParam("unknown")).toBe("default");
    });

    it("serializes sort options to URL query param values", () => {
      expect(sortOptionToQueryParam("name_asc")).toBe("name-asc");
      expect(sortOptionToQueryParam("name_desc")).toBe("name-desc");
      expect(sortOptionToQueryParam("most_stale")).toBe("stale");
      expect(sortOptionToQueryParam("default")).toBeNull();
    });

    it("preserves other query parameters when updating sort param", () => {
      const existingParams = new URLSearchParams("status=New&filter=stale");
      const nextSort: LeadSortOption = "name_asc";
      const sortParamVal = sortOptionToQueryParam(nextSort);
      if (sortParamVal) {
        existingParams.set("sort", sortParamVal);
      }
      expect(existingParams.toString()).toBe("status=New&filter=stale&sort=name-asc");

      // Switching back to default deletes the sort parameter without affecting other filters
      existingParams.delete("sort");
      expect(existingParams.toString()).toBe("status=New&filter=stale");
    });
  });
});
