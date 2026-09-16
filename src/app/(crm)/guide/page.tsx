import type { Metadata } from "next";
import { GuideWorkspace } from "@/features/guide/guide-workspace";

export const metadata: Metadata = {
  title: "CRM Guide | Scale Flow CRM",
  description: "Comprehensive practical guide and reference for all Scale Flow CRM features, statuses, and workflows.",
};

export default function GuidePage() {
  return <GuideWorkspace />;
}
