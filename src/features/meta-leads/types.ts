export interface MetaFieldDatum {
  name: string;
  values: string[];
}

export interface MetaLeadRawResponse {
  id: string;
  created_time: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
  page_id?: string;
  field_data?: MetaFieldDatum[];
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

export interface NormalizedMetaLead {
  metaLeadId: string;
  name: string;
  phone: string;
  email: string | null;
  business: string | null;
  industry: string | null;
  budget: number | null;
  notes: string | null;
  formId: string | null;
  pageId: string | null;
  adId: string | null;
  adsetId: string | null;
  campaignId: string | null;
  customAnswers: Record<string, string>;
}

export interface MetaLeadProcessingResult {
  success: boolean;
  status: "PROCESSED" | "DUPLICATE_UPDATED" | "SKIPPED" | "FAILED";
  leadId?: string;
  receiptId?: string;
  isDuplicate?: boolean;
  message?: string;
  error?: string;
}

export interface MetaConnectionStatus {
  isConfigured: boolean;
  missingVariables: string[];
  graphApiVersion: string;
  hasAppSecret: boolean;
  hasVerifyToken: boolean;
  hasPageAccessToken: boolean;
  totalReceipts: number;
  processedCount: number;
  duplicateUpdatedCount: number;
  failedCount: number;
  lastSuccessfulLeadAt: string | null;
  lastFailure: {
    metaLeadId?: string;
    error: string;
    timestamp: string;
  } | null;
  recentReceipts: {
    id: string;
    metaLeadId: string;
    leadId: string | null;
    status: string;
    errorMessage: string | null;
    receivedAt: string;
    processedAt: string | null;
    retryCount: number;
  }[];
}
