import type { WhatsAppTemplateCategory as PrismaWhatsAppTemplateCategory } from "@prisma/client";

export interface DefaultTemplateSeed {
  title: string;
  category: PrismaWhatsAppTemplateCategory;
  message: string;
}

export const DEFAULT_WHATSAPP_TEMPLATES: DefaultTemplateSeed[] = [
  {
    title: "Initial Outreach",
    category: "FIRST_CONTACT",
    message:
      "Hi {name}, thanks for reaching out regarding {requirement} for {business}. When is a good time for a quick 5-minute call today?",
  },
  {
    title: "Post-Call Summary",
    category: "AFTER_CALL",
    message:
      "Hi {name}, great speaking with you today! As discussed for {business}, I am preparing the details regarding {requirement}. Let's connect on {followUpDate} at {followUpTime}.",
  },
  {
    title: "Standard Follow-Up",
    category: "FOLLOW_UP",
    message:
      "Hi {name}, following up on our previous conversation regarding {requirement} for {business}. Let me know if you have any questions or if we can connect on {followUpDate}.",
  },
  {
    title: "Quotation Delivery",
    category: "QUOTATION_SENT",
    message:
      "Hi {name}, I have sent over the formal quotation for {requirement}. The estimated budget is {budget}. Please review and let me know if you have any questions!",
  },
  {
    title: "Quotation Follow-Up",
    category: "QUOTATION_FOLLOW_UP",
    message:
      "Hi {name}, checking in to see if you had a chance to review the quotation sent for {requirement}. We'd love to assist you with any clarifications.",
  },
  {
    title: "No Response Check-in",
    category: "NO_RESPONSE",
    message:
      "Hi {name}, hope you are doing well! I tried reaching you regarding {requirement} for {business}. Please let me know when you are available for a brief catch-up.",
  },
  {
    title: "Final Follow-Up / Break-Up",
    category: "FINAL_FOLLOW_UP",
    message:
      "Hi {name}, I understand you may be occupied with other priorities right now. Since I haven't heard back regarding {requirement}, I'll step back for now. Feel free to reach back whenever you are ready!",
  },
  {
    title: "Welcome & Thank You",
    category: "CONVERTED_THANK_YOU",
    message:
      "Hi {name}, thank you for choosing us! We are thrilled to partner with {business} on {requirement}. We will begin onboarding immediately.",
  },
];
