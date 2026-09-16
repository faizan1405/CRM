import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
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
import { clearDemoLeads, DEMO_TAG } from "@/features/demo-data/demo-seed";
import { populateDemoDataAction, clearDemoDataAction } from "@/app/actions/demo-data";
import { db } from "@/lib/db";
import * as authModule from "@/lib/auth";
import * as groqModule from "@/lib/ai/groq-client";
import type { JWTPayload } from "jose";

describe("Phase 10: Personal Notes & Demo System Hardening", () => {
  const user1 = { id: "test-p10-user-1", email: "p10-user1@example.com" };
  const user2 = { id: "test-p10-user-2", email: "p10-user2@example.com" };

  const createdNoteIds: string[] = [];
  const createdLeadIds: string[] = [];

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
  });

  afterAll(async () => {
    if (createdNoteIds.length > 0) {
      await db.personalNote.deleteMany({ where: { id: { in: createdNoteIds } } });
    }
    if (createdLeadIds.length > 0) {
      await db.salesNotification.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadLossEvent.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.followUp.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadActivity.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.leadAIInsight.deleteMany({ where: { leadId: { in: createdLeadIds } } });
      await db.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
    }
    await clearDemoLeads();
    await db.personalNote.deleteMany({ where: { userId: { in: [user1.id, user2.id] } } });
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authModule, "getSession").mockResolvedValue(user1 as unknown as JWTPayload);
  });

  // ==========================================
  // 1. Personal Notes CRUD & Ownership Isolation
  // ==========================================
  describe("1. Personal Notes CRUD & Security Isolation", () => {
    it("creates a personal note for authenticated user", async () => {
      const res = await createPersonalNote({
        title: "Q4 Strategy Brainstorm",
        content: "Expand outreach campaigns in Mumbai and Delhi.",
        pinned: true,
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.title).toBe("Q4 Strategy Brainstorm");
      expect(res.data?.content).toBe("Expand outreach campaigns in Mumbai and Delhi.");
      expect(res.data?.isPinned).toBe(true);
      expect(res.data?.userId).toBe(user1.id);

      if (res.data?.id) createdNoteIds.push(res.data.id);
    });

    it("fetches notes strictly isolated to the authenticated user", async () => {
      const note = await db.personalNote.create({
        data: {
          userId: user1.id,
          title: "User 1 Private Note",
          content: "Confidential sales thoughts",
        },
      });
      createdNoteIds.push(note.id);

      const res1 = await getPersonalNotes();
      expect(res1.success).toBe(true);
      expect(res1.data?.some((n) => n.id === note.id)).toBe(true);

      // User 2 cannot see User 1's notes
      vi.spyOn(authModule, "getSession").mockResolvedValue(user2 as unknown as JWTPayload);
      const res2 = await getPersonalNotes();
      expect(res2.success).toBe(true);
      expect(res2.data?.some((n) => n.id === note.id)).toBe(false);
    });

    it("prevents unauthorized user from modifying another user's note", async () => {
      const note = await db.personalNote.create({
        data: {
          userId: user1.id,
          title: "User 1 Note",
          content: "Original Content",
        },
      });
      createdNoteIds.push(note.id);

      vi.spyOn(authModule, "getSession").mockResolvedValue(user2 as unknown as JWTPayload);
      const res = await updatePersonalNote(note.id, {
        title: "Hacked Title",
        content: "Malicious modification attempt",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/permission/i);
    });

    it("allows owner to update note title and content", async () => {
      const note = await db.personalNote.create({
        data: {
          userId: user1.id,
          title: "Draft Note",
          content: "Initial text",
        },
      });
      createdNoteIds.push(note.id);

      const res = await updatePersonalNote(note.id, {
        title: "Q4 Strategy (Revised)",
        content: "Focus heavily on real estate and healthcare verticals.",
      });

      expect(res.success).toBe(true);
      expect(res.data?.title).toBe("Q4 Strategy (Revised)");
      expect(res.data?.content).toBe("Focus heavily on real estate and healthcare verticals.");
    });

    it("toggles pin status correctly", async () => {
      const note = await db.personalNote.create({
        data: {
          userId: user1.id,
          title: "Pin Test",
          content: "Pin content",
          isPinned: true,
        },
      });
      createdNoteIds.push(note.id);

      const unpinRes = await togglePersonalNotePinned(note.id, false);
      expect(unpinRes.success).toBe(true);
      expect(unpinRes.data?.isPinned).toBe(false);

      const pinRes = await togglePersonalNotePinned(note.id, true);
      expect(pinRes.success).toBe(true);
      expect(pinRes.data?.isPinned).toBe(true);
    });

    it("searches personal notes by title and content keyword", async () => {
      const note = await db.personalNote.create({
        data: {
          userId: user1.id,
          title: "Medical Outreach Plan",
          content: "Focus heavily on real estate and healthcare verticals.",
        },
      });
      createdNoteIds.push(note.id);

      const searchRes = await searchPersonalNotes("healthcare");
      expect(searchRes.success).toBe(true);
      expect(searchRes.data?.length).toBeGreaterThan(0);
      expect(searchRes.data?.some((n) => n.id === note.id)).toBe(true);

      const noMatchRes = await searchPersonalNotes("xyznonexistentterm999");
      expect(noMatchRes.success).toBe(true);
      expect(noMatchRes.data?.length).toBe(0);
    });

    it("prevents unauthorized deletion and allows owner deletion", async () => {
      const note = await db.personalNote.create({
        data: {
          userId: user1.id,
          title: "Delete Target",
          content: "Delete content",
        },
      });
      createdNoteIds.push(note.id);

      // User 2 cannot delete
      vi.spyOn(authModule, "getSession").mockResolvedValue(user2 as unknown as JWTPayload);
      const failRes = await deletePersonalNote(note.id);
      expect(failRes.success).toBe(false);

      // User 1 can delete
      vi.spyOn(authModule, "getSession").mockResolvedValue(user1 as unknown as JWTPayload);
      const successRes = await deletePersonalNote(note.id);
      expect(successRes.success).toBe(true);

      const checkDb = await db.personalNote.findUnique({ where: { id: note.id } });
      expect(checkDb).toBeNull();
    });
  });

  // ==========================================
  // 2. Personal Notes AI Assistant Transformations
  // ==========================================
  describe("2. Personal Notes AI Groq Transformations", () => {
    const sampleRaw = "call rakesh tmrw 11am ask abt budget 18k if budget issue suggest starter plan check campaign first";

    it("cleans up rough sales notes with formatting", async () => {
      vi.spyOn(groqModule, "requestGroqText").mockResolvedValue({
        text: "• Call Rakesh tomorrow at 11:00 AM\n• Inquire regarding budget (₹18,000)\n• If budget is an issue, propose Starter Plan\n• Review campaign performance before the call",
      });

      const res = await cleanPersonalNote(sampleRaw);
      expect(res.success).toBe(true);
      expect(res.data).toContain("Call Rakesh tomorrow");
      expect(res.data).toContain("Starter Plan");
    });

    it("organizes note into structured action items", async () => {
      vi.spyOn(groqModule, "requestGroqText").mockResolvedValue({
        text: "📌 Action Items:\n• Call Rakesh at 11:00 AM\n• Review ad campaign metrics\n\n🎯 Strategy:\n• Offer starter plan (₹18k) if budget constrained",
      });

      const res = await organizePersonalNote(sampleRaw);
      expect(res.success).toBe(true);
      expect(res.data).toContain("Action Items");
    });

    it("rewrites note clearly into professional prose", async () => {
      vi.spyOn(groqModule, "requestGroqText").mockResolvedValue({
        text: "Schedule a follow-up call with Rakesh tomorrow at 11:00 AM to review budget requirements. If pricing is a concern, offer the ₹18,000 starter package after checking recent campaign performance.",
      });

      const res = await rewritePersonalNoteClearly(sampleRaw);
      expect(res.success).toBe(true);
      expect(res.data).toContain("Schedule a follow-up call");
    });

    it("summarizes key takeaways succinctly", async () => {
      vi.spyOn(groqModule, "requestGroqText").mockResolvedValue({
        text: "Follow-up call with Rakesh scheduled tomorrow at 11 AM; contingency pricing available via starter package.",
      });

      const res = await summarizePersonalNote(sampleRaw);
      expect(res.success).toBe(true);
      expect(res.data).toContain("Follow-up call with Rakesh");
    });

    it("reports AI service failures without changing the original persisted note", async () => {
      const note = await db.personalNote.create({
        data: { userId: user1.id, title: "AI failure preservation", content: sampleRaw },
      });
      createdNoteIds.push(note.id);
      vi.spyOn(groqModule, "requestGroqText").mockRejectedValue(new Error("Groq API rate limit or outage"));

      const res = await cleanPersonalNote(sampleRaw);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Groq API rate limit or outage");
      expect(res.data).toBeUndefined();
      expect((await db.personalNote.findUnique({ where: { id: note.id } }))?.content).toBe(sampleRaw);
    });
  });

  // ==========================================
  // 3. Demo Data Management & Isolation
  // ==========================================
  describe("3. Demo Data Management & Isolation", () => {
    it("preserves non-demo leads with colliding phones or demo-like email addresses", async () => {
      for (const data of [
        { name: "Non-demo collision fixture", phone: "+91 98111 22334", email: "collision@example.com" },
        { name: "Non-demo email fixture", phone: "9999911222", email: "real.demo@example.com" },
      ]) {
        const lead = await db.lead.create({ data });
        createdLeadIds.push(lead.id);
      }
      expect((await populateDemoDataAction()).success).toBe(true);
      expect((await clearDemoDataAction()).success).toBe(true);
      expect(await db.lead.count({ where: { id: { in: createdLeadIds } } })).toBe(2);
    });
    it("seeds realistic demo leads with insights, followups, and loss events", async () => {
      const res = await populateDemoDataAction();
      expect(res.success).toBe(true);

      const demoLeads = await db.lead.findMany({
        where: { name: { startsWith: DEMO_TAG } },
        include: { aiInsight: true, followUps: true, lossEvents: true },
      });

      expect(demoLeads.length).toBe(10);
      expect(demoLeads.some((l) => l.aiInsight !== null)).toBe(true);
      expect(demoLeads.some((l) => l.followUps.length > 0)).toBe(true);
      expect(demoLeads.some((l) => l.lossEvents.length > 0)).toBe(true);
    });

    it("clears demo leads without deleting real production records", async () => {
      // Create a genuine non-demo lead
      const realLead = await db.lead.create({
        data: {
          name: "Real VIP Client Corp",
          phone: "+91 99999 11111",
          email: "real.vip@company.com",
          status: "QUALIFIED",
          budget: 250000,
        },
      });
      createdLeadIds.push(realLead.id);

      // Clear demo leads
      const clearRes = await clearDemoDataAction();
      expect(clearRes.success).toBe(true);

      // Demo leads must be gone
      const remainingDemo = await db.lead.count({
        where: { name: { startsWith: DEMO_TAG } },
      });
      expect(remainingDemo).toBe(0);

      // Real lead must remain untouched
      const realLeadStillExists = await db.lead.findUnique({
        where: { id: realLead.id },
      });
      expect(realLeadStillExists).not.toBeNull();
      expect(realLeadStillExists?.name).toBe("Real VIP Client Corp");
    });
  });

  // ==========================================
  // 4. Security Hardening & Session Protection
  // ==========================================
  describe("4. Security Hardening & Session Protection", () => {
    it("denies unauthenticated calls to personal notes server actions", async () => {
      vi.spyOn(authModule, "getSession").mockResolvedValue(null);

      const getRes = await getPersonalNotes();
      expect(getRes.success).toBe(false);
      expect(getRes.error).toMatch(/signed in/i);

      const createRes = await createPersonalNote({
        title: "Unauthorized Note",
        content: "Should fail",
      });
      expect(createRes.success).toBe(false);
      expect(createRes.error).toMatch(/signed in/i);
    });
  });
});
