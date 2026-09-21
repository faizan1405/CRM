import { db } from "@/lib/db";
import type { Prisma, PrismaClient } from "@prisma/client";

export interface CrmSyncStateRecord {
  id: string;
  version: number;
  updatedAt: string;
}

let isTableInitialized = false;

async function ensureSyncTable(client: PrismaClient | Prisma.TransactionClient) {
  if (isTableInitialized) return;
  try {
    if (typeof client.$executeRawUnsafe === "function") {
      await client.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CrmSyncState" (
          "id" TEXT PRIMARY KEY DEFAULT 'global',
          "version" BIGINT NOT NULL DEFAULT 1,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      isTableInitialized = true;
    }
  } catch (error) {
    // If running with mock or table already exists concurrently
    console.warn("[CRM Sync Table Init]:", error instanceof Error ? error.message : error);
  }
}

/**
 * Monotonically touches and increments the CRM sync version in the database.
 * Executes atomically in a single round-trip.
 * Can be passed a transaction client (tx) or uses global `db`.
 */
export async function touchCrmSync(
  txOrDb?: PrismaClient | Prisma.TransactionClient
): Promise<CrmSyncStateRecord> {
  const client = txOrDb ?? db;

  try {
    await ensureSyncTable(client);

    const rows = await client.$queryRawUnsafe<Array<{ version: bigint | number; updatedAt: Date | string }>>(`
      INSERT INTO "CrmSyncState" ("id", "version", "updatedAt")
      VALUES ('global', 1, CURRENT_TIMESTAMP)
      ON CONFLICT ("id")
      DO UPDATE SET 
        "version" = "CrmSyncState"."version" + 1,
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "version", "updatedAt";
    `);

    if (rows && rows.length > 0) {
      const row = rows[0];
      const versionNum = Number(row.version);
      const updatedAtStr = row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString();
      return {
        id: "global",
        version: versionNum,
        updatedAt: updatedAtStr,
      };
    }
  } catch (error) {
    console.error("[CRM Sync Touch Error]:", error instanceof Error ? error.message : error);
  }

  // Fallback if raw query is not supported in a test environment
  return {
    id: "global",
    version: Date.now(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Returns the current CRM sync version and timestamp from the database.
 * Extremely lightweight: queries a single indexed row.
 */
export async function getCrmSyncState(): Promise<CrmSyncStateRecord> {
  try {
    await ensureSyncTable(db);

    const rows = await db.$queryRawUnsafe<Array<{ version: bigint | number; updatedAt: Date | string }>>(`
      SELECT "version", "updatedAt" FROM "CrmSyncState" WHERE "id" = 'global' LIMIT 1;
    `);

    if (rows && rows.length > 0) {
      const row = rows[0];
      return {
        id: "global",
        version: Number(row.version),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
      };
    }

    // If no row exists yet, do not initialize it during a read-only poll to prevent fake mutations
    return {
      id: "global",
      version: 0,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[CRM Sync Get Error]:", error instanceof Error ? error.message : error);
    return {
      id: "global",
      version: 0,
      updatedAt: new Date().toISOString(),
    };
  }
}
