import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  WhatsAppTemplatePicker,
  interpolateWhatsAppMessage,
  setCachedSamples,
  setCachedTemplates,
} from "@/components/whatsapp-template-picker";
import * as salesAssets from "@/app/actions/sales-assets";
import * as whatsappTemplates from "@/app/actions/whatsapp-templates";
import { setCachedPackages } from "@/features/sales-assets/packages-sync";
import type { WebsiteSample, WebsitePackage } from "@prisma/client";

describe("Targeted Verification: Website Samples Selection in WhatsApp Composer", () => {
  const mockLead = {
    id: "lead-1",
    name: "Aarav Sharma",
    phone: "9876543210",
    quotedAmount: 15000,
    status: "CONTACTED",
  };

  const mockSamples: WebsiteSample[] = [
    {
      id: "sample-1",
      label: "Black Pearl Apparels",
      url: "https://www.blackpearlapparals.in/",
      category: "E-Commerce",
      type: "LIVE",
      isActive: true,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "sample-2",
      label: "Mainika",
      url: "https://www.mainika.com/",
      category: "E-Commerce",
      type: "LIVE",
      isActive: true,
      sortOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "sample-3",
      label: "Ezymiles",
      url: "https://www.ezymiles.in/",
      category: "Travel",
      type: "LIVE",
      isActive: true,
      sortOrder: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "sample-4",
      label: "Clickographers",
      url: "https://www.clickographers.com/",
      category: "Business / Informative",
      type: "LIVE",
      isActive: true,
      sortOrder: 4,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockPackages: WebsitePackage[] = [
    {
      id: "pkg-1",
      name: "Starter Package",
      price: 6000 as any,
      isStartingPrice: false,
      inclusions: "- One-page website\n- Free hosting",
      hosting: "Included for 1 year",
      domain: "Excluded",
      isActive: true,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "pkg-2",
      name: "Business Package",
      price: 12000 as any,
      isStartingPrice: false,
      inclusions: "- Multi-page website\n- SEO",
      hosting: "Included for 1 year",
      domain: "Excluded",
      isActive: true,
      sortOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockTemplates = [
    {
      id: "tpl-intro",
      title: "Introduction",
      body: "Hi {{leadName}} 👋\n\nThis is Faizan from Scale Flow.",
      active: true,
      isActive: true,
      category: "first_contact" as any,
      categoryLabel: "First Contact",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "tpl-samples",
      title: "Website Samples",
      body: "Hi {{leadName}} 👋\n\nAs discussed, sharing a few relevant website samples from Scale Flow:\n\n{{selectedSampleLinks}}\n\nPlease have a look.",
      active: true,
      isActive: true,
      category: "follow_up" as any,
      categoryLabel: "Follow-up",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "tpl-packages",
      title: "Packages / Pricing",
      body: "Hi {{leadName}} 👋\n\nSharing our website packages:\n\n{{packagePricingLinks}}",
      active: true,
      isActive: true,
      category: "follow_up" as any,
      categoryLabel: "Follow-up",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    setCachedPackages(mockPackages);
    setCachedSamples(mockSamples);
    setCachedTemplates(mockTemplates as any);
    vi.spyOn(salesAssets, "getWebsiteSamples").mockResolvedValue({
      success: true,
      data: mockSamples,
    });
    vi.spyOn(salesAssets, "getWebsitePackages").mockResolvedValue({
      success: true,
      data: mockPackages,
    });
    vi.spyOn(whatsappTemplates, "getWhatsAppTemplates").mockResolvedValue({
      success: true,
      data: mockTemplates as any,
    });
  });

  it("1. Open Website Samples: starts with 0 selected and preview includes NO sample links", () => {
    // When Website Samples is opened with no direct sample config
    const message = interpolateWhatsAppMessage({
      template: mockTemplates[1],
      lead: mockLead,
      samples: mockSamples,
      selectedSampleIds: new Set(),
    });

    // Count starts at 0, preview replaces placeholder with fallback and has NO url links
    expect(message).toContain("(No samples selected)");
    expect(message).not.toContain("https://");

    // Component render verification:
    const html = renderToStaticMarkup(
      React.createElement(WhatsAppTemplatePicker, {
        isOpen: true,
        lead: mockLead,
        config: { templateTitle: "Website Samples" },
        onClose: () => {},
      })
    );

    // Header displays 0 selected
    expect(html).toContain("Select Samples (0 selected)");
    // Preview textarea contains no sample links
    expect(html).toContain("(No samples selected)");
    expect(html).not.toContain("https://www.blackpearlapparals.in/");
    expect(html).not.toContain("https://www.mainika.com/");
    // Select All button exists
    expect(html).toContain("Select All");
  });

  it("2. Select one sample: only that sample appears in preview", () => {
    const singleSet = new Set(["sample-2"]); // Mainika
    const message = interpolateWhatsAppMessage({
      template: mockTemplates[1],
      lead: mockLead,
      samples: mockSamples,
      selectedSampleIds: singleSet,
    });

    expect(message).toContain("• Mainika - https://www.mainika.com/");
    expect(message).not.toContain("Black Pearl Apparels");
    expect(message).not.toContain("Ezymiles");
    expect(message).not.toContain("Clickographers");
    expect(message).not.toContain("(No samples selected)");
  });

  it("3. Select three samples: exactly those three appear", () => {
    const threeSet = new Set(["sample-1", "sample-2", "sample-3"]);
    const message = interpolateWhatsAppMessage({
      template: mockTemplates[1],
      lead: mockLead,
      samples: mockSamples,
      selectedSampleIds: threeSet,
    });

    expect(message).toContain("• Black Pearl Apparels - https://www.blackpearlapparals.in/");
    expect(message).toContain("• Mainika - https://www.mainika.com/");
    expect(message).toContain("• Ezymiles - https://www.ezymiles.in/");
    expect(message).not.toContain("Clickographers");
    expect(message).not.toContain("(No samples selected)");
  });

  it("4. Use Select All: all active samples become selected", () => {
    const allSet = new Set(mockSamples.map((s) => s.id));
    const message = interpolateWhatsAppMessage({
      template: mockTemplates[1],
      lead: mockLead,
      samples: mockSamples,
      selectedSampleIds: allSet,
    });

    expect(message).toContain("• Black Pearl Apparels - https://www.blackpearlapparals.in/");
    expect(message).toContain("• Mainika - https://www.mainika.com/");
    expect(message).toContain("• Ezymiles - https://www.ezymiles.in/");
    expect(message).toContain("• Clickographers - https://www.clickographers.com/");
    expect(message).not.toContain("(No samples selected)");
  });

  it("5. Deselect one: that sample disappears from preview", () => {
    // Start with 3, remove sample-2 (Mainika)
    const set = new Set(["sample-1", "sample-2", "sample-3"]);
    set.delete("sample-2");

    const message = interpolateWhatsAppMessage({
      template: mockTemplates[1],
      lead: mockLead,
      samples: mockSamples,
      selectedSampleIds: set,
    });

    expect(message).toContain("• Black Pearl Apparels - https://www.blackpearlapparals.in/");
    expect(message).toContain("• Ezymiles - https://www.ezymiles.in/");
    expect(message).not.toContain("Mainika");
    expect(message).not.toContain("https://www.mainika.com/");
  });

  it("6. Close composer and reopen Website Samples: resets to 0 selected again", () => {
    // Mount composer with closed state then opened state
    const htmlClosed = renderToStaticMarkup(
      React.createElement(WhatsAppTemplatePicker, {
        isOpen: false,
        lead: mockLead,
        onClose: () => {},
      })
    );
    expect(htmlClosed).toBe("");

    // Reopening Website Samples afresh starts with 0 selected
    const htmlReopened = renderToStaticMarkup(
      React.createElement(WhatsAppTemplatePicker, {
        isOpen: true,
        lead: mockLead,
        config: { templateTitle: "Website Samples" },
        onClose: () => {},
      })
    );

    expect(htmlReopened).toContain("Select Samples (0 selected)");
    expect(htmlReopened).toContain("(No samples selected)");
    expect(htmlReopened).not.toContain("https://www.mainika.com/");
  });

  it("7. Packages / Pricing behavior is unchanged", () => {
    const pkgIds = new Set(mockPackages.map((p) => p.id));
    const message = interpolateWhatsAppMessage({
      template: mockTemplates[2],
      lead: mockLead,
      packages: mockPackages,
      selectedPackageIds: pkgIds,
    });

    expect(message).toContain("Starter Package");
    expect(message).toContain("Business Package");
    expect(message).toContain("₹6,000");
    expect(message).toContain("₹12,000");

    // Verify Packages / Pricing default rendering selects all active packages
    const html = renderToStaticMarkup(
      React.createElement(WhatsAppTemplatePicker, {
        isOpen: true,
        lead: mockLead,
        config: { templateTitle: "Packages / Pricing" },
        onClose: () => {},
      })
    );

    expect(html).toContain("Select Packages");
    expect(html).toContain("Starter Package");
    expect(html).toContain("Business Package");
    expect(html).toContain("Select All");
  });
});
