import fs from "node:fs";
import { execSync } from "node:child_process";

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
const testDbUrlDirect = testEnv.TEST_DATABASE_URL_DIRECT || testEnv.TEST_DATABASE_URL.replace("-pooler", "");
const testDbUrl = testEnv.TEST_DATABASE_URL;

if (!testDbUrl) {
  throw new Error("TEST_DATABASE_URL not found in .env.test");
}

const prodEnv = parseEnv(".env");
if (testDbUrl === prodEnv.DATABASE_URL) {
  throw new Error("FATAL SAFETY CHECK: testDbUrl is identical to production DATABASE_URL! Aborting.");
}

console.log("Resetting & applying migrations to ISOLATED test database using DIRECT connection...");
execSync("npx prisma migrate reset --force", {
  env: {
    ...process.env,
    DATABASE_URL: testDbUrlDirect,
  },
  stdio: "inherit",
});
console.log("Test database successfully reset and fully migrated.");
