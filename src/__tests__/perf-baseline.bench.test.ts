import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getDashboardData } from "@/app/actions/dashboard";
import { getLeads, getLead, changeLeadStatus } from "@/app/actions/leads";
import { getFollowUps } from "@/app/actions/follow-ups";
import { getAllDeals } from "@/app/actions/deals";
import { calculateSalesAnalytics } from "@/app/actions/analytics";
import { getLostReasonsAnalytics } from "@/app/actions/lost-reasons";
import { getCrmSyncState } from "@/lib/crm-sync";

// Mock auth session
const mockUser = {
  id: "perf-bench-user",
  email: "admin@perf.crm",
  role: "ADMIN" as const,
  name: "Performance Benchmarker",
};

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn().mockResolvedValue({
    id: "perf-bench-user",
    email: "admin@perf.crm",
    role: "ADMIN",
    name: "Performance Benchmarker",
  }),
  requireAuthenticatedUser: vi.fn().mockResolvedValue({
    id: "perf-bench-user",
    email: "admin@perf.crm",
    role: "ADMIN",
    name: "Performance Benchmarker",
  }),
  getCurrentUser: vi.fn().mockResolvedValue({
    id: "perf-bench-user",
    email: "admin@perf.crm",
    role: "ADMIN",
    name: "Performance Benchmarker",
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

interface BenchmarkMetric {
  screenOrAction: string;
  coldMs: number;
  warmAvgMs: number;
  p50Ms: number;
  p95Ms: number;
  rawRuns: number[];
}

const benchmarkResults: BenchmarkMetric[] = [];

function stats(times: number[]) {
  const sorted = [...times].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const warm = times.slice(1);
  const warmAvg = warm.length ? warm.reduce((a, b) => a + b, 0) / warm.length : times[0];
  return { p50, p95, warmAvg };
}

async function runBenchmark(name: string, fn: () => Promise<any>, runs = 5): Promise<BenchmarkMetric> {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    await fn();
    const dt = performance.now() - t0;
    times.push(dt);
  }
  const { p50, p95, warmAvg } = stats(times);
  const metric = {
    screenOrAction: name,
    coldMs: times[0],
    warmAvgMs: warmAvg,
    p50Ms: p50,
    p95Ms: p95,
    rawRuns: times,
  };
  benchmarkResults.push(metric);
  console.log(`[BENCHMARK] ${name}: Cold=${times[0].toFixed(1)}ms | WarmAvg=${warmAvg.toFixed(1)}ms | p50=${p50.toFixed(1)}ms | p95=${p95.toFixed(1)}ms | Runs=[${times.map(t => Math.round(t)).join(", ")}]ms`);
  return metric;
}

describe("Phase 1: Real Performance Baseline Measurements", () => {
  let sampleLeadId: string = "";
  let sampleLeadStatus: string = "";

  beforeAll(async () => {
    const { db } = await import("@/lib/db");
    const user = await db.user.upsert({
      where: { id: mockUser.id },
      create: { ...mockUser, passwordHash: "dummy" },
      update: {},
    });
    const lead = await db.lead.findFirst({
      where: { deletedAt: null, mergedIntoLeadId: null, isWaste: false },
      select: { id: true, status: true },
    });
    if (lead) {
      sampleLeadId = lead.id;
      sampleLeadStatus = lead.status;
    }
  });

  it("1. Measures Dashboard Initial Load (getDashboardData)", async () => {
    const res = await runBenchmark("Dashboard", async () => {
      return await getDashboardData();
    }, 5);
    expect(res.rawRuns.length).toBe(5);
  });

  it("2. Measures Leads Initial Load (getLeads)", async () => {
    const res = await runBenchmark("Leads", async () => {
      return await getLeads();
    }, 5);
    expect(res.rawRuns.length).toBe(5);
  });

  it("3. Measures Pipeline Initial Load (getLeads)", async () => {
    const res = await runBenchmark("Pipeline", async () => {
      return await getLeads();
    }, 5);
    expect(res.rawRuns.length).toBe(5);
  });

  it("4. Measures Follow-ups Initial Load (getFollowUps)", async () => {
    const res = await runBenchmark("Follow-ups", async () => {
      return await getFollowUps();
    }, 5);
    expect(res.rawRuns.length).toBe(5);
  });

  it("5. Measures Deals & Payments Initial Load (getAllDeals)", async () => {
    const res = await runBenchmark("Deals", async () => {
      return await getAllDeals();
    }, 5);
    expect(res.rawRuns.length).toBe(5);
  });

  it("6. Measures Analytics Initial Load", async () => {
    const res = await runBenchmark("Analytics", async () => {
      return await Promise.all([
        calculateSalesAnalytics("30d"),
        getLostReasonsAnalytics("30d"),
      ]);
    }, 5);
    expect(res.rawRuns.length).toBe(5);
  });

  it("7. Measures Opening Lead Detail Panel (getLead)", async () => {
    if (!sampleLeadId) return;
    const res = await runBenchmark("Lead Detail Panel", async () => {
      return await getLead(sampleLeadId);
    }, 5);
    expect(res.rawRuns.length).toBe(5);
  });

  it("8. Measures Lead Status Update (changeLeadStatus)", async () => {
    if (!sampleLeadId) return;
    const target = sampleLeadStatus === "CONTACTED" ? "Qualified" : "Contacted";
    const revert = sampleLeadStatus === "CONTACTED" ? "Contacted" : "Qualified";
    const res = await runBenchmark("Lead Status Update", async () => {
      const r = await changeLeadStatus(sampleLeadId, target as any);
      await changeLeadStatus(sampleLeadId, revert as any);
      return r;
    }, 3);
    expect(res.rawRuns.length).toBe(3);
  });

  it("9. Measures CRM Sync State Check (getCrmSyncState)", async () => {
    const res = await runBenchmark("CRM Sync Check", async () => {
      return await getCrmSyncState();
    }, 5);
    expect(res.rawRuns.length).toBe(5);
  });

  afterAll(() => {
    console.log("\n================================================================================");
    console.log("PHASE 1 BASELINE MEASUREMENTS TABLE");
    console.log("================================================================================");
    console.log("| Screen or action | Cold (ms) | Warm Avg (ms) | p50 (ms) | p95 (ms) |");
    console.log("|---|---|---|---|---|");
    for (const b of benchmarkResults) {
      console.log(`| ${b.screenOrAction} | ${b.coldMs.toFixed(1)} | ${b.warmAvgMs.toFixed(1)} | ${b.p50Ms.toFixed(1)} | ${b.p95Ms.toFixed(1)} |`);
    }
    console.log("================================================================================\n");
  });
});
