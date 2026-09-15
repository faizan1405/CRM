import { afterAll, vi } from "vitest";
import { db } from "@/lib/db";

// Each isolated test worker owns its Prisma client. Release its query engine
// and sockets after suite-specific record cleanup has finished.
afterAll(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  await db.$disconnect();
});
