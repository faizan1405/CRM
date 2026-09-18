-- AlterTable: Add snapshot columns to Deal
ALTER TABLE "Deal" ADD COLUMN "clientNameSnapshot" TEXT,
ADD COLUMN "companyNameSnapshot" TEXT;

-- Backfill existing Deal snapshots from related Lead data
UPDATE "Deal"
SET
    "clientNameSnapshot" = "Lead"."name",
    "companyNameSnapshot" = "Lead"."business"
FROM "Lead"
WHERE "Deal"."leadId" = "Lead"."id";

-- AlterTable: Make Deal.leadId nullable
ALTER TABLE "Deal" ALTER COLUMN "leadId" DROP NOT NULL;

-- Drop existing cascade foreign key constraint
ALTER TABLE "Deal" DROP CONSTRAINT "Deal_leadId_fkey";

-- Add foreign key constraint with ON DELETE SET NULL
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;