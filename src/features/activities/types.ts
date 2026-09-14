import type { ActivityType } from "@prisma/client";
import type { LeadActionResult } from "@/features/leads/types";

export interface LeadActivity {
  id: string;
  leadId: string;
  type: ActivityType;
  message: string;
  metadata: unknown | null; 
  createdByUserId: string | null;
  createdAt: string;
}

export type ActivityActionResult<T> = LeadActionResult<T>;
