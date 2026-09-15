import { META_CONFIG } from "@/lib/meta/config";
import type { MetaLeadRawResponse } from "../types";

export class MetaGraphApiError extends Error {
  public code?: number;
  public subcode?: number;
  public type?: string;

  constructor(message: string, code?: number, subcode?: number, type?: string) {
    super(message);
    this.name = "MetaGraphApiError";
    this.code = code;
    this.subcode = subcode;
    this.type = type;
  }
}

export async function fetchMetaLeadDetails(
  leadgenId: string,
  options?: { timeoutMs?: number }
): Promise<MetaLeadRawResponse> {
  const pageAccessToken = META_CONFIG.pageAccessToken;
  if (!pageAccessToken) {
    throw new MetaGraphApiError(
      "Meta Page Access Token is not configured (META_PAGE_ACCESS_TOKEN)."
    );
  }

  const cleanLeadId = leadgenId.trim();
  if (!cleanLeadId) {
    throw new MetaGraphApiError("Leadgen ID is required.");
  }

  const timeoutMs = options?.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const apiVersion = META_CONFIG.graphApiVersion;
  const fields = [
    "id",
    "created_time",
    "form_id",
    "page_id",
    "ad_id",
    "ad_name",
    "adset_id",
    "adset_name",
    "campaign_id",
    "campaign_name",
    "field_data",
  ].join(",");

  const url = `https://graph.facebook.com/${apiVersion}/${cleanLeadId}?fields=${encodeURIComponent(
    fields
  )}&access_token=${encodeURIComponent(pageAccessToken)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    const data = (await response.json()) as MetaLeadRawResponse;

    if (!response.ok || data.error) {
      const err = data.error;
      const code = err?.code || response.status;
      const subcode = err?.error_subcode;
      const errType = err?.type || "GraphMethodException";
      let message = err?.message || `Meta Graph API request failed with status ${response.status}.`;

      // Sanitize any accidental token echo from Meta error message
      if (pageAccessToken && message.includes(pageAccessToken)) {
        message = message.replace(pageAccessToken, "[REDACTED_TOKEN]");
      }

      if (code === 190 || subcode === 460 || subcode === 463 || subcode === 467) {
        throw new MetaGraphApiError(
          "Meta Access Token is expired, invalid, or has been revoked. Please reconnect Meta account in Settings.",
          code,
          subcode,
          errType
        );
      }

      if (code === 4 || code === 17 || code === 32 || code === 613) {
        throw new MetaGraphApiError(
          "Meta API rate limit reached. Retrying automatically shortly.",
          code,
          subcode,
          errType
        );
      }

      if (code === 100) {
        throw new MetaGraphApiError(
          `Invalid Meta Lead ID '${cleanLeadId}' or missing permissions on this page/form.`,
          code,
          subcode,
          errType
        );
      }

      throw new MetaGraphApiError(message, code, subcode, errType);
    }

    return data;
  } catch (error: unknown) {
    if (error instanceof MetaGraphApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new MetaGraphApiError(
        `Meta Graph API timed out after ${timeoutMs}ms while retrieving lead ${cleanLeadId}.`
      );
    }

    const msg = error instanceof Error ? error.message : "Unknown network error";
    throw new MetaGraphApiError(`Failed to fetch Meta lead: ${msg}`);
  } finally {
    clearTimeout(timeoutId);
  }
}
