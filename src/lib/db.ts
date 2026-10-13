import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let db: PrismaClient;

function getDatasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw);
    if (parsed.hostname.includes("-pooler.")) {
      if (!parsed.searchParams.has("pgbouncer")) {
        parsed.searchParams.set("pgbouncer", "true");
      }
      if (!parsed.searchParams.has("connection_limit")) {
        parsed.searchParams.set("connection_limit", "10");
      }
      if (!parsed.searchParams.has("connect_timeout")) {
        parsed.searchParams.set("connect_timeout", "15");
      }
      return parsed.toString();
    }
    return raw;
  } catch {
    return raw;
  }
}

if (process.env.NODE_ENV === "test") {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL is required when NODE_ENV=test");
  }
  if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL cannot be the same as DATABASE_URL to avoid data contamination");
  }
  
  db = globalForPrisma.prisma ?? new PrismaClient({
    datasourceUrl: process.env.TEST_DATABASE_URL,
  });
} else {
  const datasourceUrl = getDatasourceUrl();
  db = globalForPrisma.prisma ?? new PrismaClient(
    datasourceUrl ? { datasourceUrl } : undefined
  );
}

export { db };

globalForPrisma.prisma = db;
