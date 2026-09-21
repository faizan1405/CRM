import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ActivityType, FollowUpStatus, LeadStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { saveCallOutcome, undoCallOutcome, type CallOutcome } from "@/app/actions/call-outcomes";
import { getFollowUpSuggestion } from "@/lib/follow-up-suggestions";
import { getLead } from "@/app/actions/leads";

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
const userId = "test-call-outcome-transaction-user";
const leads: string[] = [];
let serial = 0;

beforeAll(async () => {
  await db.user.upsert({ where: { id: userId }, update: {}, create: { id: userId, name: "Call outcome tester", email: "call-outcome-transaction@example.com", passwordHash: "test", role: "ADMIN" } });
  vi.mocked(getSession).mockResolvedValue({ id: userId, email: "call-outcome-transaction@example.com", role: "ADMIN" });
});
afterAll(async () => {
  await db.followUp.deleteMany({ where: { leadId: { in: leads } } });
  await db.leadActivity.deleteMany({ where: { leadId: { in: leads } } });
  await db.leadAIInsight.deleteMany({ where: { leadId: { in: leads } } });
  await db.lead.deleteMany({ where: { id: { in: leads } } });
  await db.user.delete({ where: { id: userId } }).catch(() => {});
});
async function lead(status: LeadStatus) {
  const item = await db.lead.create({ data: { name: `Call outcome ${++serial}`, phone: `+9199887${String(serial).padStart(5, "0")}`, business: "Test", status } });
  leads.push(item.id); return item;
}
let operation = 0;
async function save(leadId: string, outcome: CallOutcome, note = "") {
  return saveCallOutcome({ leadId, outcome, note, operationId: `call-test-${++operation}` });
}

describe("atomic call outcomes", () => {
  it("Picked writes call and meaningful note, moves NEW to CONTACTED, and undo restores all", async () => {
    const item = await lead(LeadStatus.NEW);
    const id = `call-test-${operation + 1}`;
    const result = await save(item.id, "PICKED", "Discussed ecommerce website requirement.");
    expect(result.success).toBe(true);
    expect((await db.lead.findUniqueOrThrow({ where: { id: item.id } })).status).toBe(LeadStatus.CONTACTED);
    const activities = await db.leadActivity.findMany({ where: { leadId: item.id } });
    expect(activities.some(a => a.type === ActivityType.LEAD_UPDATED && (a.metadata as { callOutcome?: string })?.callOutcome === "PICKED")).toBe(true);
    expect(activities.some(a => a.type === ActivityType.NOTE_ADDED && a.message === "Discussed ecommerce website requirement.")).toBe(true);
    expect((await db.lead.findUniqueOrThrow({ where: { id: item.id } })).notes).toBe("Discussed ecommerce website requirement.");
    const visible = await getLead(item.id);
    expect(visible.success && visible.data.latestNote).toBe("Discussed ecommerce website requirement.");
    const undo = await undoCallOutcome(item.id, id);
    expect(undo, undo.error).toMatchObject({ success: true });
    expect((await db.lead.findUniqueOrThrow({ where: { id: item.id } })).status).toBe(LeadStatus.NEW);
    expect(await db.leadActivity.count({ where: { leadId: item.id } })).toBe(0);
  });
  it("Picked does not downgrade QUALIFIED", async () => { const item = await lead(LeadStatus.QUALIFIED); expect((await save(item.id, "PICKED")).success).toBe(true); expect((await db.lead.findUniqueOrThrow({ where: { id: item.id } })).status).toBe(LeadStatus.QUALIFIED); });
  it("Not Picked leaves pipeline and follow-up untouched and suggests Tomorrow", async () => { const item = await lead(LeadStatus.NEW); expect((await save(item.id, "NOT_PICKED", "Called twice, no response.")).success).toBe(true); expect((await db.lead.findUniqueOrThrow({ where: { id: item.id } })).status).toBe(LeadStatus.NEW); expect(await db.followUp.count({ where: { leadId: item.id } })).toBe(0); expect(getFollowUpSuggestion("NOT_PICKED").displayDateLabel).toBe("Tomorrow"); });
  it("Interested promotes CONTACTED but preserves PROPOSAL_SENT", async () => { const a = await lead(LeadStatus.CONTACTED); const b = await lead(LeadStatus.PROPOSAL_SENT); expect((await save(a.id, "INTERESTED")).success).toBe(true); expect((await save(b.id, "INTERESTED")).success).toBe(true); expect((await db.lead.findUniqueOrThrow({ where: { id: a.id } })).status).toBe(LeadStatus.QUALIFIED); expect((await db.lead.findUniqueOrThrow({ where: { id: b.id } })).status).toBe(LeadStatus.PROPOSAL_SENT); expect(getFollowUpSuggestion("INTERESTED").displayDateLabel).toBe("+2 Days"); });
  it("Call Back requires exact time, keeps status, and prevents duplicate pending follow-ups", async () => {
    const item = await lead(LeadStatus.QUALIFIED);
    const id = `call-test-${++operation}`;
    expect((await saveCallOutcome({ leadId: item.id, outcome: "CALL_BACK", operationId: id })).success).toBe(false);
    const when = new Date(Date.now() + 86400000).toISOString();
    expect((await saveCallOutcome({ leadId: item.id, outcome: "CALL_BACK", operationId: id, followUp: { choice: "create", scheduledAt: when } })).success).toBe(true);
    expect((await db.lead.findUniqueOrThrow({ where: { id: item.id } })).status).toBe(LeadStatus.QUALIFIED);
    expect(await db.followUp.count({ where: { leadId: item.id, status: FollowUpStatus.PENDING } })).toBe(1);
    expect((await saveCallOutcome({ leadId: item.id, outcome: "CALL_BACK", operationId: `call-test-${++operation}`, followUp: { choice: "create", scheduledAt: when } })).success).toBe(false);
    expect(await db.followUp.count({ where: { leadId: item.id, status: FollowUpStatus.PENDING } })).toBe(1);
    expect(await db.leadActivity.count({ where: { leadId: item.id, message: "Call Back" } })).toBe(1);
    expect((await undoCallOutcome(item.id, id)).success).toBe(true);
    expect(await db.followUp.count({ where: { leadId: item.id } })).toBe(0);
  });
  it("undo keeps unrelated later activity", async () => { const item = await lead(LeadStatus.QUALIFIED); const id = `call-test-${operation + 1}`; expect((await save(item.id, "PICKED")).success).toBe(true); const later = await db.leadActivity.create({ data: { leadId: item.id, type: ActivityType.WHATSAPP_OPENED, message: "WhatsApp opened" } }); expect((await undoCallOutcome(item.id, id)).success).toBe(true); expect(await db.leadActivity.findUnique({ where: { id: later.id } })).not.toBeNull(); });
  it("replaces one pending callback and undo restores its exact previous schedule", async () => {
    const item = await lead(LeadStatus.NEW);
    const original = new Date(Date.now() + 86400000);
    const next = new Date(Date.now() + 172800000);
    const existing = await db.followUp.create({ data: { leadId: item.id, scheduledAt: original, type: "CALL", status: "PENDING", note: "Original" } });
    const id = `call-test-${++operation}`;
    expect((await saveCallOutcome({ leadId: item.id, outcome: "CALL_BACK", operationId: id, followUp: { choice: "replace", existingId: existing.id, scheduledAt: next.toISOString() } })).success).toBe(true);
    expect(await db.followUp.count({ where: { leadId: item.id, status: "PENDING" } })).toBe(1);
    expect((await db.followUp.findUniqueOrThrow({ where: { id: existing.id } })).scheduledAt.toISOString()).toBe(next.toISOString());
    const undo = await undoCallOutcome(item.id, id);
    expect(undo, undo.error).toMatchObject({ success: true });
    const restored = await db.followUp.findUniqueOrThrow({ where: { id: existing.id } });
    expect(restored.scheduledAt.toISOString()).toBe(original.toISOString());
    expect(restored.note).toBe("Original");
  });
});
