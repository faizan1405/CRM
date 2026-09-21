-- CreateTable
CREATE TABLE "CrmSyncState" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "version" BIGINT NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmSyncState_pkey" PRIMARY KEY ("id")
);
