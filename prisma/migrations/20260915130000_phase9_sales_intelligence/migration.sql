-- CreateEnum
CREATE TYPE "WhatsAppTemplateCategory" AS ENUM ('FIRST_CONTACT', 'AFTER_CALL', 'FOLLOW_UP', 'QUOTATION_SENT', 'QUOTATION_FOLLOW_UP', 'NO_RESPONSE', 'FINAL_FOLLOW_UP', 'CONVERTED_THANK_YOU');

-- CreateEnum
CREATE TYPE "LeadLossReason" AS ENUM ('PRICE', 'NO_RESPONSE', 'TIMING', 'COMPETITOR', 'TRUST', 'NOT_QUALIFIED', 'REQUIREMENT_CHANGED', 'NO_URGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('CRITICAL', 'IMPORTANT', 'NORMAL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('OVERDUE_FOLLOWUP', 'FOLLOWUP_DUE_TODAY', 'NEW_LEAD_NOT_CONTACTED', 'STALE_LEAD', 'HOT_LEAD_ATTENTION', 'HIGH_VALUE_OPPORTUNITY', 'PROPOSAL_FOLLOWUP', 'AI_RECOMMENDED_ACTION', 'MISSED_FOLLOWUP');

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "WhatsAppTemplateCategory" NOT NULL,
    "message" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadLossEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "reason" "LeadLossReason" NOT NULL,
    "note" TEXT,
    "lostAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadLossEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "leadId" TEXT,
    "type" "NotificationType" NOT NULL,
    "priority" "NotificationPriority" NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "readAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySalesBriefing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'system',
    "briefingDate" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailySalesBriefing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_category_idx" ON "WhatsAppTemplate"("category");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_isActive_idx" ON "WhatsAppTemplate"("isActive");

-- CreateIndex
CREATE INDEX "LeadLossEvent_leadId_idx" ON "LeadLossEvent"("leadId");

-- CreateIndex
CREATE INDEX "LeadLossEvent_reason_idx" ON "LeadLossEvent"("reason");

-- CreateIndex
CREATE INDEX "LeadLossEvent_lostAt_idx" ON "LeadLossEvent"("lostAt");

-- CreateIndex
CREATE UNIQUE INDEX "SalesNotification_dedupeKey_key" ON "SalesNotification"("dedupeKey");

-- CreateIndex
CREATE INDEX "SalesNotification_status_idx" ON "SalesNotification"("status");

-- CreateIndex
CREATE INDEX "SalesNotification_priority_idx" ON "SalesNotification"("priority");

-- CreateIndex
CREATE INDEX "SalesNotification_createdAt_idx" ON "SalesNotification"("createdAt");

-- CreateIndex
CREATE INDEX "SalesNotification_userId_idx" ON "SalesNotification"("userId");

-- CreateIndex
CREATE INDEX "SalesNotification_leadId_idx" ON "SalesNotification"("leadId");

-- CreateIndex
CREATE INDEX "DailySalesBriefing_briefingDate_idx" ON "DailySalesBriefing"("briefingDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailySalesBriefing_userId_briefingDate_key" ON "DailySalesBriefing"("userId", "briefingDate");

-- AddForeignKey
ALTER TABLE "WhatsAppTemplate" ADD CONSTRAINT "WhatsAppTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadLossEvent" ADD CONSTRAINT "LeadLossEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadLossEvent" ADD CONSTRAINT "LeadLossEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesNotification" ADD CONSTRAINT "SalesNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesNotification" ADD CONSTRAINT "SalesNotification_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
