-- CreateEnum
CREATE TYPE "MetaReceiptStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'DUPLICATE_UPDATED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "PersonalNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaLeadReceipt" (
    "id" TEXT NOT NULL,
    "metaLeadId" TEXT NOT NULL,
    "leadId" TEXT,
    "formId" TEXT,
    "pageId" TEXT,
    "adId" TEXT,
    "adsetId" TEXT,
    "campaignId" TEXT,
    "status" "MetaReceiptStatus" NOT NULL DEFAULT 'RECEIVED',
    "rawPayload" JSONB,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),

    CONSTRAINT "MetaLeadReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalNote_userId_idx" ON "PersonalNote"("userId");

-- CreateIndex
CREATE INDEX "PersonalNote_isPinned_idx" ON "PersonalNote"("isPinned");

-- CreateIndex
CREATE INDEX "PersonalNote_createdAt_idx" ON "PersonalNote"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MetaLeadReceipt_metaLeadId_key" ON "MetaLeadReceipt"("metaLeadId");

-- CreateIndex
CREATE INDEX "MetaLeadReceipt_status_idx" ON "MetaLeadReceipt"("status");

-- CreateIndex
CREATE INDEX "MetaLeadReceipt_receivedAt_idx" ON "MetaLeadReceipt"("receivedAt");

-- CreateIndex
CREATE INDEX "MetaLeadReceipt_leadId_idx" ON "MetaLeadReceipt"("leadId");

-- AddForeignKey
ALTER TABLE "PersonalNote" ADD CONSTRAINT "PersonalNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaLeadReceipt" ADD CONSTRAINT "MetaLeadReceipt_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
