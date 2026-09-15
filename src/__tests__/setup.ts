import { afterAll, vi } from "vitest";
import { db } from "@/lib/db";

// Global mock for next/navigation so component/page rendering in node environment doesn't throw
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

// Each isolated test worker owns its Prisma client. Release its query engine
// and sockets after suite-specific record cleanup has finished.
afterAll(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  await db.$disconnect();
});
