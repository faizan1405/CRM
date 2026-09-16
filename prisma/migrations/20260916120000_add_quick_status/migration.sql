-- CreateEnum
CREATE TYPE "QuickStatus" AS ENUM ('NONE', 'CONTACTED', 'INTERESTED', 'CALL_NOT_PICK', 'CALL_AGAIN');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "quickStatus" "QuickStatus" NOT NULL DEFAULT 'NONE';

-- CreateIndex
CREATE INDEX "Lead_quickStatus_idx" ON "Lead"("quickStatus");
