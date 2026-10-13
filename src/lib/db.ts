import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let db: PrismaClient;

function getDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  if (url.includes("-pooler.") && !url.includes("pgbouncer=true")) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}pgbouncer=true&connection_limit=10&connect_timeout=15`;
  }
  return url;
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
