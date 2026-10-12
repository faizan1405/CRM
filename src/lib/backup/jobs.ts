import { randomUUID } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { BACKUP_ARTIFACT_TTL_MS, BACKUP_STAGES } from "./constants";
import { generateCompleteBackup } from "./pipeline";
import type { BackupActor } from "./auth";
import type { BackupJobSnapshot, BackupProgressEvent, BackupStage, CompleteBackupResult } from "./types";
import { BackupValidationError } from "./validation";

/**
 * ==============================================================================
 * BACKUP JOB REGISTRY
 * ==============================================================================
 *
 * Generation is CPU/IO heavy and must report real progress, so a job runs in the background while
 * the browser polls its status. The finished ZIP is written to a private temporary directory with
 * owner-only permissions, streamed once to the administrator who started the job, and then deleted.
 * Expired artifacts are swept on every job call, and the TTL bounds the lifetime of any sensitive
 * file on disk.
 *
 * The registry is intentionally in-process: a backup job is short-lived, owner-scoped and never
 * shared between users. Hosts that cannot keep the state (stateless serverless) fall back to the
 * synchronous download endpoint, which never touches the registry.
 */

export type JobStatus = "running" | "ready" | "failed" | "downloaded" | "expired";

export interface BackupJobRecord {
  jobId: string;
  userId: string;
  status: JobStatus;
  stage: BackupStage;
  percent: number;
  message: string;
  startedAt: string;
  updatedAt: string;
  filename: string | null;
  tempPath: string | null;
  bytes: number | null;
  checksumSha256: string | null;
  expiresAt: string | null;
  error: string | null;
  result: CompleteBackupResult | null;
}

const globalStore = globalThis as unknown as { __scaleflowBackupJobs?: Map<string, BackupJobRecord> };
const jobs: Map<string, BackupJobRecord> = globalStore.__scaleflowBackupJobs ?? new Map();
globalStore.__scaleflowBackupJobs = jobs;

/** Persistent job storage directory */
const PERSISTENCE_DIR = path.join(os.tmpdir(), "scaleflow-jobs");

async function persistJob(job: BackupJobRecord): Promise<void> {
  try {
    await fsp.mkdir(PERSISTENCE_DIR, { recursive: true, mode: 0o700 });
    const key = `${job.userId}-${job.jobId}`;
    await fsp.writeFile(
      path.join(PERSISTENCE_DIR, `${key}.json`),
      JSON.stringify(job, null, 0),
      { mode: 0o600 }
    );
  } catch {
    /* persist failure - continue with in-memory only */
  }
}

async function loadPersistedJobs(): Map<string, BackupJobRecord> {
  const result = new Map<string, BackupJobRecord>();
  try {
    await fsp.mkdir(PERSISTENCE_DIR, { recursive: true, mode: 0o700 });
    const files = await fsp.readdir(PERSISTENCE_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const content = await fsp.readFile(path.join(PERSISTENCE_DIR, file), "utf8");
        const job: BackupJobRecord = JSON.parse(content);
        if (job.userId && job.jobId) {
          result.set(job.jobId, job);
        }
      } catch {
        /* corrupt file - skip */
      }
    }
  } catch {
    /* directory not accessible - return empty map */
  }
  return result;
}

/** Sweep expired persistence files */
        const mtime = fs.statSync(path.join(PERSISTENCE_DIR, file)).mtimeMs < now - BACKUP_ARTIFACT_TTL_MS;
  let removed = 0;
  try {
        const mtime = fs.statSync(path.join(PERSISTENCE_DIR, file)).mtimeMs < now - BACKUP_ARTIFACT_TTL_MS;
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const mtime = fpsmtime) < now - BACKUP_ARTIFACT_TTL_MS) {
          void fsp.unlink(path.join(PERSISTENCE_DIR, file));
          removed += 1;
        }
      } catch {
        /* skip */
      }
    }
  } catch {
    /* directory not accessible */
  }
  return removed;
} finally {
    // Clear the reference to fs.promises.stat since we're using fsp
  }
}

// Redefine using the correct function name
async function safeStat(target: string | null): Promise<Stats> {
  if (!target) throw new Error("No path provided");
  return fsp.stat(target);
}
export function backupTempDir(): string {
  return path.join(os.tmpdir(), "scaleflow-crm-backup");
}

/**
 * Error text shown to the administrator. Validation failures are our own wording and are surfaced
 * verbatim; anything else has connection strings, credentials and long opaque tokens stripped so a
 * database/driver message can never leak secrets into the UI or the logs.
 */
export function sanitizeJobError(error: unknown): string {
  if (error instanceof BackupValidationError) {
    return error.message;
  }

  const raw = error instanceof Error ? error.message : String(error ?? "");
  const stripped = raw
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted connection string]")
    .replace(/(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();

  if (stripped.length === 0 || stripped.length > 240) {
    return "Backup generation failed before a complete archive could be produced. Please try again.";
  }
  return `Backup generation failed: ${stripped}`;
}

async function ensureTempDir(): Promise<string> {
  const directory = backupTempDir();
  await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
  return directory;
}

export function jobToSnapshot(job: BackupJobRecord): BackupJobSnapshot {
  const summary = job.result
    ? {
        totalRecords: job.result.manifest.totals.totalRecords,
        totalArtifacts: job.result.manifest.totals.totalArtifacts,
        totalPdfPages: job.result.manifest.totals.totalPdfPages,
        validationPassed: job.result.validation.passed,
        criticalFailureCount: job.result.validation.criticalFailures.length,
        warningCount: job.result.validation.warnings.length,
        categories: job.result.manifest.categories,
      }
    : null;

  return {
    jobId: job.jobId,
    status: job.status === "downloaded" ? "downloaded" : job.status === "expired" ? "expired" : job.status,
    stage: job.stage,
    percent: job.percent,
    message: job.message,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    filename: job.filename,
    bytes: job.bytes,
    checksumSha256: job.checksumSha256,
    expiresAt: job.expiresAt,
    error: job.error,
    summary,
  };
}

function touch(job: BackupJobRecord, event: BackupProgressEvent): void {
  job.stage = event.stage;
  job.percent = Math.max(job.percent, Math.min(100, event.percent));
  job.message = event.message || BACKUP_STAGES[event.stage] || "Working";
  job.updatedAt = new Date().toISOString();
}

/** Removes temp artifacts whose authorised lifetime has passed. */
export function sweepExpiredJobs(now = Date.now()): number {
    const jobAge = job.updatedAt ? new Date(job.updatedAt).getTime() : 0;
    const isFinished = job.status === "ready" || job.status === "failed" || job.status === "downloaded";
    const expired = isFinished && job.expiresAt !== null && new Date(job.expiresAt).getTime() <= now;
    const stale = job.expiresAt === null && jobAge > BACKUP_ARTIFACT_TTL_MS;

    if (!expired && !stale) continue;
  // Also sweep stale persistence files
  void sweepStalePersistence(Date.now());
    void discardArtifact(job);
    removed += 1;
  }
  // Also sweep stale persistence files
  void sweepStalePersistence(Date.now());
  return removed;
      job.expiresAt !== null &&
      new Date(job.expiresAt).getTime() <= now;
    if (!expired) continue;
    void discardArtifact(job);
    removed += 1;
  }
  return removed;
}

async function safeUnlink(target: string | null): Promise<void> {
  if (!target) return;
  try {
    await fsp.unlink(target);
  } catch {
    /* already gone */
  }
}

export async function discardArtifact(job: BackupJobRecord): Promise<void> {
  await safeUnlink(job.tempPath);
  job.tempPath = null;
  job.result = null;
  if (job.status !== "downloaded") {
    job.status = "expired";
    job.message = "This backup artifact expired and was deleted.";
    job.updatedAt = new Date().toISOString();
  }
}

/** An in-flight or ready job for this administrator (prevents duplicate generation). */
export function activeJobForUser(userId: string): BackupJobRecord | null {
  for (const job of jobs.values()) {
    if (job.userId !== userId) continue;
    if (job.status === "running") return job;
    if (job.status === "ready" && job.expiresAt && new Date(job.expiresAt).getTime() > Date.now()) {
      return job;
    }
  }
  return null;
}

export function getJob(jobId: string): BackupJobRecord | null {
  return jobs.get(jobId) ?? null;
}

/**
 * Starts (or reuses) a backup job for the given administrator. The returned snapshot is safe to
 * hand to the browser: it contains counts and status only, never the archive itself.
 */
export async function startBackupJob(actor: BackupActor): Promise<BackupJobSnapshot> {
  sweepExpiredJobs();

  const existing = activeJobForUser(actor.id);
  if (existing) {
    return jobToSnapshot(existing);
  }

  const nowIso = new Date().toISOString();
  const job: BackupJobRecord = {
    jobId: randomUUID(),
    userId: actor.id,
    status: "running",
    stage: "preparing",
    percent: 1,
    message: "Preparing data",
    startedAt: nowIso,
    updatedAt: nowIso,
    filename: null,
    tempPath: null,
    bytes: null,
    checksumSha256: null,
    expiresAt: null,
    error: null,
    result: null,
  };
  jobs.set(job.jobId, job);

  // Fire-and-forget: progress is observed through the job registry.
  void runJob(job, actor);

  return jobToSnapshot(job);
}

async function runJob(job: BackupJobRecord, actor: BackupActor): Promise<void> {
  try {
    const result = await generateCompleteBackup({
      actor,
      onProgress: (event) => touch(job, event),
    });

    const directory = await ensureTempDir();
    const tempPath = path.join(directory, `${job.jobId}.zip`);
    await fsp.writeFile(tempPath, result.zipBuffer, { mode: 0o600 });

    job.tempPath = tempPath;
    job.filename = result.filename;
    job.bytes = result.bytes;
    job.checksumSha256 = result.checksumSha256;
    // Keep the manifest and validation for the completion summary, but never hold the archive
    // bytes in memory: the ZIP lives on disk until it is streamed once, then is deleted.
    job.result = { ...result, zipBuffer: Buffer.alloc(0) };
    job.status = "ready";
    job.stage = "ready";
    job.percent = 100;
    job.message = "Ready to download";
    job.expiresAt = new Date(Date.now() + BACKUP_ARTIFACT_TTL_MS).toISOString();
    job.updatedAt = new Date().toISOString();
  } catch (error) {
    job.status = "failed";
    job.stage = "failed";
    job.message = "Backup failed";
    job.error = sanitizeJobError(error);
    job.expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    job.updatedAt = new Date().toISOString();
  }
}

export interface JobArtifactHandle {
  job: BackupJobRecord;
  stream: fs.ReadStream;
  sizeBytes: number;
  filename: string;
}

/**
 * Opens the finished archive for a single streaming download. Returns null when the artifact is
 * not ready, has expired, or belongs to a different user (defence in depth on top of the ADMIN
 * role check performed by the route).
 */
export async function openJobArtifact(jobId: string, userId: string): Promise<JobArtifactHandle | null> {
  sweepExpiredJobs();
  const job = jobs.get(jobId);
  if (!job || job.userId !== userId) return null;
  if (job.status !== "ready" || !job.tempPath || !job.filename) return null;
  if (job.expiresAt && new Date(job.expiresAt).getTime() <= Date.now()) {
    await discardArtifact(job);
    return null;
  }

  const stat = await fsp.stat(job.tempPath).catch(() => null);
  if (!stat) {
    job.status = "expired";
    job.message = "The backup artifact is no longer available.";
    job.tempPath = null;
    return null;
  }

  return {
    job,
    stream: fs.createReadStream(job.tempPath),
    sizeBytes: stat.size,
    filename: job.filename,
  };
}

/** Marks the job as delivered and removes the temporary artifact. */
export async function completeJobDownload(job: BackupJobRecord): Promise<void> {
  await safeUnlink(job.tempPath);
  job.tempPath = null;
  job.status = "downloaded";
  job.message = "Downloaded. The temporary artifact has been deleted.";
  job.expiresAt = new Date(Date.now() + BACKUP_ARTIFACT_TTL_MS).toISOString();
  job.updatedAt = new Date().toISOString();
}

/** Test/DI helper. */
export function resetJobRegistry(): void {
  for (const job of jobs.values()) {
    void safeUnlink(job.tempPath);
  }
  jobs.clear();
}