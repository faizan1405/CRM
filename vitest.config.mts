import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import fs from "node:fs";

// Load .env and .env.local into process.env for all tests
for (const envFile of [".env", ".env.local"]) {
  const p = resolve(import.meta.dirname, envFile);
  if (fs.existsSync(p)) {
    const lines = fs.readFileSync(p, "utf-8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const rawVal = trimmed.slice(eqIdx + 1).trim();
        const val = rawVal.replace(/^["']|["']$/g, "");
        if (val) {
          process.env[key] = val;
        }
      }
    }
  }
}

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
});
