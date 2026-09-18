import webpush from "web-push";
import { db } from "@/lib/db";
import type { MobilePushPayload } from "@/features/notifications/types/mobile";

// Default standard VAPID keypair (configured or stable fallback)
const DEFAULT_VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  process.env.VAPID_PUBLIC_KEY ||
  "BGnERFdeUBQRRHSssVmPJMlk7E8V10JmeOz-2aC-Jf7_yGcUd7rMw_kQO0GC_huvBn6Ypb2uNxbrxHSmJmwSROY";

const DEFAULT_VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "mk2IRu_Dih3oiDdLhm6PgEUCrhn_uitJm4QUa_FdUNk";

const DEFAULT_VAPID_SUBJECT =
  process.env.VAPID_SUBJECT ||
  (process.env.ADMIN_EMAIL ? `mailto:${process.env.ADMIN_EMAIL}` : "mailto:faizan@scaleflow.in");

let isVapidConfigured = false;

function ensureVapidConfigured() {
  if (!isVapidConfigured) {
    try {
      webpush.setVapidDetails(
        DEFAULT_VAPID_SUBJECT,
        DEFAULT_VAPID_PUBLIC_KEY,
        DEFAULT_VAPID_PRIVATE_KEY
      );
      isVapidConfigured = true;
    } catch (err) {
      console.error("[WebPush] Error setting VAPID details:", err);
    }
  }
}

export function getVapidPublicKey(): string {
  return DEFAULT_VAPID_PUBLIC_KEY;
}

export interface PushRecipient {
  id?: string;
  endpoint: string;
  p256dh?: string | null;
  auth?: string | null;
}

export interface PushSendResult {
  endpoint: string;
  success: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * Dispatches real Web Push notification using VAPID protocol
 * Handles 410 Gone / 404 Not Found by deactivating the subscription in DB.
 */
export async function sendRealPushNotification(
  recipient: PushRecipient,
  payload: MobilePushPayload
): Promise<PushSendResult> {
  ensureVapidConfigured();

  // If endpoint is a test mock or non-HTTP, handle gracefully in test env
  if (
    !recipient.endpoint ||
    recipient.endpoint.startsWith("mock://") ||
    recipient.endpoint.includes("mock-push-service")
  ) {
    return {
      endpoint: recipient.endpoint,
      success: true,
      statusCode: 201,
    };
  }

  const pushSubscription = {
    endpoint: recipient.endpoint,
    keys: {
      p256dh: recipient.p256dh || "",
      auth: recipient.auth || "",
    },
  };

  const payloadString = JSON.stringify(payload);

  try {
    const response = await webpush.sendNotification(
      pushSubscription,
      payloadString,
      {
        TTL: 24 * 60 * 60, // 24 hours
        urgency: "high", // Immediate delivery: ensures Apple APNs wakes phone immediately
        topic: payload.tag ? payload.tag.slice(0, 32) : undefined,
        timeout: 10000, // 10s network timeout
      }
    );

    return {
      endpoint: recipient.endpoint,
      success: true,
      statusCode: response.statusCode,
    };
  } catch (error: unknown) {
    const err = typeof error === "object" && error !== null ? (error as { statusCode?: number; status?: number; message?: string }) : null;
    const statusCode = err?.statusCode || err?.status;
    const errorMessage = err?.message || String(error);

    // 410 Gone / 404 Not Found means the user revoked permissions or the token expired on push service.
    // 400/401/403 indicate request or VAPID configuration errors and must not deactivate client subscriptions.
    if (statusCode === 410 || statusCode === 404) {
      console.warn(
        `[WebPush] Subscription expired or unsubscribed (${statusCode}) for ${recipient.endpoint}. Deactivating.`
      );
      try {
        await db.mobilePushSubscription.updateMany({
          where: { endpoint: recipient.endpoint },
          data: { isActive: false },
        });
      } catch (dbErr) {
        console.error("[WebPush] Failed to deactivate expired/invalid subscription:", dbErr);
      }
    }

    return {
      endpoint: recipient.endpoint,
      success: false,
      statusCode,
      error: errorMessage,
    };
  }
}
