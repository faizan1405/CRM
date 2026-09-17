export type FollowUpType = "Call" | "WhatsApp" | "Email" | "Other";

export type FollowUpStatus = "Pending" | "Completed" | "Cancelled";

export const typeToDatabase: Record<string, "CALL" | "WHATSAPP" | "EMAIL" | "OTHER"> = {
  Call: "CALL",
  WhatsApp: "WHATSAPP",
  Email: "EMAIL",
  Other: "OTHER",
  CALL: "CALL",
  WHATSAPP: "WHATSAPP",
  EMAIL: "EMAIL",
  OTHER: "OTHER",
  call: "CALL",
  whatsapp: "WHATSAPP",
  email: "EMAIL",
  other: "OTHER",
};

export const statusFromDatabase: Record<"PENDING" | "COMPLETED" | "CANCELLED", FollowUpStatus> = {
  PENDING: "Pending",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const typeFromDatabase: Record<"CALL" | "WHATSAPP" | "EMAIL" | "OTHER", FollowUpType> = {
  CALL: "Call",
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  OTHER: "Other",
};

export type FollowUp = {
  id: string;
  leadId: string;
  scheduledAt: string;
  type: FollowUpType;
  status: FollowUpStatus;
  note: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  submissionId?: string | null;
  lead?: {
    id: string;
    name: string;
    business: string;
    phone: string | null;
    status: string;
  };
  leadNote?: string;
};

export type NewFollowUpInput = {
  id?: string;
  leadId: string;
  scheduledAt: string;
  type: string;
  note: string;
  submissionId?: string;
};

export interface FollowUpActionSuccess<T> {
  success: true;
  data: T;
  error?: undefined;
}

export interface FollowUpActionError {
  success: false;
  error: string;
  data?: undefined;
}

export type FollowUpActionResult<T = FollowUp> =
  | FollowUpActionSuccess<T>
  | FollowUpActionError;

export const followUpTypes: FollowUpType[] = ["Call", "WhatsApp", "Email", "Other"];

export const followUpStatuses: FollowUpStatus[] = ["Pending", "Completed", "Cancelled"];
