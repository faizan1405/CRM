-- CreateEnum
CREATE TYPE "AIPriority" AS ENUM ('CRITICAL', 'IMPORTANT', 'NORMAL');

-- CreateEnum
CREATE TYPE "AIActionType" AS ENUM ('CALL', 'FOLLOWUP', 'WHATSAPP', 'EMAIL', 'REVIEW', 'WARNING', 'OTHER');

-- CreateTable
CREATE TABLE "LeadAIInsight" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "priority" "AIPriority" NOT NULL,
    "scoreReason" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "recommendedActionType" "AIActionType",
    "factorBreakdown" JSONB,
    "lastAnalyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "needsRefresh" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadAIInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadAIInsight_leadId_key" ON "LeadAIInsight"("leadId");

-- CreateIndex
CREATE INDEX "LeadAIInsight_priority_idx" ON "LeadAIInsight"("priority");

-- CreateIndex
CREATE INDEX "LeadAIInsight_score_idx" ON "LeadAIInsight"("score");

-- CreateIndex
CREATE INDEX "LeadAIInsight_needsRefresh_idx" ON "LeadAIInsight"("needsRefresh");

-- CreateIndex
CREATE INDEX "LeadAIInsight_lastAnalyzedAt_idx" ON "LeadAIInsight"("lastAnalyzedAt");

-- AddForeignKey
ALTER TABLE "LeadAIInsight" ADD CONSTRAINT "LeadAIInsight_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
