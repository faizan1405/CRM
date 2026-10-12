import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";

try {
  const envFile = fs.readFileSync(".env.test", "utf8");
  const directMatch = envFile.match(/^TEST_DATABASE_URL_DIRECT=(.*)$/m);
  const regularMatch = envFile.match(/^TEST_DATABASE_URL=(.*)$/m);

  if (directMatch) {
    const base = directMatch[1].trim();
    const sep = base.includes("?") ? "&" : "?";
    process.env.TEST_DATABASE_URL = `${base}${sep}connection_limit=5&connect_timeout=30&pool_timeout=30`;
  } else if (regularMatch) {
    const base = regularMatch[1].trim();
    const sep = base.includes("?") ? "&" : "?";
    process.env.TEST_DATABASE_URL = `${base}${sep}pgbouncer=true&connection_limit=5&connect_timeout=30&pool_timeout=30`;
  }

  // Ensure DATABASE_URL is different to pass the db.ts check
  process.env.DATABASE_URL = "postgresql://dummy";
} catch (_e) {}

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    testTimeout: 120000,
    hookTimeout: 120000,
    exclude: ["**/.diagnostic-worktree/**", "**/.worktrees/**", "**/node_modules/**"],
    sequence: {
      concurrent: false,
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
