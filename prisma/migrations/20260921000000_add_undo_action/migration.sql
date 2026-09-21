-- CreateTable
CREATE TABLE "UndoAction" (
    "id" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "leadId" TEXT,
    "beforeSnapshot" JSONB NOT NULL,
    "afterSnapshot" JSONB,
    "expectedUpdatedAt" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "undoneAt" TIMESTAMP(3),
    "undoneByUserId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UndoAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UndoAction_entityId_idx" ON "UndoAction"("entityId");

-- CreateIndex
CREATE INDEX "UndoAction_leadId_idx" ON "UndoAction"("leadId");

-- CreateIndex
CREATE INDEX "UndoAction_createdAt_idx" ON "UndoAction"("createdAt");

-- CreateIndex
CREATE INDEX "UndoAction_expiresAt_idx" ON "UndoAction"("expiresAt");
