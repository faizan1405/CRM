-- CreateEnum
CREATE TYPE "DealSource" AS ENUM ('CRM_LEAD', 'OTHER_CLIENT');

-- AlterTable
ALTER TABLE "Deal" ADD COLUMN "source" "DealSource" NOT NULL DEFAULT 'CRM_LEAD',
ADD COLUMN "clientPhone" TEXT,
ADD COLUMN "clientEmail" TEXT,
ADD COLUMN "projectName" TEXT,
ADD COLUMN "notes" TEXT;

-- Backfill existing deals safely to CRM_LEAD
UPDATE "Deal" SET "source" = 'CRM_LEAD' WHERE "source" IS NULL;

-- CreateIndex
CREATE INDEX "Deal_source_idx" ON "Deal"("source");
