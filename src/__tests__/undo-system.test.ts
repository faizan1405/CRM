import { describe, it, expect, afterAll, beforeAll, vi } from "vitest";
import { db } from "@/lib/db";
import { createLead, changeLeadStatus, deleteLead, restoreLead, markLeadWaste, restoreWasteLead, togglePinLead } from "@/app/actions/leads";
import { scheduleLeadFollowUp, markFollowUpComplete, cancelFollowUp } from "@/app/actions/follow-ups";
import { addLeadNote, updateLeadNote, deleteLeadNote } from "@/app/actions/activities";
import { upsertLeadDeal, createOtherClientDeal, deleteDeal, addDealPayment, deleteDealPayment } from "@/app/actions/deals";
import { createPersonalNote, updatePersonalNote, deletePersonalNote } from "@/app/actions/personal-notes";
import { createBulkLeadsAction } from "@/app/actions/ai-lead-entry";
import type { BulkCreateLeadItem } from "@/features/leads/ai-entry-types";
import { performUndo } from "@/app/actions/undo";
import { executeUndo } from "@/features/undo/services/undo-engine";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/leads",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const TEST_USER_ID = "test-undo-user-id";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn().mockResolvedValue({ id: "test-undo-user-id", email: "undo@example.com", role: "ADMIN" }),
}));

describe("Global Undo System", () => {
  const createdLeadIds: string[] = [];
  const createdDealIds: string[] = [];
  const createdNoteIds: string[] = [];

  beforeAll(async () => {
    // Ensure test user exists in DB for foreign key consistency if needed
    const user = await db.user.findUnique({ where: { id: TEST_USER_ID } });
    if (!user) {
      await db.user.create({
        data: {
          id: TEST_USER_ID,
          email: "undo@example.com",
          name: "Undo Test User",
          passwordHash: "dummyhash",
        },
      }).catch(() => {});
    }
  });

  afterAll(async () => {
    // Cleanup
    for (const leadId of createdLeadIds) {
      await db.undoAction.deleteMany({ where: { leadId } }).catch(() => {});
      await db.leadActivity.deleteMany({ where: { leadId } }).catch(() => {});
      await db.followUp.deleteMany({ where: { leadId } }).catch(() => {});
      await db.payment.deleteMany({ where: { deal: { leadId } } }).catch(() => {});
      await db.deal.deleteMany({ where: { leadId } }).catch(() => {});
      await db.lead.deleteMany({ where: { id: leadId } }).catch(() => {});
    }
    for (const dealId of createdDealIds) {
      await db.undoAction.deleteMany({ where: { entityId: dealId } }).catch(() => {});
      await db.payment.deleteMany({ where: { dealId } }).catch(() => {});
      await db.deal.deleteMany({ where: { id: dealId } }).catch(() => {});
    }
    for (const noteId of createdNoteIds) {
      await db.undoAction.deleteMany({ where: { entityId: noteId } }).catch(() => {});
      await db.personalNote.deleteMany({ where: { id: noteId } }).catch(() => {});
    }
  });

  // =========================================================================
  // 1. Status Change + Undo
  // =========================================================================
  it("should record undo on status change and restore previous status on undo", async () => {
    const phone = `+9198${Date.now().toString().slice(-6)}01`;
    const formData = new FormData();
    formData.set("name", "Status Undo Lead");
    formData.set("phone", phone);
    formData.set("status", "New");
    const createRes = await createLead(formData);
    expect(createRes.success).toBe(true);
    if (!createRes.success) return;

    const leadId = createRes.data.id;
    createdLeadIds.push(leadId);

    // 1. Change status to Qualified
    const changeRes = await changeLeadStatus(leadId, "Qualified");
    expect(changeRes.success).toBe(true);
    if (!changeRes.success) return;
    expect(changeRes.undoId).toBeDefined();

    const afterChange = await db.lead.findUnique({ where: { id: leadId } });
    expect(afterChange?.status).toBe("QUALIFIED");

    // 2. Perform Undo
    const undoRes = await performUndo(changeRes.undoId!);
    expect(undoRes.success).toBe(true);

    const afterUndo = await db.lead.findUnique({ where: { id: leadId } });
    expect(afterUndo?.status).toBe("NEW");

    // Check activity log recorded undo
    const activities = await db.leadActivity.findMany({ where: { leadId } });
    expect(activities.some(a => (a.type as string) === "LEAD_RESTORED" || a.message.includes("Undid") || a.message.includes("Undo"))).toBe(true);
  });

  // =========================================================================
  // 2. Lead Soft Delete + Undo
  // =========================================================================
  it("should record undo on lead soft delete and restore lead on undo", async () => {
    const phone = `+9198${Date.now().toString().slice(-6)}02`;
    const formData = new FormData();
    formData.set("name", "Delete Undo Lead");
    formData.set("phone", phone);
    const createRes = await createLead(formData);
    expect(createRes.success).toBe(true);
    if (!createRes.success) return;

    const leadId = createRes.data.id;
    createdLeadIds.push(leadId);

    // 1. Delete lead
    const deleteRes = await deleteLead(leadId);
    expect(deleteRes.success).toBe(true);
    if (!deleteRes.success) return;
    expect(deleteRes.undoId).toBeDefined();

    const deleted = await db.lead.findUnique({ where: { id: leadId } });
    expect(deleted?.deletedAt).not.toBeNull();

    // 2. Undo delete
    const undoRes = await performUndo(deleteRes.undoId!);
    expect(undoRes.success).toBe(true);

    const restored = await db.lead.findUnique({ where: { id: leadId } });
    expect(restored?.deletedAt).toBeNull();
  });

  // =========================================================================
  // 3. Reschedule Follow-up + Undo & Single-active-follow-up Invariant
  // =========================================================================
  it("should reschedule follow-up, enforce single active pending follow-up invariant, and restore on undo", async () => {
    const phone = `+9198${Date.now().toString().slice(-6)}03`;
    const formData = new FormData();
    formData.set("name", "Followup Invariant Lead");
    formData.set("phone", phone);
    const createRes = await createLead(formData);
    expect(createRes.success).toBe(true);
    if (!createRes.success) return;

    const leadId = createRes.data.id;
    createdLeadIds.push(leadId);

    // Initial follow-up F1 for tomorrow
    const fu1Form = new FormData();
    fu1Form.set("leadId", leadId);
    fu1Form.set("scheduledAt", "2026-10-01T10:00:00.000Z");
    fu1Form.set("type", "Call");
    fu1Form.set("note", "Initial follow-up call");

    const fu1Res = await scheduleLeadFollowUp(fu1Form);
    expect(fu1Res.success).toBe(true);
    if (!fu1Res.success) return;

    const f1Id = fu1Res.data.id;

    // Reschedule: schedule follow-up F2 for next week (replaces F1)
    const fu2Form = new FormData();
    fu2Form.set("leadId", leadId);
    fu2Form.set("id", f1Id);
    fu2Form.set("scheduledAt", "2026-10-10T14:00:00.000Z");
    fu2Form.set("type", "WhatsApp");
    fu2Form.set("note", "Rescheduled follow-up");

    const fu2Res = await scheduleLeadFollowUp(fu2Form);
    expect(fu2Res.success).toBe(true);
    if (!fu2Res.success) return;
    expect(fu2Res.undoId).toBeDefined();

    // Invariant verification: At all times, exactly ONE pending follow-up exists
    const pendingFollowUps = await db.followUp.findMany({
      where: { leadId, status: "PENDING" },
    });
    expect(pendingFollowUps.length).toBe(1);
    expect(pendingFollowUps[0].type).toBe("WHATSAPP");

    // Perform Undo
    const undoRes = await performUndo(fu2Res.undoId!);
    expect(undoRes.success).toBe(true);

    // Verify after undo: single pending follow-up restored to F1 scheduledAt & Call
    const restoredPending = await db.followUp.findMany({
      where: { leadId, status: "PENDING" },
    });
    expect(restoredPending.length).toBe(1);
    expect(restoredPending[0].type).toBe("CALL");
    expect(new Date(restoredPending[0].scheduledAt).toISOString()).toBe("2026-10-01T10:00:00.000Z");
  });

  // =========================================================================
  // 4. Note Mutation (Add / Edit / Delete) + Undo
  // =========================================================================
  it("should record undo on adding, editing, and deleting notes and restore them accurately", async () => {
    const phone = `+9198${Date.now().toString().slice(-6)}04`;
    const formData = new FormData();
    formData.set("name", "Note Mutation Lead");
    formData.set("phone", phone);
    const createRes = await createLead(formData);
    expect(createRes.success).toBe(true);
    if (!createRes.success) return;

    const leadId = createRes.data.id;
    createdLeadIds.push(leadId);

    // 1. Add Note
    const addRes = await addLeadNote(leadId, "Customer wants custom CRM deployment");
    expect(addRes.success).toBe(true);
    if (!addRes.success) return;
    expect(addRes.undoId).toBeDefined();

    const noteActivityId = addRes.data.id;

    // 2. Undo Add Note -> note should be removed
    const undoAdd = await performUndo(addRes.undoId!);
    expect(undoAdd.success).toBe(true);

    const checkNote1 = await db.leadActivity.findUnique({ where: { id: noteActivityId } });
    expect(checkNote1).toBeNull();

    // 3. Add note again for update/delete testing
    const addAgain = await addLeadNote(leadId, "Original note text");
    expect(addAgain.success).toBe(true);
    if (!addAgain.success) return;
    const noteId2 = addAgain.data.id;

    // 4. Update Note
    const updateRes = await updateLeadNote(noteId2, "Updated note text with extra details");
    expect(updateRes.success).toBe(true);
    if (!updateRes.success) return;
    expect(updateRes.undoId).toBeDefined();

    const afterUpdate = await db.leadActivity.findUnique({ where: { id: noteId2 } });
    expect(afterUpdate?.message).toBe("Updated note text with extra details");

    // 5. Undo Update Note -> restored to original text
    const undoUpdate = await performUndo(updateRes.undoId!);
    expect(undoUpdate.success).toBe(true);

    const afterUndoUpdate = await db.leadActivity.findUnique({ where: { id: noteId2 } });
    expect(afterUndoUpdate?.message).toBe("Original note text");

    // 6. Delete Note
    const deleteRes = await deleteLeadNote(noteId2);
    expect(deleteRes.success).toBe(true);
    if (!deleteRes.success) return;
    expect(deleteRes.undoId).toBeDefined();

    const checkDeleted = await db.leadActivity.findUnique({ where: { id: noteId2 } });
    expect(checkDeleted).toBeNull();

    // 7. Undo Delete Note -> note restored with original ID and content
    const undoDelete = await performUndo(deleteRes.undoId!);
    expect(undoDelete.success).toBe(true);

    const restoredNote = await db.leadActivity.findUnique({ where: { id: noteId2 } });
    expect(restoredNote).not.toBeNull();
    expect(restoredNote?.message).toBe("Original note text");
  });

  // =========================================================================
  // 5. Concurrency Guard: Block Unsafe Undo If Modified Afterward
  // =========================================================================
  it("should fail gracefully with concurrency message if entity was modified after the action", async () => {
    const phone = `+9198${Date.now().toString().slice(-6)}05`;
    const formData = new FormData();
    formData.set("name", "Concurrency Guard Lead");
    formData.set("phone", phone);
    formData.set("status", "New");
    const createRes = await createLead(formData);
    expect(createRes.success).toBe(true);
    if (!createRes.success) return;

    const leadId = createRes.data.id;
    createdLeadIds.push(leadId);

    // Action 1: Change status from New to Contacted
    const action1 = await changeLeadStatus(leadId, "Contacted");
    expect(action1.success).toBe(true);
    if (!action1.success) return;
    const undoId1 = action1.undoId!;

    // Action 2: Subsequence modification (User edited name and status to Qualified)
    // Wait a brief tick to ensure distinct timestamp
    await new Promise(r => setTimeout(r, 50));
    await db.lead.update({
      where: { id: leadId },
      data: {
        status: "QUALIFIED",
        name: "Concurrency Lead (Updated Name)",
        updatedAt: new Date(Date.now() + 5000), // definitely newer timestamp
      },
    });

    // Attempting to undo Action 1 should fail due to newer state
    const undoRes = await performUndo(undoId1);
    expect(undoRes.success).toBe(false);
    expect(undoRes.error).toContain("Unable to undo because this record was changed afterward");

    // Verify the newer status was NOT overwritten
    const currentLead = await db.lead.findUnique({ where: { id: leadId } });
    expect(currentLead?.status).toBe("QUALIFIED");
    expect(currentLead?.name).toBe("Concurrency Lead (Updated Name)");
  });

  // =========================================================================
  // 6. Double-Undo Guard (Cannot Undo Same Action Twice)
  // =========================================================================
  it("should prevent double-undoing the same action", async () => {
    const phone = `+9198${Date.now().toString().slice(-6)}06`;
    const formData = new FormData();
    formData.set("name", "Double Undo Lead");
    formData.set("phone", phone);
    const createRes = await createLead(formData);
    expect(createRes.success).toBe(true);
    if (!createRes.success) return;

    const leadId = createRes.data.id;
    createdLeadIds.push(leadId);

    const pinRes = await togglePinLead(leadId, true);
    expect(pinRes.success).toBe(true);
    if (!pinRes.success) return;
    const undoId = pinRes.undoId!;

    // First undo: should succeed
    const undo1 = await performUndo(undoId);
    expect(undo1.success).toBe(true);

    // Second undo of same undoId: should fail
    const undo2 = await performUndo(undoId);
    expect(undo2.success).toBe(false);
    expect(undo2.error).toContain("already been undone");
  });

  // =========================================================================
  // 7. Financial Mutation Safety (Payments & Deals) + Undo
  // =========================================================================
  it("should record undo for deal payments and preserve financial integrity with exact IDs", async () => {
    // Create Other Client Deal
    const dealRes = await createOtherClientDeal({
      clientName: "Alpha Corporation",
      finalAmount: 100000,
      currency: "INR",
      notes: "CRM enterprise setup contract",
    });
    expect(dealRes.success).toBe(true);
    if (!dealRes.success) return;

    const dealId = dealRes.data.id;
    createdDealIds.push(dealId);

    // 1. Record Payment 1: ₹30,000
    const pay1 = await addDealPayment({
      dealId,
      amount: 30000,
      type: "PARTIAL",
      method: "BANK_TRANSFER",
      note: "First installment",
    });
    expect(pay1.success).toBe(true);
    if (!pay1.success) return;

    const paymentId = pay1.data.id;

    // Check payment exists
    const storedPay = await db.payment.findUnique({ where: { id: paymentId } });
    expect(storedPay).not.toBeNull();
    expect(Number(storedPay?.amount)).toBe(30000);

    // 2. Undo Payment 1 -> Payment deleted
    const undoPay = await performUndo(pay1.undoId!);
    expect(undoPay.success).toBe(true);

    const afterUndoPay = await db.payment.findUnique({ where: { id: paymentId } });
    expect(afterUndoPay).toBeNull();

    // 3. Record Payment 2: ₹50,000 and then Delete Payment
    const pay2 = await addDealPayment({
      dealId,
      amount: 50000,
      type: "PARTIAL",
      method: "UPI",
    });
    expect(pay2.success).toBe(true);
    if (!pay2.success || !pay2.data) return;
    const pay2Id = pay2.data.id;

    const delPayRes = await deleteDealPayment(pay2Id);
    expect(delPayRes.success).toBe(true);
    if (!delPayRes.success) return;
    expect(delPayRes.undoId).toBeDefined();

    // 4. Undo Delete Payment -> Payment restored with exact payment ID and amount
    const undoDelPay = await performUndo(delPayRes.undoId!);
    expect(undoDelPay.success).toBe(true);

    const restoredPayment = await db.payment.findUnique({ where: { id: pay2Id } });
    expect(restoredPayment).not.toBeNull();
    expect(restoredPayment?.id).toBe(pay2Id);
    expect(Number(restoredPayment?.amount)).toBe(50000);
  });

  // =========================================================================
  // 8. Personal Notes Mutation + Undo
  // =========================================================================
  it("should record and execute undo for personal notes", async () => {
    const noteRes = await createPersonalNote({
      title: "Strategic Objectives Q4",
      content: "Finalize pipeline conversion metrics and audit undo capabilities.",
      pinned: true,
    });
    expect(noteRes.success).toBe(true);
    if (!noteRes.success || !noteRes.data) return;

    const noteId = noteRes.data.id;
    createdNoteIds.push(noteId);

    // 1. Update Personal Note
    const updateNoteRes = await updatePersonalNote(noteId, {
      title: "Updated Strategic Objectives Q4",
      content: "All objectives met successfully.",
    });
    expect(updateNoteRes.success).toBe(true);
    if (!updateNoteRes.success) return;
    expect(updateNoteRes.undoId).toBeDefined();

    // 2. Undo Update
    const undoUpdate = await performUndo(updateNoteRes.undoId!);
    expect(undoUpdate.success).toBe(true);

    const restoredNote = await db.personalNote.findUnique({ where: { id: noteId } });
    expect(restoredNote?.title).toBe("Strategic Objectives Q4");
    expect(restoredNote?.content).toBe("Finalize pipeline conversion metrics and audit undo capabilities.");
  });

  // =========================================================================
  // 9. Follow-up Cancellation Undo & Single Active Invariant Safety
  // =========================================================================
  describe("9. Follow-up Cancellation Undo & Invariant Guards", () => {
    it("should cancel follow-up, return undoId, and restore same FollowUp row with original scheduledAt, note, type, and nextFollowUpDate", async () => {
      const phone = `+9198${Date.now().toString().slice(-6)}11`;
      const formData = new FormData();
      formData.set("name", "Followup Cancel Lead");
      formData.set("phone", phone);
      const createRes = await createLead(formData);
      expect(createRes.success).toBe(true);
      if (!createRes.success) return;
      const leadId = createRes.data.id;
      createdLeadIds.push(leadId);

      // Schedule follow-up
      const originalScheduledAt = "2026-11-15T10:00:00.000Z";
      const fuForm = new FormData();
      fuForm.set("leadId", leadId);
      fuForm.set("scheduledAt", originalScheduledAt);
      fuForm.set("type", "Call");
      fuForm.set("note", "Original follow-up note for cancel test");

      const schedRes = await scheduleLeadFollowUp(fuForm);
      expect(schedRes.success).toBe(true);
      if (!schedRes.success) return;
      const fuId = schedRes.data.id;

      // Verify lead.nextFollowUpDate is set
      const leadBeforeCancel = await db.lead.findUnique({ where: { id: leadId } });
      expect(leadBeforeCancel?.nextFollowUpDate).not.toBeNull();

      // 1. cancel returns undoId
      const cancelRes = await cancelFollowUp(fuId);
      expect(cancelRes.success).toBe(true);
      expect(cancelRes.undoId).toBeDefined();

      // Verify followUp is CANCELLED (not deleted!) and Lead.nextFollowUpDate is cleared
      const afterCancelFu = await db.followUp.findUnique({ where: { id: fuId } });
      expect(afterCancelFu?.status).toBe("CANCELLED");
      const leadAfterCancel = await db.lead.findUnique({ where: { id: leadId } });
      expect(leadAfterCancel?.nextFollowUpDate).toBeNull();

      // 2. Undo restores same FollowUp row
      const undoRes = await performUndo(cancelRes.undoId!);
      expect(undoRes.success).toBe(true);

      const restoredFu = await db.followUp.findUnique({ where: { id: fuId } });
      expect(restoredFu?.id).toBe(fuId); // Same FollowUp row preserved!
      expect(restoredFu?.status).toBe("PENDING");

      // 3. original scheduledAt, note, type restored
      expect(new Date(restoredFu!.scheduledAt).toISOString()).toBe(originalScheduledAt);
      expect(restoredFu?.note).toBe("Original follow-up note for cancel test");
      expect(restoredFu?.type).toBe("CALL");

      // 4. nextFollowUpDate restored
      const restoredLead = await db.lead.findUnique({ where: { id: leadId } });
      expect(restoredLead?.nextFollowUpDate).not.toBeNull();

      // 5. no duplicate PENDING follow-up
      const pendingFus = await db.followUp.findMany({
        where: { leadId, status: "PENDING" },
      });
      expect(pendingFus.length).toBe(1);
    });

    it("should safely reject restore if another pending follow-up exists on the lead", async () => {
      const phone = `+9198${Date.now().toString().slice(-6)}12`;
      const formData = new FormData();
      formData.set("name", "Followup Conflict Lead");
      formData.set("phone", phone);
      const createRes = await createLead(formData);
      expect(createRes.success).toBe(true);
      if (!createRes.success) return;
      const leadId = createRes.data.id;
      createdLeadIds.push(leadId);

      // Follow-up 1
      const fu1Form = new FormData();
      fu1Form.set("leadId", leadId);
      fu1Form.set("scheduledAt", "2026-11-20T10:00:00.000Z");
      fu1Form.set("type", "Call");
      fu1Form.set("note", "First follow-up");
      const fu1Res = await scheduleLeadFollowUp(fu1Form);
      expect(fu1Res.success).toBe(true);
      if (!fu1Res.success) return;
      const fu1Id = fu1Res.data.id;

      // Cancel Follow-up 1
      const cancel1 = await cancelFollowUp(fu1Id);
      expect(cancel1.success).toBe(true);
      expect(cancel1.undoId).toBeDefined();

      // Schedule another follow-up 2 (now active PENDING)
      const fu2Form = new FormData();
      fu2Form.set("leadId", leadId);
      fu2Form.set("scheduledAt", "2026-11-25T14:00:00.000Z");
      fu2Form.set("type", "WhatsApp");
      fu2Form.set("note", "Second follow-up created while first was cancelled");
      const fu2Res = await scheduleLeadFollowUp(fu2Form);
      expect(fu2Res.success).toBe(true);
      if (!fu2Res.success) return;

      // Attempt to undo cancellation of follow-up 1 while follow-up 2 is active PENDING
      // Must reject safely with the existing concurrency/invariant message
      const undoCancel1 = await performUndo(cancel1.undoId!);
      expect(undoCancel1.success).toBe(false);
      expect(undoCancel1.error).toContain("Unable to undo because this record was changed afterward");

      // Verify no duplicate pending follow-ups exist: exactly 1 remains
      const pendingFus = await db.followUp.findMany({
        where: { leadId, status: "PENDING" },
      });
      expect(pendingFus.length).toBe(1);
      expect(pendingFus[0].id).toBe(fu2Res.data.id);

      // Follow-up 1 remains CANCELLED
      const checkFu1 = await db.followUp.findUnique({ where: { id: fu1Id } });
      expect(checkFu1?.status).toBe("CANCELLED");
    });
  });

  // =========================================================================
  // 10. Bulk AI Import Batch Undo & Financial/Modification Safety Guards
  // =========================================================================
  describe("10. Bulk AI Import Batch Undo", () => {
    it("should import 3 new leads with ONE batch undoId and reverse all safe created rows without touching unrelated leads", async () => {
      // 0. Pre-existing unrelated lead
      const unrelatedPhone = `+9198${Date.now().toString().slice(-6)}19`;
      const unrelatedForm = new FormData();
      unrelatedForm.set("name", "Unrelated Existing Lead");
      unrelatedForm.set("phone", unrelatedPhone);
      const unrelatedRes = await createLead(unrelatedForm);
      expect(unrelatedRes.success).toBe(true);
      if (!unrelatedRes.success) return;
      const unrelatedId = unrelatedRes.data.id;
      createdLeadIds.push(unrelatedId);

      // 1. 3 new leads imported -> one batch undoId
      const phone1 = `+9198${Date.now().toString().slice(-6)}21`;
      const phone2 = `+9198${Date.now().toString().slice(-6)}22`;
      const phone3 = `+9198${Date.now().toString().slice(-6)}23`;

      const items: BulkCreateLeadItem[] = [
        {
          draft: { name: "Batch Lead 1", phone: phone1, status: "New", notes: "Note 1" },
          action: "CREATE",
        },
        {
          draft: { name: "Batch Lead 2", phone: phone2, status: "Contacted", notes: "Note 2" },
          action: "CREATE",
        },
        {
          draft: { name: "Batch Lead 3", phone: phone3, status: "Qualified", notes: "Note 3" },
          action: "CREATE",
        },
      ];

      const bulkRes = await createBulkLeadsAction(items);
      expect(bulkRes.success).toBe(true);
      expect(bulkRes.summary.created).toBe(3);
      expect(bulkRes.undoId).toBeDefined();

      const batchUndoId = bulkRes.undoId!;
      const batchLeadIds: string[] = [];
      for (const r of bulkRes.results) {
        if (r.leadId) {
          batchLeadIds.push(r.leadId);
          createdLeadIds.push(r.leadId);
        }
      }
      expect(batchLeadIds.length).toBe(3);

      // 2. Undo reverses all safe created rows
      const undoRes = await performUndo(batchUndoId);
      expect(undoRes.success).toBe(true);

      for (const id of batchLeadIds) {
        const lead = await db.lead.findUnique({ where: { id } });
        expect(lead?.deletedAt).not.toBeNull();
      }

      // 3. unrelated leads untouched
      const unrelatedAfter = await db.lead.findUnique({ where: { id: unrelatedId } });
      expect(unrelatedAfter?.deletedAt).toBeNull();
      expect(unrelatedAfter?.name).toBe("Unrelated Existing Lead");
    });

    it("should protect leads with subsequent modifications and financial records while reversing safe rows", async () => {
      const phoneA = `+9198${Date.now().toString().slice(-6)}31`;
      const phoneB = `+9198${Date.now().toString().slice(-6)}32`;
      const phoneC = `+9198${Date.now().toString().slice(-6)}33`;

      const items: BulkCreateLeadItem[] = [
        {
          draft: { name: "Safe Batch Lead", phone: phoneA, status: "New" },
          action: "CREATE",
        },
        {
          draft: { name: "Modified Batch Lead", phone: phoneB, status: "New" },
          action: "CREATE",
        },
        {
          draft: { name: "Financial Batch Lead", phone: phoneC, status: "New" },
          action: "CREATE",
        },
      ];

      const bulkRes = await createBulkLeadsAction(items);
      expect(bulkRes.success).toBe(true);
      expect(bulkRes.summary.created).toBe(3);
      expect(bulkRes.undoId).toBeDefined();

      const safeId = bulkRes.results[0].leadId!;
      const modifiedId = bulkRes.results[1].leadId!;
      const financialId = bulkRes.results[2].leadId!;
      createdLeadIds.push(safeId, modifiedId, financialId);

      // 1. Subsequent modification on Lead B
      await new Promise(r => setTimeout(r, 50));
      await db.lead.update({
        where: { id: modifiedId },
        data: {
          name: "Materially Edited Lead Name",
          status: "QUALIFIED",
          updatedAt: new Date(Date.now() + 5000),
        },
      });

      // 2. Financial record (Deal + Payment) on Lead C
      const deal = await db.deal.create({
        data: {
          leadId: financialId,
          clientNameSnapshot: "Financial Batch Lead",
          finalAmount: 75000,
          currency: "INR",
          status: "CONFIRMED",
        },
      });
      createdDealIds.push(deal.id);

      const payment = await db.payment.create({
        data: {
          dealId: deal.id,
          amount: 25000,
          type: "PARTIAL",
          method: "UPI",
        },
      });

      // 3. Execute Undo on the batch
      const undoRes = await performUndo(bulkRes.undoId!);
      expect(undoRes.success).toBe(true);

      // Check Lead A (safe): reversed / deleted
      const checkA = await db.lead.findUnique({ where: { id: safeId } });
      expect(checkA?.deletedAt).not.toBeNull();

      // Check Lead B (subsequently modified): NOT deleted!
      const checkB = await db.lead.findUnique({ where: { id: modifiedId } });
      expect(checkB?.deletedAt).toBeNull();
      expect(checkB?.name).toBe("Materially Edited Lead Name");
      expect(checkB?.status).toBe("QUALIFIED");

      // Check Lead C (has financial records): NOT deleted, Deal and Payment intact!
      const checkC = await db.lead.findUnique({ where: { id: financialId } });
      expect(checkC?.deletedAt).toBeNull();

      const checkDeal = await db.deal.findUnique({ where: { id: deal.id } });
      expect(checkDeal).not.toBeNull();

      const checkPayment = await db.payment.findUnique({ where: { id: payment.id } });
      expect(checkPayment).not.toBeNull();
      expect(Number(checkPayment?.amount)).toBe(25000);
    });
  });
});
