-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Lead_isPinned_idx" ON "Lead"("isPinned");
