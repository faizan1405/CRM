import { PrismaClient } from "@prisma/client";
import fs from "node:fs";

function parseEnv(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf-8");
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
}

const env = parseEnv(".env");
const testDbUrl = env.TEST_DATABASE_URL;

if (!testDbUrl) {
  throw new Error("Missing TEST_DATABASE_URL in .env");
}

if (testDbUrl === env.DATABASE_URL) {
  throw new Error("FATAL: TEST_DATABASE_URL is identical to DATABASE_URL!");
}

const prisma = new PrismaClient({ datasourceUrl: testDbUrl });

async function clean() {
  console.log("Cleaning test database...");
  await prisma.salesNotification.deleteMany({});
  await prisma.leadLossEvent.deleteMany({});
  await prisma.followUp.deleteMany({});
  await prisma.leadActivity.deleteMany({});
  await prisma.leadAIInsight.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.dailySalesBriefing.deleteMany({});
  await prisma.personalNote.deleteMany({});
  console.log("Test database cleaned successfully.");
}

clean()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
