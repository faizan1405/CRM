import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

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

const testEnv = parseEnv(".env.test");
const testDbUrl = testEnv.TEST_DATABASE_URL_DIRECT || testEnv.TEST_DATABASE_URL;

async function unlock() {
  const prisma = new PrismaClient({
    datasourceUrl: testDbUrl,
  });

  try {
    console.log("Connecting to test DB and releasing locks...");
    await prisma.$executeRawUnsafe("SELECT pg_advisory_unlock_all();");
    console.log("Advisory locks released successfully.");
  } catch (err) {
    console.error("Error releasing locks:", err);
  } finally {
    await prisma.$disconnect();
  }
}

unlock();
