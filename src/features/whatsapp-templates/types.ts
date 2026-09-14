import type { WhatsAppTemplateCategory as PrismaWhatsAppTemplateCategory } from "@prisma/client";

export type WhatsAppTemplateCategoryKey =
  | "first_contact"
  | "after_call"
  | "follow_up"
  | "quotation_sent"
  | "quotation_followup"
  | "no_response"
  | "final_followup"
  | "converted";


export const CATEGORY_MAP: Record<WhatsAppTemplateCategoryKey, PrismaWhatsAppTemplateCategory> = {
  first_contact: "FIRST_CONTACT",
  after_call: "AFTER_CALL",
  follow_up: "FOLLOW_UP",
  quotation_sent: "QUOTATION_SENT",
  quotation_followup: "QUOTATION_FOLLOW_UP",
  no_response: "NO_RESPONSE",
  final_followup: "FINAL_FOLLOW_UP",
  converted: "CONVERTED_THANK_YOU",
};

export const PRISMA_TO_CATEGORY_MAP: Record<PrismaWhatsAppTemplateCategory, WhatsAppTemplateCategoryKey> = {
  FIRST_CONTACT: "first_contact",
  AFTER_CALL: "after_call",
  FOLLOW_UP: "follow_up",
  QUOTATION_SENT: "quotation_sent",
  QUOTATION_FOLLOW_UP: "quotation_followup",
  NO_RESPONSE: "no_response",
  FINAL_FOLLOW_UP: "final_followup",
  CONVERTED_THANK_YOU: "converted",
};

export const CATEGORY_LABELS: Record<WhatsAppTemplateCategoryKey, string> = {
  first_contact: "First Contact",
  after_call: "After Call / Intro",
  follow_up: "Follow-up",
  quotation_sent: "Quotation Sent",
  quotation_followup: "Quotation Follow-up",
  no_response: "No Response",
  final_followup: "Final Follow-up",
  converted: "Converted / Thank You",
};

export interface WhatsAppTemplate {
  id: string;
  title: string;
  category: WhatsAppTemplateCategoryKey;
  rawCategory?: PrismaWhatsAppTemplateCategory;
  categoryLabel: string;
  body: string;
  active: boolean;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceholderInfo {
  key: string;
  label: string;
  sampleValue: string;
  description: string;
}

export interface WhatsAppComposerLead {
  id: string;
  name: string;
  phone: string;
  business?: string | null;
  requirement?: string | null;
  budget?: number | string | null;
  followUpDate?: string | null;
  followUpTime?: string | null;
  status?: string | null;
  notes?: string | null;
}

export interface AIPersonalizeResult {
  originalMessage: string;
  personalizedMessage: string;
  rationale?: string;
}

export interface TemplateActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface WhatsAppTemplatesProps {
  initialTemplates?: WhatsAppTemplate[];
  onCreateTemplate?: (template: Omit<WhatsAppTemplate, "id" | "createdAt" | "updatedAt">) => Promise<WhatsAppTemplate | void> | void;
  onUpdateTemplate?: (id: string, updates: Partial<WhatsAppTemplate>) => Promise<WhatsAppTemplate | void> | void;
  onDeleteTemplate?: (id: string) => Promise<void> | void;
  onDuplicateTemplate?: (template: WhatsAppTemplate) => Promise<WhatsAppTemplate | void> | void;
  onAIPersonalize?: (lead: WhatsAppComposerLead, templateBody: string) => Promise<string> | string;
}
