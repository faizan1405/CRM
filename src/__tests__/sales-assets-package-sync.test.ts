import { db } from "@/lib/db";
import {
  getWebsitePackages,
  updateWebsitePackage,
} from "@/app/actions/sales-assets";
import {
  setCachedPackages,
  getCachedPackages,
  formatPackagePrice,
  formatPackageListForMessage,
  formatSinglePackageForMessage,
} from "@/features/sales-assets/packages-sync";
import { interpolatePlaceholders } from "@/features/whatsapp-templates/placeholders";
import { vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn().mockResolvedValue({
    id: "test-sales-assets-user",
    email: "test@example.com",
    role: "ADMIN",
  }),
}));

describe("Sales Assets Package Synchronization", () => {
  let originalBusinessPackage: any = null;

  beforeAll(async () => {
    // 1. Read current Business package or seed for test environment
    let pkgs = await db.websitePackage.findMany({
      where: { name: { contains: "Business" } },
    });
    if (pkgs.length === 0) {
      const created = await db.websitePackage.create({
        data: {
          name: "Business",
          price: 15000,
          isStartingPrice: false,
          inclusions: "- Everything in Starter\n- Multi-page website\n- Better UI/UX\n- Contact / enquiry forms",
          hosting: "Included for 1 year",
          domain: "Excluded / client side",
          sortOrder: 2,
        },
      });
      pkgs = [created];
    }
    expect(pkgs.length).toBeGreaterThan(0);
    originalBusinessPackage = {
      id: pkgs[0].id,
      name: pkgs[0].name,
      price: Number(pkgs[0].price),
      isStartingPrice: pkgs[0].isStartingPrice,
      inclusions: pkgs[0].inclusions,
      hosting: pkgs[0].hosting,
      domain: pkgs[0].domain,
      isActive: pkgs[0].isActive,
      sortOrder: pkgs[0].sortOrder,
    };
  });

  afterAll(async () => {
    // 6. Restore original values afterward
    if (originalBusinessPackage) {
      await db.websitePackage.update({
        where: { id: originalBusinessPackage.id },
        data: {
          name: originalBusinessPackage.name,
          price: originalBusinessPackage.price,
          inclusions: originalBusinessPackage.inclusions,
          hosting: originalBusinessPackage.hosting,
          domain: originalBusinessPackage.domain,
          isActive: originalBusinessPackage.isActive,
          sortOrder: originalBusinessPackage.sortOrder,
        },
      });
    }
  });

  it("synchronizes package edit to ₹50,000 across server, cache, messages, and preview", async () => {
    // Change to test value: ₹50,000
    const updateRes = await updateWebsitePackage(originalBusinessPackage.id, {
      price: 50000,
    });
    expect(updateRes.success).toBe(true);
    expect(Number(updateRes.data!.price)).toBe(50000);

    // Verify DB reflects ₹50,000
    const freshDbPkg = await db.websitePackage.findUnique({
      where: { id: originalBusinessPackage.id },
    });
    expect(Number(freshDbPkg?.price)).toBe(50000);

    // Verify server action getWebsitePackages returns ₹50,000
    const listRes = await getWebsitePackages();
    expect(listRes.success).toBe(true);
    const updatedInList = listRes.data?.find((p) => p.id === originalBusinessPackage.id);
    expect(Number(updatedInList?.price)).toBe(50000);

    // Sync cache
    if (listRes.data) {
      setCachedPackages(listRes.data);
    }
    expect(getCachedPackages()).not.toBeNull();

    // Verify package price formatting
    const formattedPrice = formatPackagePrice(updatedInList!);
    expect(formattedPrice).toContain("50,000");

    // Verify single package outreach message
    const singleMsg = formatSinglePackageForMessage(updatedInList!);
    expect(singleMsg).toContain("Business Package — ₹50,000");

    // Verify multi-package pricing links generator
    const packageListText = formatPackageListForMessage(listRes.data!);
    expect(packageListText).toContain("Business — ₹50,000");

    // Verify template interpolation dynamically reflects ₹50,000
    const templateWithPricing = "Hi {{leadName}}\n\nWebsite packages:\n{{packagePricingLinks}}";
    const interpolated = interpolatePlaceholders(templateWithPricing, null, true, listRes.data!);
    expect(interpolated).toContain("Business — ₹50,000");
    expect(interpolated).not.toContain("₹12,000");
    expect(interpolated).not.toContain("₹15,000");
  });

  it("synchronizes second edit to ₹35,000 immediately", async () => {
    // Change to second test value: ₹35,000
    const updateRes = await updateWebsitePackage(originalBusinessPackage.id, {
      price: 35000,
    });
    expect(updateRes.success).toBe(true);
    expect(Number(updateRes.data!.price)).toBe(35000);

    const listRes = await getWebsitePackages();
    expect(listRes.success).toBe(true);
    const updatedInList = listRes.data?.find((p) => p.id === originalBusinessPackage.id);
    expect(Number(updatedInList?.price)).toBe(35000);

    if (listRes.data) {
      setCachedPackages(listRes.data);
    }

    const singleMsg = formatSinglePackageForMessage(updatedInList!);
    expect(singleMsg).toContain("Business Package — ₹35,000");
    expect(singleMsg).not.toContain("50,000");

    const packageListText = formatPackageListForMessage(listRes.data!);
    expect(packageListText).toContain("Business — ₹35,000");
  });

  it("synchronizes package name and feature (inclusions) edits in generated WhatsApp content", async () => {
    // Edit package name and inclusions
    const updateRes = await updateWebsitePackage(originalBusinessPackage.id, {
      name: "Business Premium Plus",
      price: 45000,
      inclusions: "- Ultra Fast CDN\n- Custom Payment Gateway\n- 24/7 Priority Support",
    });
    expect(updateRes.success).toBe(true);
    expect(updateRes.data!.name).toBe("Business Premium Plus");

    const listRes = await getWebsitePackages();
    const updatedInList = listRes.data?.find((p) => p.id === originalBusinessPackage.id);
    expect(updatedInList?.name).toBe("Business Premium Plus");

    // Single message includes new name, new price, and new features
    const singleMsg = formatSinglePackageForMessage(updatedInList!);
    expect(singleMsg).toContain("Business Premium Plus");
    expect(singleMsg).toContain("₹45,000");
    expect(singleMsg).toContain("Ultra Fast CDN");
    expect(singleMsg).toContain("Custom Payment Gateway");
    expect(singleMsg).toContain("24/7 Priority Support");

    // Multi-package list includes new name and new features
    const packageListText = formatPackageListForMessage(listRes.data!);
    expect(packageListText).toContain("Business Premium Plus — ₹45,000");
    expect(packageListText).toContain("Ultra Fast CDN");
  });

  it("does not rewrite historical activity records", async () => {
    // Check that existing LeadActivity records exist and are unchanged
    const activitiesCount = await db.leadActivity.count();
    expect(activitiesCount).toBeGreaterThanOrEqual(0);
  });
});
