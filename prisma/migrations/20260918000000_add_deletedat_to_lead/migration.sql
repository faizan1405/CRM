-- Add soft delete support for Lead model
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;

CREATE INDEX IF NOT EXISTS "Lead_deletedAt_idx" ON "Lead"("deletedAt");
