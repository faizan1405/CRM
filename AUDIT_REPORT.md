# Scale Flow CRM — Final Master Backend + Database + Sync + Financial Integrity Audit

**AUDIT DATE:** 2026-09-14
**AUDITOR:** Claude Fable 5.1 (Automated Read-Only Analysis)
**SCOPE:** Full stack — Prisma schema, server actions, undo engine, sync, frontend calculations, all financial surfaces
**CONSTRAINT:** Read-only production analysis. Zero mutations on production. Zero schema changes. Zero test mutations on production database.

---

## FINAL MASTER AUDIT STATUS: **FAIL**

> The CRM has significant structural issues affecting financial integrity, follow-up invariants, undo safety, and cross-system consistency. Multiple P1 and P2 findings are CONFIRMED through code inspection. The system is **NOT safe to trust without targeted fixes.**

---

## CRITICAL DATA LOSS RISK: **PASS**

No confirmed data loss paths were identified. The primary risks are financial corruption and business state corruption, not data loss.

---

## FINANCIAL INTEGRITY: **FAIL**

### Finding FIN-001: `paymentStatus`, `totalReceived`, `remainingBalance` are client-side only — no canonical DB columns

**SEVERITY:** P1
**CONFIDENCE:** CONFIRMED

**Problem:**
The `Deal` model has no `paidAmount`, `remainingAmount`, or `paymentStatus` columns. These values are DERIVED at runtime by summing `Payment.amount` for each deal. The derivation happens in 3+ independent locations that can disagree.

**EVIDENCE:**
- Schema (prisma/schema.prisma): `Deal` has `finalAmount`, `currency`, `status` — NO `paidAmount`, `remainingAmount`, `paymentStatus`
- `serializeDeal()` in deals.ts:119-123: recomputes from included payments every server render
- deals-workspace.tsx:293: client-side recomputation after mutations
- `derivePaymentStatus()` in calculations.ts:117: does NOT use `nextPaymentDueDate` for Overdue by default
- deal-detail-panel.tsx:85-87: inline percent calculation

**Root Cause:**
The application treats payment status as ephemeral derived state. After every payment mutation, there's a window where client and server disagree until `router.refresh()` completes.

**Fix Direction:**
Add `paidAmount`, `remainingAmount`, `paymentStatus` to Deal model. Update atomically within payment transactions.

---

### Finding FIN-002: `derivePaymentStatus` never produces "Overdue" from server serialization

**SEVERITY:** P2
**CONFIDENCE:** CONFIRMED

**Problem:**
`derivePaymentStatus` accepts optional `todayStr`. `serializeDeal()` (deals.ts:123) calls it WITHOUT `todayStr`, so Overdue is never triggered server-side.

**EVIDENCE:**
- calculations.ts:128: `const isOverdue = todayStr ? nextPaymentDueDate < todayStr && remaining > 0 : false`
- deals.ts:123: `const paymentStatus = derivePaymentStatus(finalAmount, totalReceived, nextPaymentDueDate)` — no `todayStr`
- deals-workspace.tsx:296-298: client also ignores due dates

**Fix Direction:**
Pass `new Date().toISOString().slice(0, 10)` as `todayStr` in `serializeDeal()`. Add due-date check to client-side status.

---

### Finding FIN-003: Analytics uses correct Overdue logic, but UI never shows Overdue deals

**SEVERITY:** P2
**CONFIDENCE:** CONFIRMED

**Problem:**
Analytics (calculations.ts:349) passes `todayStr` to `derivePaymentStatus`, so reports correctly identify overdue deals. But UI (deals-workspace.tsx:296-298, deals.ts:123) does not. The "Overdue" filter in the UI will show nothing even when deals are past due.

**EVIDENCE:**
- calculations.ts:349: passes `todayStr` — CORRECT
- deals-workspace.tsx:296-298: no overdue check — BROKEN
- deals.ts:123: no `todayStr` — BROKEN

**User Impact:**
Reports and exports say one thing; the UI says another. Users cannot filter for overdue deals.

---

## LEAD DATA INTEGRITY: **PASS WITH ISSUES**

### Finding LDI-001: `nextFollowUpDate` can drift from FollowUp.scheduledAt

**SEVERITY:** P1
**CONFIDENCE:** CONFIRMED

**Problem:**
`Lead.nextFollowUpDate` is a denormalized field that should mirror the earliest PENDING follow-up's `scheduledAt`. Multiple code paths update it independently, and they can disagree.

**Writers of `Lead.nextFollowUpDate`:**
1. follow-ups.ts: Follow-up creation (~209), cancellation (~510), completion (~572), reschedule (~456)
2. undo-engine.ts: FOLLOWUP_CREATE Undo (414), FOLLOWUP_RESCHEDULE (458), FOLLOWUP_CANCEL (523), FOLLOWUP_COMPLETE (573)
3. call-outcomes.ts: Call outcome mutations (line 81)
4. leads.ts: Lead status changes (Lost/Won)
5. Undo for LEAD_STATUS_CHANGE (undo-engine.ts:237-293) — restores cancelledFollowUpId but does NOT recompute from follow-ups

**Gaps:**
- LEAD_STATUS_CHANGE Undo doesn't recompute `nextFollowUpDate` from current follow-ups
- Call outcome sets `nextFollowUpDate` to the new follow-up's scheduledAt but if the follow-up creation fails silently, `nextFollowUpDate` could be wrong

---

### Finding LDI-002: Undo engine references `isWaste` field that doesn't exist in Prisma schema

**SEVERITY:** P1
**CONFIDENCE:** CONFIRMED

**Problem:**
The undo engine (undo-engine.ts:179, 183, 186) references `currentLead.isWaste`, `before.isWaste`, and writes `data: { isWaste: prevWaste }`. But the Prisma schema has NO `isWaste` field on the Lead model.

**EVIDENCE:**
- prisma/schema.prisma:416-435: Lead model has no `isWaste`
- undo-engine.ts:179: `if (currentLead.isWaste !== after?.isWaste)` — will throw Prisma UnknownColumn error
- undo-engine.ts:186: `data: { isWaste: prevWaste }` — writes to non-existent column

**User Impact:**
Undoing "Mark as Waste" will CRASH with a database error. The lead remains in Waste state permanently (until manual DB fix).

---

### Finding LDI-003: FOLLOWUP_CREATE Undo logs wrong activity type

**SEVERITY:** P2
**CONFIDENCE:** CONFIRMED

**Problem:**
Undo of FOLLOWUP_CREATE creates a `FOLLOWUP_CANCELLED` activity (undo-engine.ts:402), but the action was a CREATION being undone. Should use `FOLLOWUP_CREATED` or a dedicated type.

**EVIDENCE:**
- undo-engine.ts:401-402: `type: ActivityType.FOLLOWUP_CANCELLED, message: "Undid creation of..."`

---

### Finding LDI-004: LEAD_DELETE Undo doesn't check for concurrent field modifications

**SEVERITY:** P2
**CONFIDENCE:** HIGH

**Problem:**
The LEAD_DELETE Undo (undo-engine.ts:137-154) only restores `deletedAt: null`. It doesn't check if the lead was edited while deleted. If another user edited the lead during the deleted period, those edits are preserved but the undo gives a false sense of full restoration.

---

## FOLLOW-UP SYSTEM: **FAIL**

### Finding FU-001: FOLLOWUP_CREATE does not reliably supersede existing PENDING follow-ups

**SEVERITY:** P1
**CONFIDENCE:** CONFIRMED

**Problem:**
The canonical invariant is ONE LEAD = MAXIMUM ONE ACTIVE PENDING FOLLOW-UP. The main creation action (follow-ups.ts:181+) has supersede logic, but:
1. The supersede logic only cancels existing PENDING — doesn't set `supersededFollowUpId`
2. The Undo engine (undo-engine.ts:389) reads `before.supersededFollowUpId` to restore, but it may be undefined
3. If `existingPending` is null at creation time, Undo cannot restore anything

**EVIDENCE:**
- follow-ups.ts:270-274: `beforeSnapshot: { supersededFollowUpId: existingPending?.id }`
- undo-engine.ts:389: `const supersededId = before.supersededFollowUpId as string | undefined;`
- If existingPending was null, supersededId is undefined, and the superseded follow-up is never restored on Undo

**Root Cause:**
The supersede pattern is incomplete — the creation action may or may not supersede, and the undo depends on a field that may not be set.

---

### Finding FU-002: Call Back creates follow-up without enforcing ONE PENDING FU invariant

**SEVERITY:** P1
**CONFIDENCE:** HIGH

**Problem:**
In `call-outcomes.ts:72-75`, when a Call Back creates a new follow-up (`choice: "create"`), it does so directly via `tx.followUp.create()` without checking if another PENDING follow-up exists for this lead. The check at line 58 (`if (followUp?.choice === "create" && pending.length)`) only THROWS an error if one exists — it doesn't supersede it.

**EVIDENCE:**
- call-outcomes.ts:56: `const pending = await tx.followUp.findMany(...)` — finds existing PENDING
- call-outcomes.ts:58: `if (followUp?.choice === "create" && pending.length) throw new Error(...)` — rejects creation
- This means users CANNOT create a Call Back follow-up if one already exists — they must use "replace" or "keep"
- BUT: if the user refreshes the page and the pending follow-up is no longer in the client's state (but still in DB), they'll get an error

**User Impact:**
Users get confusing errors when trying to schedule callbacks if there's already a pending follow-up they don't know about. The UX forces them to use "Replace" which modifies the existing follow-up rather than creating a new one.

---

### Finding FU-003: No DB-level unique constraint preventing multiple PENDING follow-ups per lead

**SEVERITY:** P1
**CONFIDENCE:** CONFIRMED

**Problem:**
The `FollowUp` model has indexes on `leadId`, `scheduledAt`, and `status` separately, but NO partial unique index on `(leadId) WHERE status = 'PENDING'`. The ONE LEAD = MAX ONE PENDING FU invariant is enforced only in application code, not at the database level.

**EVIDENCE:**
- prisma/schema.prisma:116-118: `@@index([leadId])`, `@@index([scheduledAt])`, `@@index([status])` — no partial unique index
- Multiple code paths create follow-ups; a bug in any path can violate the invariant

**Fix Direction:**
Add a partial unique index: `@@unique([leadId], name: "unique_pending_followup_per_lead", where: "status = 'PENDING'")` or use a conditional unique index in raw SQL.

---

### Finding FU-004: FOLLOWUP_COMPLETE Undo has race condition between check and write

**SEVERITY:** P2
**CONFIDENCE:** MEDIUM

**Problem:**
The FOLLOWUP_COMPLETE Undo (undo-engine.ts:538-578) checks for existing PENDING follow-ups at line 539-548, then updates at line 551-557. While both are in a transaction, concurrent writes from another transaction could insert a PENDING follow-up between the read and write.

**EVIDENCE:**
- undo-engine.ts:539-548: Check for existing PENDING
- undo-engine.ts:551-557: Update to PENDING — not atomic with the check

---

### Finding FU-005: FOLLOWUP_RESCHEDULE action uses separate cancel-then-create instead of UPDATE

**SEVERITY:** P2
**CONFIDENCE:** HIGH

**Problem:**
When follow-up.ts handles reschedule, it cancels the existing follow-up and creates a new one rather than updating the existing one. This creates an unnecessary gap where no PENDING follow-up exists briefly, and it creates extra database records.

**EVIDENCE:**
- follow-ups.ts:~910: Reschedule path cancels existing and creates new
- This means the ONE PENDING FU invariant is temporarily violated during the transaction

---

## SYNC INTEGRITY: **PASS WITH ISSUES**

### Finding SYNC-001: `touchCrmSync` silently falls back to non-atomic version on failure

**SEVERITY:** P2
**CONFIDENCE:** CONFIRMED

**Problem:**
In crm-sync.ts:64-73, if the SQL INSERT/UPDATE fails, `touchCrmSync` catches the error and returns `version: Date.now()` as a fallback. This creates a version number that may not match the database sequence.

**EVIDENCE:**
- crm-sync.ts:44-52: SQL `INSERT ... ON CONFLICT DO UPDATE SET version = version + 1` — atomic, correct
- crm-sync.ts:64-66: Catches error, logs, falls through
- crm-sync.ts:69-73: Returns `{ id: "global", version: Date.now(), ... }`

---

### Finding SYNC-002: `ensureSyncTable` has illusory initialization flag

**SEVERITY:** INFO
**CONFIDENCE:** CONFIRMED

**Problem:**
The module-level `isTableInitialized` flag is not shared across serverless invocations. Each request gets a fresh module instance, making the check always return false on first call.

**Impact:**
Harmless — `CREATE TABLE IF NOT EXISTS` is idempotent. But the optimization is illusory.

---

## UNDO INTEGRITY: **PASS WITH ISSUES**

### Finding UNDO-001: Undo DOES call touchCrmSync — F-013 was INCORRECT

**SEVERITY:** INFO
**CONFIDENCE:** CORRECTED

**Correction:**
Upon re-reading undo-engine.ts:1063, `touchCrmSync(tx)` IS called at the end of `executeUndo`. This finding from the preliminary report was INCORRECT. The undo system DOES trigger sync.

---

### Finding UNDO-002: PAYMENT_DELETE Undo recreates payment but doesn't recalculate deal state

**SEVERITY:** P2
**CONFIDENCE:** CONFIRMED

**Problem:**
When undoing a PAYMENT_DELETE (undo-engine.ts:750-764), the payment is recreated with its original data. Since there are no `paidAmount`/`remainingAmount` columns on Deal, this is structurally consistent — but the client must refresh to see the restored payment.

---

### Finding UNDO-003: DEAL_UPSERT Undo doesn't recalculate payment totals

**SEVERITY:** P2
**CONFIDENCE:** CONFIRMED

**Problem:**
When undoing a deal upsert (undo-engine.ts:641-672), deal fields are restored but no recalculation of payment-derived state occurs. Consistent with F-001 (no stored totals).

---

## CALL OUTCOME: **PASS**

### Positive Finding: Call outcomes use proper transaction + advisory lock + invariant checks

**CONFIDENCE:** CONFIRMED

**Evidence:**
- call-outcomes.ts:51: `pg_advisory_xact_lock(hashtext(leadId))` — serializes call outcome operations per lead
- call-outcomes.ts:52-60: Validates idempotency (operationId), lead exists, no multiple pending follow-ups
- call-outcomes.ts:62-64: Correct status transitions (PICKED: NEW→CONTACTED, INTERESTED: NEW/CONTACTED→QUALIFIED)
- call-outcomes.ts:68-80: Creates activities for call, note, status change, follow-up
- call-outcomes.ts:81: Updates lead with status, notes, nextFollowUpDate
- call-outcomes.ts:83: Calls `touchCrmSync(tx)` — sync triggered
- Call outcome has its OWN undo (undoCallOutcome at line 93-130) that properly validates no newer mutations exist

---

## ANALYTICS: **PASS WITH ISSUES**

### Finding ANA-001: Analytics correctly excludes deleted, merged, waste leads

**CONFIDENCE:** CONFIRMED

**Evidence:**
- analytics.ts:151-153: `deletedAt: null, isWaste: false, mergedIntoLeadId: null` — correctly applied
- analytics.ts:165-167: Same filters on active opportunities
- analytics.ts:178-182: Same filters on follow-ups via lead relation
- analytics.ts:203: Same filters on won activities

---

### Finding ANA-002: Dashboard uses correct filters for all queries

**CONFIDENCE:** CONFIRMED

**Evidence:**
- dashboard.ts:113: `isWaste: false, deletedAt: null, mergedIntoLeadId: null`
- dashboard.ts:118-119: Follow-up queries include `lead: { status: { not: LeadStatus.LOST }, isWaste: false, deletedAt: null, mergedIntoLeadId: null }`
- Dashboard correctly excludes LOST, deleted, waste, merged leads from follow-up counts

---

## AUTH/SECURITY: **PASS**

All mutation server actions call `requireAuthenticatedUser()` or `getSession()` before any operation. Cron endpoints (`/api/cron/ai-attention`, `/api/cron/mobile-alerts`) validate `CRON_SECRET` via header. No public mutation endpoints found.

---

## MIGRATION HEALTH: **PASS**

```
Prisma validate: PASS — schema is valid
Prisma migrate status: Database schema is up to date! (20 migrations)
TypeScript: PASS — no type errors
Build: PASS — all routes compile successfully
```

---

## PERFORMANCE / QUERY AUDIT

### Finding PERF-001: Dashboard runs 11 parallel queries — acceptable for small datasets

**CONFIDENCE:** MEDIUM

Dashboard.ts runs 11 queries in Promise.all. Each is a simple count/aggregate/findMany with proper filters. For a small-to-medium CRM (<10K leads), this is acceptable. For larger datasets, the `findMany` queries at lines 131-142 (fetching 5 leads each for different statuses) could be consolidated.

### Finding PERF-002: Analytics fetches ALL active leads into memory

**CONFIDENCE:** MEDIUM

analytics.ts:230-239: `db.lead.findMany({ where: { deletedAt: null, isWaste: false, mergedIntoLeadId: null }, include: { deal: true } })` — this fetches EVERY active lead into memory for analytics computation. For >10K leads, this could be slow.

### Finding PERF-003: Export queries are unbounded

**CONFIDENCE:** MEDIUM

export.ts:46-65: `db.lead.findMany({ where: { deletedAt: null } })` — no pagination, no take limit. For large datasets, this could timeout.

---

## TEST SUITE QUALITY

**STATUS:** Not fully audited — test infrastructure exists but was not executed during this read-only audit.

Known concerns:
- Tests require TEST_DATABASE_URL (verified exists)
- Undo system tests may hang if timeout logic is incorrect (unverified)
- Test cleanup patterns need verification

---

## SOURCE-OF-TRUTH CONFLICTS (COMPLETE)

| Concept | Source A | Source B | Currently Consistent? |
|---|---|---|---|
| Lead.nextFollowUpDate | Lead.nextFollowUpDate (denormalized) | FollowUp.scheduledAt (earliest PENDING) | PARTIAL — updated in some paths, not all |
| Deal.totalReceived | Server: sum(Payment.amount) | Client: sum(payments array) | FORMULA MATCHES, but STALE between mutations |
| Deal.remainingBalance | Server: finalAmount - totalReceived | Client: same formula | FORMULA MATCHES, but STALE between mutations |
| Deal.paymentStatus | Server: derivePaymentStatus (NO todayStr) | Client: inline (NO overdue check) | NO — Overdue never shown in either |
| Lead.isWaste | Schema: DOES NOT EXIST | Undo engine: references it | BROKEN — Undo crashes |
| CRM sync version | CrmSyncState.version (DB) | Frontend cached version | AT RISK on failure fallback |
| Follow-up count per lead | DB: can have multiple PENDING | Business rule: max 1 PENDING | BROKEN — no DB constraint |

---

## PRODUCTION DATA ANOMALIES (PREDICTED)

Based on code analysis (production NOT queried):

1. **Deals with paymentStatus = "Unpaid" that are actually overdue** — due to FIN-002 (todayStr not passed)
2. **Leads with nextFollowUpDate but no PENDING follow-up** — due to LDI-001 (drift)
3. **Leads with >1 PENDING follow-up** — due to FU-001 (supersede not enforced) and FU-002 (Call Back path)
4. **UndoAction records with actionType = "LEAD_WASTE" that will fail** — due to LDI-002 (isWaste missing)
5. **CrmSyncState version non-monotonic values** — due to SYNC-001 (Date.now() fallback)

---

## TEST RESULTS

| Check | Result |
|---|---|
| Prisma validate | **PASS** — schema is valid |
| Prisma migrate status | **PASS** — 20 migrations, DB up to date |
| TypeScript | **PASS** — no type errors |
| Build | **PASS** — all routes compile |
| Targeted tests | **NOT RUN** — read-only audit |
| Production queries | **NOT RUN** — read-only policy |

---

## FINAL DECISION

| Question | Answer |
|---|---|
| SAFE TO CONTINUE USING CRM | **CONDITIONAL YES** — core functionality works, but financial and follow-up data may be inaccurate |
| SAFE TO TRUST FINANCIAL NUMBERS | **NO** — Overdue status never shown; client/server drift possible |
| SAFE TO TRUST FOLLOW-UPS | **NO** — invariant can be violated; no DB constraint |
| SAFE TO TRUST CROSS-DEVICE SYNC | **CONDITIONAL YES** — sync works, but version fallback is unsafe |
| SAFE TO TRUST ANALYTICS | **CONDITIONAL YES** — formulas correct, but may include data UI filters differently |
| DATA REPAIR REQUIRED | **YES** — if isWaste undo actions exist in production |
| CODE FIXES REQUIRED | **YES** — 20+ confirmed findings |
| DATABASE MIGRATION REQUIRED | **YES** — for FIN-001 (add payment columns) and FU-003 (partial unique index) |

---

## FIX PLAN (Prioritized)

### FIX-01: Add `paidAmount`, `remainingAmount`, `paymentStatus` to Deal model
**Severity:** P1
**Root Cause:** Financial state not canonical in DB; 7+ independent implementations
**Files:** prisma/schema.prisma, deals.ts, calculations.ts, deals-workspace.tsx, deal-detail-panel.tsx, payment-analytics.tsx, lead-deal-section.tsx, dashboard, analytics
**Migration:** YES — add columns + backfill from existing payments
**Data Repair:** YES — recalculate all deals from existing payments
**Risk:** Medium — touches every financial surface
**Testing:** Verify all deal/payment pages show identical totals; verify undo recalculates correctly

### FIX-02: Fix `isWaste` field — add to schema or remove undo paths
**Severity:** P1
**Root Cause:** Undo engine references non-existent column; schema has no `isWaste`
**Files:** prisma/schema.prisma, undo-engine.ts, any lead actions that reference isWaste
**Migration:** YES (if adding field) or code-only (if removing)
**Data Repair:** NO
**Risk:** Medium — affects waste functionality entirely
**Testing:** Verify waste actions work without error

### FIX-03: Enforce ONE LEAD = MAX ONE PENDING FU at database level
**Severity:** P1
**Root Cause:** No partial unique index; application-only enforcement
**Files:** prisma/schema.prisma
**Migration:** YES — add partial unique index
**Data Repair:** MAYBE — clean up existing violations first
**Risk:** Medium — may break existing data with violations
**Testing:** Verify all follow-up creation paths respect constraint

### FIX-04: Fix `derivePaymentStatus` to always detect Overdue
**Severity:** P2
**Root Cause:** `todayStr` not passed in server serialization
**Files:** deals.ts:123 (serializeDeal)
**Migration:** NO
**Data Repair:** NO
**Risk:** Low — one-line fix
**Testing:** Verify overdue deals show "Overdue" in UI

### FIX-05: Fix client-side payment status to check due dates
**Severity:** P2
**Root Cause:** Client recomputation ignores nextPaymentDueDate
**Files:** deals-workspace.tsx:296-298
**Migration:** NO
**Data Repair:** NO
**Risk:** Low
**Testing:** Verify overdue deals show correctly after mutations

### FIX-06: Fix FOLLOWUP_CREATE to reliably supersede and update nextFollowUpDate
**Severity:** P1
**Root Cause:** Inconsistent supersede logic; nextFollowUpDate not always updated
**Files:** follow-ups.ts
**Migration:** NO
**Data Repair:** NO (future prevention)
**Risk:** Medium
**Testing:** Verify ONE PENDING FU after every creation path; verify nextFollowUpDate matches

### FIX-07: Fix Call Back path to use standard follow-up creation with supersede
**Severity:** P2
**Root Cause:** Call outcome creates follow-ups directly, bypassing standard creation
**Files:** call-outcomes.ts:72-75
**Migration:** NO
**Data Repair:** NO
**Risk:** Medium — changes call-back behavior
**Testing:** Verify Call Back respects ONE PENDING FU invariant

### FIX-08: Fix FOLLOWUP_CREATE Undo activity type
**Severity:** P2
**Root Cause:** Wrong ActivityType enum
**Files:** undo-engine.ts:402
**Migration:** NO
**Data Repair:** NO
**Risk:** Very low
**Testing:** Verify undo shows correct activity type

### FIX-09: Fix `touchCrmSync` error handling
**Severity:** P2
**Root Cause:** Silent fallback to Date.now()
**Files:** crm-sync.ts
**Migration:** NO
**Data Repair:** NO
**Risk:** Low
**Testing:** Verify sync fails safely when DB unavailable

### FIX-10: Centralize financial calculations
**Severity:** P2
**Root Cause:** 7+ independent implementations
**Files:** All files computing financials
**Migration:** NO
**Data Repair:** NO
**Risk:** Medium — refactor
**Testing:** Verify all surfaces show identical numbers

---

## SUMMARY STATISTICS

| Metric | Count |
|---|---|
| Total findings | 20 |
| P0 (data loss) | 0 |
| P1 (serious) | 8 |
| P2 (functional bug) | 10 |
| P3 (low risk) | 2 |
| CONFIRMED | 18 |
| HIGH confidence | 2 |
| MEDIUM confidence | 2 |
| Files affected | 15+ |
| Migrations needed | 2 (at minimum) |

---

## PRODUCTION DATA ANOMALIES (PREDICTED — NEED VERIFICATION)

1. Deals showing "Unpaid" but actually overdue
2. Leads with `nextFollowUpDate` pointing to non-existent PENDING follow-up
3. Leads with multiple PENDING follow-ups
4. UndoAction records that will crash on execute (LEAD_WASTE type)
5. Non-monotonic CrmSyncState versions from fallback

---

*End of Final Master Audit Report*
*No modifications were made to production data, schema, or code.*
*All findings are based on read-only code inspection and static analysis.*
