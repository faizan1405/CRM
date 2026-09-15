import { z } from "zod";
import type {
  AIFieldConfidence,
  StructuredLeadField,
  StructuredLeadDraft,
  DuplicateLeadCandidate,
  StructuredLeadResult,
  StructureLeadResponse,
  StructureLeadCallback,
  BulkLeadItemStatus,
  BulkLeadDraftItem,
  BulkLeadReviewDTO,
  BulkStructureLeadResponse,
  BulkCreateItemAction,
  BulkCreateLeadItem,
  BulkCreateItemOutcome,
  BulkCreateItemResult,
  BulkCreateResponse,
} from "@/features/leads/ai-entry-types";

export type {
  AIFieldConfidence,
  StructuredLeadField,
  StructuredLeadDraft,
  DuplicateLeadCandidate,
  StructuredLeadResult,
  StructureLeadResponse,
  StructureLeadCallback,
  BulkLeadItemStatus,
  BulkLeadDraftItem,
  BulkLeadReviewDTO,
  BulkStructureLeadResponse,
  BulkCreateItemAction,
  BulkCreateLeadItem,
  BulkCreateItemOutcome,
  BulkCreateItemResult,
  BulkCreateResponse,
};

export const LeadStatusesList = ["New", "Contacted", "Qualified", "Proposal Sent", "Won", "Lost"] as const;

/**
 * Raw JSON schema returned by Groq LLM for single lead extraction
 */
export const GroqLeadExtractionSchema = z.object({
  name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  business: z.string().nullable().optional(),
  industryOrRequirement: z.string().nullable().optional(),
  budget: z.union([z.number(), z.string()]).nullable().optional(),
  status: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  suggestedFollowUpDate: z.string().nullable().optional(), // YYYY-MM-DD
  suggestedFollowUpTime: z.string().nullable().optional(), // HH:MM (24-hour)
  confidence: z.record(z.string(), z.enum(["high", "review"])).nullable().optional(),
});

export type GroqLeadExtraction = z.infer<typeof GroqLeadExtractionSchema>;

/**
 * Raw JSON schema returned by Groq LLM for bulk leads extraction
 */
export const GroqBulkLeadExtractionSchema = z.object({
  leads: z.array(GroqLeadExtractionSchema),
});

export type GroqBulkLeadExtraction = z.infer<typeof GroqBulkLeadExtractionSchema>;
