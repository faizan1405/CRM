import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { NextRequest } from "next/server";
import {
  getPersonalNotes,
  createPersonalNote,
  updatePersonalNote,
  deletePersonalNote,
  togglePersonalNotePinned,
  searchPersonalNotes,
  cleanPersonalNote,
  organizePersonalNote,
  rewritePersonalNoteClearly,
  summarizePersonalNote,
} from "@/app/actions/personal-notes";
import { GET, POST } from "@/app/api/meta/webhook/route";
import { normalizeMetaLeadPayload } from "@/features/meta-leads/services/lead-normalizer";
import { processMetaLead } from "@/features/meta-leads/services/meta-lead-processor";
import { getMetaConnectionStatus, retryMetaLeadReceipt } from "@/app/actions/meta-leads";
import { clearDemoLeads, DEMO_TAG } from "@/features/demo-data/demo-seed";
import { populateDemoDataAction, clearDemoDataAction } from "@/app/actions/demo-data";
import { db } from "@/lib/db";
import * as authModule from "@/lib/auth";
import * as groqModule from "@/lib/ai/groq-client";
import * as graphClientModule from "@/features/meta-leads/services/meta-graph-client";
import type { MetaLeadRawResponse } from "@/features/meta-leads/types";
import type { JWTPayload } from "jose";

describe("Phase 10: Personal Notes + Meta Leads + Final System Hardening", () => {
  const user1 = { id: "test-p10-user-1", email: "p10-user1@example.com" };
  const user2 = { id: "test-p10-user-2", email: "p10-user2@example.com" };
  const secret = "test_meta_app_secret_12345";
  const verifyToken = "my_custom_verify_token_999";

  const createdNoteIds: string[] = [];
  const createdLeadIds: string[] = [];
  const createdReceiptIds: string[] = [];

  beforeAll(async () => {
    // Ensure test users exist in DB
    await db.user.upsert({
      where: { id: user1.id },
      update: {},
      create: {
        id: user1.id,
        name: "Phase 10 User 1",
        email: user1.email,
        passwordHash: "dummyhash1",
        role: "ADMIN",
      },
    });

    await db.user.upsert({
      where: { id: user2.id },
      update: {},
      create: {
        id: user2.id,
        name: "Phase 10 User 2",
        email: user2.email,
        passwordHash: "dummyhash2",
        role: "USER",
      },
    });

    process.env.META_APP_SECRET = secret;
    process.env.META_VERIFY_TOKEN = verifyToken;
    process.env.META_PAGE_ACCESS_TOKEN = "EAABtest_page_access_token";
  });

  afterAll(async () => {
    if (createdNoteIds.length > 0) {
      await db.personalNote.deleteMany({ where: { id: { in: createdNoteIds } } });
    }
    if (createdReceiptIds.length > 0) {
      await db.metaLeadReceipt.deleteMany({ where: { id: { in: createdReceiptIds } } });
    }
    if (createdLeadIds.length > 0) {
      await db.salesNotification.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadLossEvent.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.followUp.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadActivity.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadAIInsight.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.metaLeadReceipt.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
    }
    await clearDemoLeads();
    await db.personalNote.deleteMany({ where: { userId: { in: [user1.id, user2.id] } } });
    await db.metaLeadReceipt.deleteMany({ where: { metaLeadId: { startsWith: "test-meta-" } } });
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.META_APP_SECRET = secret;
    process.env.META_VERIFY_TOKEN = verifyToken;
    process.env.META_PAGE_ACCESS_TOKEN = "EAABtest_page_access_token";
  });

  // ==========================================
  // 1. Personal Notes CRUD & Ownership Isolation
  // ==========================================
  describe("1. Personal Notes CRUD & Security Isolation", () => {
    it("creates a persistent personal note in Neon for user1", async () => {
      vi.spyOn(authModule, "getSession").mockResolvedValue(user1 as unknown as JWTPayload);

      const res = await createPersonalNote({
        title: "Q4 Strategy Note",
        content: "Expand Meta lead capture campaigns in Mumbai and Delhi.",
        pinned: true,
      });

      expect(res.success).toBe(true);
      expect(res.data?.id).toBeDefined();
      expect(res.data?.userId).toBe(user1.id);
      expect(res.data?.title).toBe("Q4 Strategy Note");
      expect(res.data?.pinned).toBe(true);
      if (res.data?.id) createdNoteIds.push(res.data.id);
    });

    it("rejects unauthenticated requests", async () => {
      vi.spyOn(authModule, "getSession").mockResolvedValue(null);

      const res = await getPersonalNotes();
      expect(res.success).toBe(false);
      expect(res.error).toContain("signed in");
    });

    it("strictly isolates personal notes so user2 cannot see or edit user1's notes", async () => {
      // User 1 creates note
      vi.spyOn(authModule, "getSession").mockResolvedValue(user1 as unknown as JWTPayload);
      const note1 = await createPersonalNote({
        title: "User 1 Secret",
        content: "Confidential sales figures.",
        pinned: false,
      });
      if (note1.data?.id) createdNoteIds.push(note1.data.id);

      // User 2 fetches notes
      vi.spyOn(authModule, "getSession").mockResolvedValue(user2 as unknown as JWTPayload);
      const user2Notes = await getPersonalNotes();
      expect(user2Notes.success).toBe(true);
      const hasUser1Note = user2Notes.data?.some((n: { id: string }) => n.id === note1.data?.id);
      expect(hasUser1Note).toBe(false);

      // User 2 attempts to edit User 1's note
      const hackAttempt = await updatePersonalNote(note1.data!.id, { content: "Hacked!" });
      expect(hackAttempt.success).toBe(false);
      expect(hackAttempt.error).toContain("permission");

      // User 2 attempts to delete User 1's note
      const deleteAttempt = await deletePersonalNote(note1.data!.id);
      expect(deleteAttempt.success).toBe(false);
      expect(deleteAttempt.error).toContain("permission");
    });

    it("toggles note pinning and updates note content properly", async () => {
      vi.spyOn(authModule, "getSession").mockResolvedValue(user1 as unknown as JWTPayload);
      const note = await createPersonalNote({
        title: "Initial Title",
        content: "Initial Content",
        pinned: false,
      });
      const noteId = note.data!.id;
      createdNoteIds.push(noteId);

      const pinRes = await togglePersonalNotePinned(noteId, true);
      expect(pinRes.success).toBe(true);
      expect(pinRes.data?.pinned).toBe(true);

      const updateRes = await updatePersonalNote(noteId, {
        title: "Updated Title",
        content: "Updated Content",
      });
      expect(updateRes.success).toBe(true);
      expect(updateRes.data?.title).toBe("Updated Title");
      expect(updateRes.data?.content).toBe("Updated Content");
    });

    it("searches personal notes case-insensitively for current user", async () => {
      vi.spyOn(authModule, "getSession").mockResolvedValue(user1 as unknown as JWTPayload);
      const searchRes = await searchPersonalNotes("strategy");
      expect(searchRes.success).toBe(true);
      expect(searchRes.data?.length).toBeGreaterThan(0);
      expect(searchRes.data![0].content).toContain("Meta lead capture");
    });
  });

  // ==========================================
  // 2. Personal Notes AI Transformations
  // ==========================================
  describe("2. Personal Notes AI Transformations (Preview Only)", () => {
    it("generates cleanup preview without modifying database note", async () => {
      vi.spyOn(authModule, "getSession").mockResolvedValue(user1 as unknown as JWTPayload);
      const groqSpy = vi.spyOn(groqModule, "requestGroqText").mockResolvedValue({
        text: "Cleaned note with corrected punctuation and syntax.",
      });

      const res = await cleanPersonalNote("rough text without punctuatn");
      expect(res.success).toBe(true);
      expect(res.data).toBe("Cleaned note with corrected punctuation and syntax.");
      expect(groqSpy).toHaveBeenCalled();
    });

    it("generates organize, rewrite, and summarize previews", async () => {
      vi.spyOn(authModule, "getSession").mockResolvedValue(user1 as unknown as JWTPayload);

      vi.spyOn(groqModule, "requestGroqText").mockResolvedValueOnce({
        text: "### Organized Structure\n- Action Item 1\n- Action Item 2",
      });
      const orgRes = await organizePersonalNote("action item 1 action item 2");
      expect(orgRes.success).toBe(true);
      expect(orgRes.data).toContain("### Organized Structure");

      vi.spyOn(groqModule, "requestGroqText").mockResolvedValueOnce({
        text: "Professional and concise rewrite.",
      });
      const rewriteRes = await rewritePersonalNoteClearly("messy text");
      expect(rewriteRes.success).toBe(true);
      expect(rewriteRes.data).toBe("Professional and concise rewrite.");

      vi.spyOn(groqModule, "requestGroqText").mockResolvedValueOnce({
        text: "**Summary**: High level takeaway.",
      });
      const sumRes = await summarizePersonalNote("long text description");
      expect(sumRes.success).toBe(true);
      expect(sumRes.data).toContain("**Summary**");
    });
  });

  // ==========================================
  // 3. Meta Webhook Security & Verification
  // ==========================================
  describe("3. Meta Webhook Verification & HMAC Signature Security", () => {
    it("verifies webhook GET challenge with valid verify token", async () => {
      const url = `http://localhost/api/meta/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=test_challenge_token_12345`;
      const req = new NextRequest(url);

      const res = await GET(req);
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toBe("test_challenge_token_12345");
    });

    it("rejects webhook GET challenge with invalid verify token with 403", async () => {
      const url = `http://localhost/api/meta/webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test_challenge_token_12345`;
      const req = new NextRequest(url);

      const res = await GET(req);
      expect(res.status).toBe(403);
    });

    it("rejects webhook POST with invalid signature with 401", async () => {
      const body = JSON.stringify({ object: "page", entry: [] });
      const req = new NextRequest("http://localhost/api/meta/webhook", {
        method: "POST",
        body,
        headers: {
          "x-hub-signature-256": "sha256=invalid_hash",
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Invalid webhook signature");
    });

    it("accepts webhook POST with valid HMAC SHA-256 signature", async () => {
      const payload = {
        object: "page",
        entry: [
          {
            id: "page-1",
            time: 1726000000,
            changes: [],
          },
        ],
      };
      const rawBody = JSON.stringify(payload);
      const hmac = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
      const signature = `sha256=${hmac}`;

      const req = new NextRequest("http://localhost/api/meta/webhook", {
        method: "POST",
        body: rawBody,
        headers: {
          "x-hub-signature-256": signature,
          "Content-Type": "application/json",
        },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.received).toBe(true);
    });
  });

  // ==========================================
  // 4. Meta Normalization, Ingestion, Duplicate Detection & Idempotency
  // ==========================================
  describe("4. Meta Field Normalization & Duplicate Detection", () => {
    it("normalizes Meta form field data accurately", () => {
      const raw: MetaLeadRawResponse = {
        id: "test-meta-lead-raw-1",
        created_time: "2026-09-15T12:00:00+0000",
        form_id: "form-phase10",
        page_id: "page-phase10",
        campaign_name: "Fall 2026 Conversion",
        ad_name: "Demo Booking Lead Ad",
        field_data: [
          { name: "full_name", values: ["Vikramaditya Rao"] },
          { name: "phone_number", values: ["+91 97777 66666"] },
          { name: "email", values: ["vikram.rao@enterprise.in"] },
          { name: "company_name", values: ["Rao Innovations"] },
          { name: "industry", values: ["Manufacturing"] },
          { name: "budget", values: ["3 Lakhs"] },
          { name: "team_size", values: ["25-50"] },
        ],
      };

      const norm = normalizeMetaLeadPayload(raw);
      expect(norm.name).toBe("Vikramaditya Rao");
      expect(norm.phone).toBe("+91 97777 66666");
      expect(norm.email).toBe("vikram.rao@enterprise.in");
      expect(norm.business).toBe("Rao Innovations");
      expect(norm.industry).toBe("Manufacturing");
      expect(norm.budget).toBe(300000);
      expect(norm.notes).toContain("Fall 2026 Conversion");
      expect(norm.notes).toContain("team_size: 25-50");
    });

    it("creates a new CRM lead from fresh Meta submission and records receipt in DB", async () => {
      const rawLead: MetaLeadRawResponse = {
        id: "test-meta-lead-new-1",
        created_time: "2026-09-15T10:00:00Z",
        form_id: "form-new-meta",
        field_data: [
          { name: "full_name", values: ["Fresh Meta Lead"] },
          { name: "phone_number", values: ["+91 96666 55555"] },
          { name: "email", values: ["fresh.meta@example.com"] },
          { name: "company_name", values: ["Fresh Dynamics"] },
          { name: "budget", values: ["75000"] },
        ],
      };

      const res = await processMetaLead("test-meta-lead-new-1", { preloadedRaw: rawLead });
      expect(res.success).toBe(true);
      expect(res.status).toBe("PROCESSED");
      expect(res.leadId).toBeDefined();
      expect(res.isDuplicate).toBe(false);

      if (res.leadId) createdLeadIds.push(res.leadId);
      if (res.receiptId) createdReceiptIds.push(res.receiptId);

      // Verify Lead in DB
      const dbLead = await db.lead.findUnique({
        where: { id: res.leadId },
        include: { activities: true, aiInsight: true },
      });
      expect(dbLead).toBeDefined();
      expect(dbLead?.name).toBe("Fresh Meta Lead");
      expect(dbLead?.status).toBe("NEW");
      expect(dbLead?.activities.length).toBeGreaterThan(0);
    });

    it("guarantees idempotency: repeated delivery returns existing result without duplicating", async () => {
      const rawLead: MetaLeadRawResponse = {
        id: "test-meta-lead-new-1", // Same ID as previous test
        created_time: "2026-09-15T10:00:00Z",
        field_data: [
          { name: "full_name", values: ["Fresh Meta Lead"] },
          { name: "phone_number", values: ["+91 96666 55555"] },
        ],
      };

      const res = await processMetaLead("test-meta-lead-new-1", { preloadedRaw: rawLead });
      expect(res.success).toBe(true);
      expect(res.isDuplicate).toBe(true);
      expect(res.status).toBe("PROCESSED");
    });

    it("detects existing lead by normalized phone and updates non-destructively", async () => {
      // Create existing lead in CRM with same phone
      const initialLead = await db.lead.create({
        data: {
          name: "Original Phone Contact",
          phone: "+91 95555 44444",
          email: null, // missing email
          business: null,
          status: "CONTACTED",
          notes: "Spoke at conference.",
        },
      });
      createdLeadIds.push(initialLead.id);

      const rawLead: MetaLeadRawResponse = {
        id: "test-meta-lead-dup-phone",
        created_time: "2026-09-15T10:00:00Z",
        form_id: "form-retargeting",
        field_data: [
          { name: "full_name", values: ["Original Phone Contact"] },
          { name: "phone_number", values: ["+91 95555 44444"] },
          { name: "email", values: ["contact@newbusiness.com"] },
          { name: "company_name", values: ["Acme Corp"] },
        ],
      };

      const res = await processMetaLead("test-meta-lead-dup-phone", { preloadedRaw: rawLead });
      expect(res.success).toBe(true);
      expect(res.status).toBe("DUPLICATE_UPDATED");
      expect(res.leadId).toBe(initialLead.id);
      expect(res.isDuplicate).toBe(true);
      if (res.receiptId) createdReceiptIds.push(res.receiptId);

      // Verify DB Lead was merged without losing status or original notes
      const updated = await db.lead.findUnique({ where: { id: initialLead.id } });
      expect(updated?.email).toBe("contact@newbusiness.com");
      expect(updated?.business).toBe("Acme Corp");
      expect(updated?.status).toBe("CONTACTED"); // preserved
      expect(updated?.notes).toContain("Spoke at conference.");
      expect(updated?.notes).toContain("Meta Ad Update");
    });

    it("handles Graph API network failures gracefully and records FAILED receipt", async () => {
      vi.spyOn(graphClientModule, "fetchMetaLeadDetails").mockRejectedValue(
        new Error("Meta API rate limit reached.")
      );

      const res = await processMetaLead("test-meta-lead-failing-id");
      expect(res.success).toBe(false);
      expect(res.status).toBe("FAILED");
      expect(res.error).toContain("rate limit");
      if (res.receiptId) createdReceiptIds.push(res.receiptId);

      // Verify receipt in DB
      const receipt = await db.metaLeadReceipt.findUnique({
        where: { metaLeadId: "test-meta-lead-failing-id" },
      });
      expect(receipt).toBeDefined();
      expect(receipt?.status).toBe("FAILED");
      expect(receipt?.errorMessage).toContain("rate limit");
    });

    it("retries a failed receipt successfully upon authentication", async () => {
      vi.spyOn(authModule, "getSession").mockResolvedValue(user1 as unknown as JWTPayload);

      // Find the failing receipt
      const receipt = await db.metaLeadReceipt.findUnique({
        where: { metaLeadId: "test-meta-lead-failing-id" },
      });
      expect(receipt).toBeDefined();

      // Now mock successful graph client
      vi.spyOn(graphClientModule, "fetchMetaLeadDetails").mockResolvedValue({
        id: "test-meta-lead-failing-id",
        created_time: "2026-09-15T10:00:00Z",
        field_data: [
          { name: "full_name", values: ["Recovered Lead"] },
          { name: "phone_number", values: ["+91 94444 33333"] },
        ],
      });

      const retryRes = await retryMetaLeadReceipt(receipt!.id);
      expect(retryRes.success).toBe(true);
      expect(retryRes.status).toBe("PROCESSED");
      if (retryRes.leadId) createdLeadIds.push(retryRes.leadId);
    });

    it("returns sanitized Meta connection status without leaking credentials", async () => {
      vi.spyOn(authModule, "getSession").mockResolvedValue(user1 as unknown as JWTPayload);

      const statusRes = await getMetaConnectionStatus();
      expect(statusRes.success).toBe(true);
      expect(statusRes.data).toBeDefined();
      expect(statusRes.data?.isConfigured).toBe(true);
      expect(statusRes.data?.graphApiVersion).toBe("v21.0");
      expect(statusRes.data?.totalReceipts).toBeGreaterThan(0);
      expect(statusRes.data?.processedCount).toBeGreaterThan(0);
      // Verify no secrets leaked
      expect((statusRes.data as unknown as Record<string, unknown>).pageAccessToken).toBeUndefined();
      expect((statusRes.data as unknown as Record<string, unknown>).appSecret).toBeUndefined();
      expect((statusRes.data as unknown as Record<string, unknown>).verifyToken).toBeUndefined();
    });
  });

  // ==========================================
  // 5. Demo Data Management Utility
  // ==========================================
  describe("5. Demo Data Management Utility", () => {
    it("seeds 10 demo leads covering all CRM stages with valid models and [DEMO] prefix", async () => {
      vi.spyOn(authModule, "getSession").mockResolvedValue(user1 as unknown as JWTPayload);

      const seedRes = await populateDemoDataAction();
      expect(seedRes.success).toBe(true);
      expect(seedRes.createdCount).toBe(10);

      // Verify demo leads in DB
      const demoLeads = await db.lead.findMany({
        where: { name: { startsWith: DEMO_TAG } },
        include: { followUps: true, lossEvents: true, aiInsight: true },
      });

      expect(demoLeads.length).toBe(10);

      // Check LOST status has valid LeadLossEvent
      const lostLead = demoLeads.find((l) => l.status === "LOST");
      expect(lostLead).toBeDefined();
      expect(lostLead?.lossEvents.length).toBeGreaterThan(0);
      expect(lostLead?.lossEvents[0].reason).toBe("PRICE");

      // Check WON and PROPOSAL_SENT
      expect(demoLeads.find((l) => l.status === "WON")).toBeDefined();
      expect(demoLeads.find((l) => l.status === "PROPOSAL_SENT")).toBeDefined();
    });

    it("clears demo leads cleanly from database", async () => {
      vi.spyOn(authModule, "getSession").mockResolvedValue(user1 as unknown as JWTPayload);

      const clearRes = await clearDemoDataAction();
      expect(clearRes.success).toBe(true);
      expect(clearRes.deletedCount).toBe(10);

      const remainingDemo = await db.lead.count({
        where: { name: { startsWith: DEMO_TAG } },
      });
      expect(remainingDemo).toBe(0);
    });
  });
});
