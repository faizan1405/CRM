import type { Metadata } from "next";
import { SalesAssetsWorkspace } from "@/features/sales-assets/components/sales-assets-workspace";
import { getWebsitePackages, getWebsiteSamples } from "@/app/actions/sales-assets";
import { getWhatsAppTemplates } from "@/app/actions/whatsapp-templates";

export const metadata: Metadata = {
  title: "Sales Assets",
  description: "Manage packages, samples, and WhatsApp templates.",
};

export default async function SalesAssetsPage() {
  const [packagesRes, samplesRes, templatesRes] = await Promise.all([
    getWebsitePackages(),
    getWebsiteSamples(),
    getWhatsAppTemplates(),
  ]);

  const packages = packagesRes.success ? packagesRes.data : [];
  const samples = samplesRes.success ? samplesRes.data : [];
  const templates = templatesRes.success ? templatesRes.data : [];

  return (
    <SalesAssetsWorkspace 
      // @ts-expect-error - Prisma mismatch
      initialPackages={packages}
      // @ts-expect-error - Prisma mismatch
      initialSamples={samples}
      // @ts-expect-error - Prisma mismatch
      initialTemplates={templates}
    />
  );
}
