import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false,
    environment: "node",
    testTimeout: 60000,
    hookTimeout: 60000,
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
