-- Drop the unique constraint/index on Deal.leadId to allow multiple deals per client
DROP INDEX IF EXISTS "Deal_leadId_key";

-- Create a non-unique index on Deal.leadId for fast lookups
CREATE INDEX IF NOT EXISTS "Deal_leadId_idx" ON "Deal"("leadId");

-- Add submissionId column and unique index for idempotency
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "submissionId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Deal_submissionId_key" ON "Deal"("submissionId");

-- Safe legacy backfill: existing deals belonging to active WON leads are backfilled to CONFIRMED
UPDATE "Deal"
SET "status" = 'CONFIRMED'
WHERE "leadId" IN (
    SELECT "id" FROM "Lead"
    WHERE "status" = 'WON'
      AND "deletedAt" IS NULL
      AND "isWaste" = false
      AND "mergedIntoLeadId" IS NULL
)
AND "status" = 'NEGOTIATING';
