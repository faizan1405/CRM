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
const testDbUrl = testEnv.TEST_DATABASE_URL;

console.log("Setting up schema on test database...");
execSync("npx prisma db push --accept-data-loss", {
  env: {
    ...process.env,
    DATABASE_URL: testDbUrl,
  },
  stdio: "inherit",
});
console.log("Test database schema ready.");
