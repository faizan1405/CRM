import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { META_CONFIG } from "@/lib/meta/config";
import { processMetaLead } from "@/features/meta-leads/services/meta-lead-processor";

function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret?: string): boolean {
  if (!appSecret) {
    // If appSecret is not configured, signature checking cannot be enforced
    return true;
  }

  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const expectedSignature = signatureHeader.slice(7);
  const hmac = crypto.createHmac("sha256", appSecret);
  hmac.update(rawBody, "utf8");
  const calculatedSignature = hmac.digest("hex");

  if (expectedSignature.length !== calculatedSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "hex"),
    Buffer.from(calculatedSignature, "hex")
  );
}

/**
 * GET handler: Meta Webhook Verification Challenge
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = META_CONFIG.verifyToken;

  if (mode === "subscribe" && token && expectedToken && token === expectedToken) {
    return new Response(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new NextResponse("Forbidden: Webhook verification failed.", {
    status: 403,
  });
}

/**
 * POST handler: Meta Leadgen Event Ingestion
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("x-hub-signature-256");

    // 1. Verify HMAC Signature
    if (META_CONFIG.appSecret) {
      const isValid = verifyMetaSignature(rawBody, signatureHeader, META_CONFIG.appSecret);
      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid webhook signature." },
          { status: 401 }
        );
      }
    }

interface WebhookChangeValue {
  leadgen_id?: string | number;
  form_id?: string | number;
  page_id?: string | number;
  ad_id?: string | number;
}

interface WebhookChange {
  field: string;
  value?: WebhookChangeValue;
}

interface WebhookEntry {
  id?: string;
  time?: number;
  changes?: WebhookChange[];
}

interface WebhookPayload {
  object?: string;
  entry?: WebhookEntry[];
}

    // 2. Parse JSON
    let body: WebhookPayload;
    try {
      body = JSON.parse(rawBody) as WebhookPayload;
    } catch {
      return NextResponse.json(
        { error: "Malformed JSON payload." },
        { status: 400 }
      );
    }

    if (body.object !== "page" && body.object !== "leadgen") {
      // Return 200 for unhandled object types so Meta doesn't keep retrying
      return NextResponse.json({ received: true, ignored: true, reason: "Unhandled object type" });
    }

    const entries = Array.isArray(body.entry) ? body.entry : [];
    const results: Array<{ leadgenId: string; result: unknown }> = [];

    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        if (change.field === "leadgen" && change.value) {
          const leadgenId = change.value.leadgen_id;
          if (leadgenId) {
            const res = await processMetaLead(String(leadgenId), {
              formId: change.value.form_id ? String(change.value.form_id) : undefined,
              pageId: change.value.page_id ? String(change.value.page_id) : undefined,
              adId: change.value.ad_id ? String(change.value.ad_id) : undefined,
            });
            results.push({ leadgenId: String(leadgenId), result: res });
          }
        }
      }
    }

    return NextResponse.json({
      received: true,
      processedCount: results.length,
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json(
      { error: "Failed to process Meta webhook.", details: message },
      { status: 500 }
    );
  }
}
