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
const prodDbUrl = env.DATABASE_URL;
const testDbUrl = env.TEST_DATABASE_URL;

if (!prodDbUrl || !testDbUrl) {
  throw new Error("Missing DATABASE_URL or TEST_DATABASE_URL in .env");
}

if (prodDbUrl === testDbUrl) {
  throw new Error("FATAL: DATABASE_URL and TEST_DATABASE_URL are identical!");
}

const prodPrisma = new PrismaClient({ datasourceUrl: prodDbUrl });
const testPrisma = new PrismaClient({ datasourceUrl: testDbUrl });

async function verifyIsolation() {
  console.log("--- TEST ISOLATION VERIFICATION ---");

  const prodLeadsInitial = await prodPrisma.lead.count();
  const prodFollowUpsInitial = await prodPrisma.followUp.count();
  console.log(`[PROD INITIAL] Lead count: ${prodLeadsInitial}, FollowUp count: ${prodFollowUpsInitial}`);

  const testLeadsInitial = await testPrisma.lead.count();
  console.log(`[TEST INITIAL] Lead count: ${testLeadsInitial}`);

  // Create one harmless test record in TEST DB
  const testRecord = await testPrisma.lead.create({
    data: {
      name: "Temporary Isolation Check Lead",
      phone: "+919999999999",
      status: "NEW",
    },
  });
  console.log(`[TEST INSERTED] Created temporary lead in test DB: ${testRecord.id}`);

  const testLeadsAfterInsert = await testPrisma.lead.count();
  const prodLeadsAfterInsert = await prodPrisma.lead.count();
  console.log(`[TEST AFTER INSERT] Lead count: ${testLeadsAfterInsert} (diff: ${testLeadsAfterInsert - testLeadsInitial})`);
  console.log(`[PROD AFTER INSERT] Lead count: ${prodLeadsAfterInsert}`);

  if (testLeadsAfterInsert !== testLeadsInitial + 1) {
    throw new Error(`TEST DB count did not increase by 1. Expected ${testLeadsInitial + 1}, got ${testLeadsAfterInsert}`);
  }

  if (prodLeadsAfterInsert !== prodLeadsInitial) {
    throw new Error(`FATAL: PROD DB count changed! Expected ${prodLeadsInitial}, got ${prodLeadsAfterInsert}`);
  }

  // Remove the test record from TEST DB
  await testPrisma.lead.delete({ where: { id: testRecord.id } });
  const testLeadsFinal = await testPrisma.lead.count();
  const prodLeadsFinal = await prodPrisma.lead.count();
  console.log(`[TEST CLEANUP] Lead count: ${testLeadsFinal}`);
  console.log(`[PROD FINAL] Lead count: ${prodLeadsFinal}`);

  console.log("TEST ISOLATION PASS: Production DB was completely untouched during test DB writes.");
}

verifyIsolation()
  .catch(console.error)
  .finally(async () => {
    await prodPrisma.$disconnect();
    await testPrisma.$disconnect();
  });
