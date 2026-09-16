import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let db: PrismaClient;

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
  db = globalForPrisma.prisma ?? new PrismaClient();
}

export { db };

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
