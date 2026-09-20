import type { WebsitePackage } from "@prisma/client";
import { formatPaymentTermsSentence } from "@/lib/payment-terms";

const PACKAGES_UPDATED_EVENT = "crm:packages-updated";

let memoryPackagesCache: WebsitePackage[] | null = null;

/**
 * Returns currently cached packages from in-memory module store.
 */
export function getCachedPackages(): WebsitePackage[] | null {
  return memoryPackagesCache;
}

/**
 * Updates in-memory packages cache with fresh packages.
 */
export function setCachedPackages(packages: WebsitePackage[]): void {
  memoryPackagesCache = packages;
}

/**
 * Invalidates the in-memory packages cache.
 */
export function invalidateCachedPackages(): void {
  memoryPackagesCache = null;
}

/**
 * Broadcasts an update event across the browser runtime so all active components
 * (WhatsApp picker, Sales Assets cards, previews) update immediately without reload.
 */
export function broadcastPackagesUpdated(packages: WebsitePackage[]): void {
  setCachedPackages(packages);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<WebsitePackage[]>(PACKAGES_UPDATED_EVENT, {
        detail: packages,
      })
    );
  }
}

/**
 * Subscribes to package update events across the client.
 */
export function subscribePackagesUpdated(
  callback: (packages: WebsitePackage[]) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<WebsitePackage[]>;
    if (customEvent.detail && Array.isArray(customEvent.detail)) {
      callback(customEvent.detail);
    }
  };

  window.addEventListener(PACKAGES_UPDATED_EVENT, handler);
  return () => {
    window.removeEventListener(PACKAGES_UPDATED_EVENT, handler);
  };
}

/**
 * Formats a package's price label in Indian Rupee notation.
 */
export function formatPackagePrice(pkg: {
  price: number | string | import("@prisma/client").Prisma.Decimal;
  isStartingPrice?: boolean;
}): string {
  const numPrice = Number(pkg.price);
  const formatted = isNaN(numPrice) ? "0" : numPrice.toLocaleString("en-IN");
  const prefix = pkg.isStartingPrice ? "starting " : "";
  return `${prefix}₹${formatted}`;
}

/**
 * Canonical generator for the "{{packagePricingLinks}}" replacement text.
 */
export function formatPackageListForMessage(packages: WebsitePackage[]): string {
  const activePkgs = packages.filter((p) => p.isActive);
  if (activePkgs.length === 0) {
    return "(No packages selected)";
  }

  return activePkgs
    .map((p) => {
      const priceText = formatPackagePrice(p);
      const cleanInclusions = (p.inclusions || "").replace(/\n/g, "\n  ");
      return `• ${p.name} — ${priceText}\n  ${cleanInclusions}`;
    })
    .join("\n\n");
}

/**
 * Canonical generator for single-package WhatsApp outreach message.
 */
export function formatSinglePackageForMessage(pkg: WebsitePackage): string {
  const numPrice = Number(pkg.price);
  const formattedPrice = isNaN(numPrice) ? "0" : numPrice.toLocaleString("en-IN");
  const priceDisplay = pkg.isStartingPrice ? `starting from ₹${formattedPrice}` : `₹${formattedPrice}`;
  const formattedInclusions = (pkg.inclusions || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith("•") || line.startsWith("-") ? line : `• ${line}`))
    .join("\n");

  const termsSentence = formatPaymentTermsSentence();
  const packageHeading = pkg.name.toLowerCase().endsWith("package")
    ? pkg.name
    : `${pkg.name} Package`;

  return `What's up from you?\n\nSharing our ${packageHeading} Website Package:\n\n${packageHeading} — ${priceDisplay}\n\n${formattedInclusions}\n\n${termsSentence}\n\nLet me know if you'd like to proceed or discuss the requirement.`;
}
