-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'LEAD_MERGED';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "mergedIntoLeadId" TEXT,
ADD COLUMN "mergedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Lead_mergedIntoLeadId_idx" ON "Lead"("mergedIntoLeadId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_mergedIntoLeadId_fkey" FOREIGN KEY ("mergedIntoLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
