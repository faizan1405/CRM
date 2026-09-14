import type { Metadata } from "next";
import { WhatsAppTemplatesWorkspace } from "@/features/whatsapp-templates";

export const metadata: Metadata = {
  title: "WhatsApp Templates",
  description: "Manage outreach templates and personalized WhatsApp messaging.",
};

export default function WhatsAppTemplatesPage() {
  return <WhatsAppTemplatesWorkspace />;
}
