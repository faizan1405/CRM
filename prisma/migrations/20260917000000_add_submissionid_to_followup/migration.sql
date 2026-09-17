-- Add submissionId column to FollowUp table for idempotent creation
ALTER TABLE "FollowUp" ADD COLUMN IF NOT EXISTS "submissionId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "FollowUp_submissionId_key" ON "FollowUp"("submissionId") WHERE "submissionId" IS NOT NULL;
