import type { Metadata } from "next";
import { WhatsAppTemplatesWorkspace } from "@/features/whatsapp-templates";
import { 
  getWhatsAppTemplates, 
  createWhatsAppTemplate, 
  updateWhatsAppTemplate, 
  deleteWhatsAppTemplate, 
  duplicateWhatsAppTemplate 
} from "@/app/actions/whatsapp-templates";

export const metadata: Metadata = {
  title: "WhatsApp Templates",
  description: "Manage outreach templates and personalized WhatsApp messaging.",
};

export default async function WhatsAppTemplatesPage() {
  const result = await getWhatsAppTemplates();
  const templates = result.success ? result.data : [];

  return (
    <WhatsAppTemplatesWorkspace 
      initialTemplates={templates}
      onCreateTemplate={async (data) => {
        "use server";
        const res = await createWhatsAppTemplate({
          title: data.title,
          category: data.category,
          message: data.body,
          isActive: data.active
        });
        if (!res.success) throw new Error(res.error);
        return;
      }}
      onUpdateTemplate={async (id, data) => {
        "use server";
        const res = await updateWhatsAppTemplate(id, {
          title: data.title,
          category: data.category,
          message: data.body,
          isActive: data.active
        });
        if (!res.success) throw new Error(res.error);
        return;
      }}
      onDeleteTemplate={async (id) => {
        "use server";
        const res = await deleteWhatsAppTemplate(id);
        if (!res.success) throw new Error(res.error);
        return;
      }}
      onDuplicateTemplate={async (tpl) => {
        "use server";
        const res = await duplicateWhatsAppTemplate(tpl.id);
        if (!res.success) throw new Error(res.error);
        return;
      }}
    />
  );
}
