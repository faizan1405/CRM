import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  PAYMENT_TERMS,
  getPaymentTerms,
  setPaymentTerms,
  resetPaymentTerms,
  formatPaymentTermsSentence,
  formatPaymentTermsText,
  hasPaymentTerms,
  isPaymentTermsRelevant,
} from "@/lib/payment-terms";
import {
  formatSinglePackageForMessage,
  formatPackageListForMessage,
} from "@/features/sales-assets/packages-sync";
import { interpolateWhatsAppMessage } from "@/components/whatsapp-template-picker";
import {
  renderWhatsAppMessage,
  interpolatePlaceholders,
} from "@/features/whatsapp-templates/placeholders";
import type { WebsitePackage } from "@prisma/client";

describe("Canonical Payment Terms: Targeted WhatsApp & Business Messaging Verification", () => {
  const mockLead = {
    id: "lead-abc-123",
    name: "Aarav Sharma",
    phone: "9876543210",
    business: "Apex Logistics",
    requirement: "E-Commerce Website",
    budget: 45000,
    quotedAmount: 45000,
    status: "QUALIFIED",
    followUpDate: "Tomorrow, 21 Sep",
    followUpTime: "11:00 AM",
  };

  const mockPackages: WebsitePackage[] = [
    {
      id: "pkg-starter",
      name: "Starter Package",
      price: 6000 as any,
      isStartingPrice: false,
      inclusions: "- One-page website\n- Free hosting 1 year",
      hosting: "Included for 1 year",
      domain: "Client side",
      isActive: true,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "pkg-business",
      name: "Business Package",
      price: 30000 as any,
      isStartingPrice: false,
      inclusions: "- Multi-page website\n- Premium UI/UX\n- WhatsApp integration",
      hosting: "Included for 1 year",
      domain: "Client side",
      isActive: true,
      sortOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    resetPaymentTerms();
  });

  afterEach(() => {
    resetPaymentTerms();
  });

  describe("1. Package / Pricing Message → Payment terms appear", () => {
    it("includes canonical payment terms in single-package outreach message", () => {
      const singleMsg = formatSinglePackageForMessage(mockPackages[1]);
      expect(singleMsg).toContain("Business Package — ₹30,000");
      expect(singleMsg).toContain("Payment Terms: 30% advance and 70% before final delivery.");
    });

    it("includes canonical payment terms in WhatsAppTemplatePicker direct single package share", () => {
      const message = interpolateWhatsAppMessage({
        template: { title: "Packages / Pricing", message: "Hi {{leadName}}\n\n{{packagePricingLinks}}" },
        lead: mockLead,
        packages: mockPackages,
        selectedPackageIds: new Set(["pkg-business"]),
        config: { packageId: "pkg-business" },
      });

      expect(message).toContain("Business Package — ₹30,000");
      expect(message).toContain("Payment Terms: 30% advance and 70% before final delivery.");
    });

    it("includes canonical payment terms in multi-package pricing list message", () => {
      const template = {
        title: "Packages / Pricing",
        message: "Hi {{leadName}} 👋\n\nSharing our website packages:\n\n{{packagePricingLinks}}\n\nI can recommend the right option based on your requirement.\n\nDomain is from the client side.",
      };

      const message = interpolateWhatsAppMessage({
        template,
        lead: mockLead,
        packages: mockPackages,
        selectedPackageIds: new Set(["pkg-starter", "pkg-business"]),
      });

      expect(message).toContain("Starter Package — ₹6,000");
      expect(message).toContain("Business Package — ₹30,000");
      expect(message).toContain("Payment Terms: 30% advance and 70% before final delivery.");
      expect(message).toContain("I can recommend the right option");
    });
  });

  describe("2. Proposal / Deal-related Message → Payment terms appear", () => {
    it("includes canonical payment terms in Proposal Follow-up template", () => {
      const template = {
        title: "Proposal Follow-up",
        category: "QUOTATION_FOLLOW_UP",
        message: "Hi {{leadName}} 👋\n\nJust following up regarding the website proposal/quotation I shared with you.\n\nPlease let me know if you've reviewed it or if you'd like any changes or clarification.\n\nHappy to discuss it.",
      };

      const message = interpolateWhatsAppMessage({
        template,
        lead: mockLead,
      });

      expect(message).toContain("Hi Aarav Sharma 👋");
      expect(message).toContain("website proposal/quotation");
      expect(message).toContain("Payment Terms: 30% advance and 70% before final delivery.");
    });

    it("includes canonical payment terms in Quotation Delivery message", () => {
      const template = {
        title: "Quotation Delivery",
        category: "QUOTATION_SENT",
        message: "Hi {name}, I have sent over the formal quotation for {requirement}. The estimated budget is {budget}. Please review and let me know if you have any questions!",
      };

      const message = interpolateWhatsAppMessage({
        template,
        lead: mockLead,
      });

      expect(message).toContain("Aarav Sharma");
      expect(message).toContain("₹45,000");
      expect(message).toContain("Payment Terms: 30% advance and 70% before final delivery.");
    });

    it("includes canonical payment terms in Quotation Follow-Up message", () => {
      const template = {
        title: "Quotation Follow-Up",
        category: "QUOTATION_FOLLOW_UP",
        message: "Hi {name}, checking in to see if you had a chance to review the quotation sent for {requirement}. We'd love to assist you with any clarifications.",
      };

      const message = interpolateWhatsAppMessage({
        template,
        lead: mockLead,
      });

      expect(message).toContain("Payment Terms: 30% advance and 70% before final delivery.");
    });

    it("includes canonical payment terms in Deal Confirmation message", () => {
      const template = {
        title: "Deal Confirmation",
        category: "PROPOSAL",
        message: "Hi {name}, thrilled to confirm our partnership for {requirement} at {business}. Quoted amount: {budget}.",
      };

      const message = interpolateWhatsAppMessage({
        template,
        lead: mockLead,
      });

      expect(message).toContain("Payment Terms: 30% advance and 70% before final delivery.");
    });
  });

  describe("3. Website Samples Message → Payment terms DO NOT appear", () => {
    it("excludes payment terms from multi-sample sharing message", () => {
      const mockSamples = [
        {
          id: "s-1",
          label: "E-Commerce Demo",
          url: "https://example.com/demo1",
          category: "E-Commerce",
          type: "LIVE" as any,
          isActive: true,
          sortOrder: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const template = {
        title: "Website Samples",
        category: "FOLLOW_UP",
        message: "Hi {{leadName}} 👋\n\nAs discussed, sharing a few relevant website samples from Scale Flow:\n\n{{selectedSampleLinks}}\n\nPlease have a look.",
      };

      const message = interpolateWhatsAppMessage({
        template,
        lead: mockLead,
        samples: mockSamples,
        selectedSampleIds: new Set(["s-1"]),
      });

      expect(message).toContain("https://example.com/demo1");
      expect(message).not.toContain("Payment Terms");
      expect(message).not.toContain("advance");
      expect(message).not.toContain("final delivery");
    });

    it("excludes payment terms from direct single sample share", () => {
      const mockSamples = [
        {
          id: "s-1",
          label: "E-Commerce Demo",
          url: "https://example.com/demo1",
          category: "E-Commerce",
          type: "LIVE" as any,
          isActive: true,
          sortOrder: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const message = interpolateWhatsAppMessage({
        template: { title: "Website Samples" },
        lead: mockLead,
        samples: mockSamples,
        selectedSampleIds: new Set(["s-1"]),
        config: { sampleId: "s-1" },
      });

      expect(message).toContain("https://example.com/demo1");
      expect(message).not.toContain("Payment Terms");
      expect(message).not.toContain("30% advance");
    });
  });

  describe("4. Introduction & Other Irrelevant Messages → Payment terms DO NOT appear", () => {
    it("excludes payment terms from Introduction message", () => {
      const template = {
        title: "Introduction",
        category: "FIRST_CONTACT",
        message: "Hi {{leadName}} 👋\n\nThis is Faizan from Scale Flow.\n\nWe build modern, fast and conversion-focused websites for businesses.\n\nI wanted to connect regarding your website requirement.\n\nLet me know when you're available and I can share some relevant samples with you.",
      };

      const message = interpolateWhatsAppMessage({
        template,
        lead: mockLead,
      });

      expect(message).toContain("Hi Aarav Sharma 👋");
      expect(message).toContain("Scale Flow");
      expect(message).not.toContain("Payment Terms");
      expect(message).not.toContain("advance");
      expect(message).not.toContain("final delivery");
    });

    it("excludes payment terms from Call-back message", () => {
      const template = {
        title: "Call-back",
        category: "AFTER_CALL",
        message: "Hi {{leadName}} 👋\n\nI tried reaching you regarding your website requirement.\n\nPlease let me know a convenient time to call you back.",
      };

      const message = interpolateWhatsAppMessage({
        template,
        lead: mockLead,
      });

      expect(message).toContain("call you back");
      expect(message).not.toContain("Payment Terms");
      expect(message).not.toContain("advance");
    });

    it("excludes payment terms from generic simple Follow-up message", () => {
      const template = {
        title: "Follow-up",
        category: "FOLLOW_UP",
        message: "Hi {{leadName}} 👋\n\nJust following up regarding the website requirement we discussed.\n\nDid you get a chance to check the details/sample I shared?\n\nLet me know if you have any questions and we can take it forward.",
      };

      const message = interpolateWhatsAppMessage({
        template,
        lead: mockLead,
      });

      expect(message).not.toContain("Payment Terms");
      expect(message).not.toContain("advance");
    });

    it("excludes payment terms from casual custom message", () => {
      const message = interpolateWhatsAppMessage({
        template: { title: "Custom", message: "Hi Aarav, sharing the updated design moodboard." },
        lead: mockLead,
      });

      expect(message).toBe("Hi Aarav, sharing the updated design moodboard.");
      expect(message).not.toContain("Payment Terms");
    });
  });

  describe("5. Change canonical payment terms temporarily → newly generated relevant messages update automatically", () => {
    it("updates package and proposal messages when canonical terms change to 40% advance / 60% handover", () => {
      // Modify canonical terms
      setPaymentTerms({
        advancePercent: 40,
        finalPercent: 60,
        finalTiming: "before project handover",
      });

      expect(getPaymentTerms().advancePercent).toBe(40);
      expect(PAYMENT_TERMS.advancePercent).toBe(40);
      expect(formatPaymentTermsSentence()).toBe(
        "Payment Terms: 40% advance and 60% before project handover."
      );

      // 1. Single package message reflects new terms
      const singlePkgMsg = formatSinglePackageForMessage(mockPackages[1]);
      expect(singlePkgMsg).toContain("Payment Terms: 40% advance and 60% before project handover.");
      expect(singlePkgMsg).not.toContain("30% advance");
      expect(singlePkgMsg).not.toContain("70%");

      // 2. Proposal message reflects new terms
      const proposalMsg = interpolateWhatsAppMessage({
        template: {
          title: "Proposal Follow-up",
          category: "QUOTATION_FOLLOW_UP",
          message: "Hi {{leadName}}, reviewing proposal.",
        },
        lead: mockLead,
      });
      expect(proposalMsg).toContain("Payment Terms: 40% advance and 60% before project handover.");
      expect(proposalMsg).not.toContain("30% advance");
    });

    it("updates when canonical terms change to 50% advance / 50% on completion", () => {
      setPaymentTerms({
        advancePercent: 50,
        finalPercent: 50,
        finalTiming: "on completion",
      });

      const singlePkgMsg = formatSinglePackageForMessage(mockPackages[0]);
      expect(singlePkgMsg).toContain("Payment Terms: 50% advance and 50% on completion.");
      expect(singlePkgMsg).not.toContain("30% advance");
    });
  });

  describe("6. Restore original: 30% advance / 70% before final delivery", () => {
    it("restores exactly to 30% advance and 70% before final delivery", () => {
      // First mutate
      setPaymentTerms({ advancePercent: 50, finalPercent: 50, finalTiming: "on completion" });
      expect(getPaymentTerms().advancePercent).toBe(50);

      // Now restore
      resetPaymentTerms();

      expect(getPaymentTerms().advancePercent).toBe(30);
      expect(getPaymentTerms().finalPercent).toBe(70);
      expect(getPaymentTerms().finalTiming).toBe("before final delivery");
      expect(PAYMENT_TERMS.advancePercent).toBe(30);
      expect(PAYMENT_TERMS.finalPercent).toBe(70);
      expect(PAYMENT_TERMS.finalTiming).toBe("before final delivery");

      const singleMsg = formatSinglePackageForMessage(mockPackages[1]);
      expect(singleMsg).toContain("Payment Terms: 30% advance and 70% before final delivery.");

      const proposalMsg = interpolateWhatsAppMessage({
        template: {
          title: "Proposal Follow-up",
          category: "QUOTATION_FOLLOW_UP",
          message: "Hi {{leadName}}, sharing the proposal.",
        },
        lead: mockLead,
      });
      expect(proposalMsg).toContain("Payment Terms: 30% advance and 70% before final delivery.");
    });
  });

  describe("7. Deduplication: Do not duplicate payment terms if already present", () => {
    it("does not duplicate if template already contains 'Payment Terms: 30% advance...'", () => {
      const template = {
        title: "Proposal Delivery",
        category: "QUOTATION_SENT",
        message: "Hi {{leadName}} 👋\n\nHere is your formal proposal.\n\nPayment Terms: 30% advance and 70% before final delivery.\n\nLet us know your thoughts!",
      };

      const message = interpolateWhatsAppMessage({
        template,
        lead: mockLead,
      });

      const matches = message.match(/Payment Terms/g);
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(1);
    });

    it("does not duplicate if template has 'Payment Terms:\n30% advance and 70% before final delivery.'", () => {
      const template = {
        title: "Packages / Pricing",
        message: "Hi {{leadName}}\n\nWebsite package:\n{{packagePricingLinks}}\n\nPayment Terms:\n30% advance and 70% before final delivery.\n\nCheers!",
      };

      const message = interpolateWhatsAppMessage({
        template,
        lead: mockLead,
        packages: mockPackages,
        selectedPackageIds: new Set(["pkg-starter"]),
      });

      const matches = message.match(/Payment Terms/gi);
      expect(matches?.length).toBe(1);
    });

    it("does not duplicate if template has custom payment terms text", () => {
      const template = {
        title: "Enterprise Custom Offer",
        category: "PROPOSAL",
        message: "Hi {{leadName}}, as agreed: 50% advance and 50% on final delivery.",
      };

      const message = interpolateWhatsAppMessage({
        template,
        lead: mockLead,
      });

      expect(message).toBe("Hi Aarav Sharma, as agreed: 50% advance and 50% on final delivery.");
      expect(message).not.toContain("Payment Terms: 30% advance");
    });
  });

  describe("8. Dynamic Placeholder Support ({paymentTerms} & {{paymentTerms}})", () => {
    it("replaces {paymentTerms} in template with canonical terms", () => {
      const template = "Hello {name}, your quotation for {requirement} is ready.\n\n{paymentTerms}";
      const rendered = renderWhatsAppMessage(template, mockLead as any);
      expect(rendered).toContain("Payment Terms: 30% advance and 70% before final delivery.");
      expect(rendered).not.toContain("{paymentTerms}");
    });

    it("replaces {{paymentTerms}} in template with canonical terms", () => {
      const template = "Hello {{leadName}}, your quotation is ready.\n\n{{paymentTerms}}";
      const rendered = interpolatePlaceholders(template, mockLead as any);
      expect(rendered).toContain("Payment Terms: 30% advance and 70% before final delivery.");
      expect(rendered).not.toContain("{{paymentTerms}}");
    });
  });
});
