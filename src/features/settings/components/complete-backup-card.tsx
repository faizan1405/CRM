"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type JobStatus = "running" | "ready" | "failed" | "downloaded" | "expired";

interface BackupJobSummary {
  totalRecords: number;
  totalArtifacts: number;
  totalPdfPages: number;
  validationPassed: boolean;
  criticalFailureCount: number;
  warningCount: number;
  categories: Array<{ key: string; label: string; exportedCount: number }>;
}

interface BackupJobSnapshot {
  jobId: string;
  status: JobStatus;
  stage: string;
  percent: number;
  message: string;
  filename: string | null;
  bytes: number | null;
  error: string | null;
  summary: BackupJobSummary | null;
}

const REPORTS: Array<{ key: string; label: string; file: string }> = [
  { key: "overview", label: "CRM Overview", file: "01_CRM_Overview.pdf" },
  { key: "sales", label: "Sales Report", file: "02_Sales_Report.pdf" },
  { key: "finance", label: "Finance Report", file: "03_Finance_Report.pdf" },
  { key: "leads", label: "All Leads", file: "04_All_Leads.pdf" },
  { key: "projects-deals", label: "Projects & Deals", file: "05_Projects_and_Deals.pdf" },
  { key: "followups", label: "Follow-ups", file: "06_Followups_Report.pdf" },
  { key: "activities-notes", label: "Activities & Notes", file: "07_Activities_and_Notes.pdf" },
  { key: "other-records", label: "Other CRM Records", file: "08_Other_CRM_Records.pdf" },
];

const STAGE_ORDER = ["preparing", "collecting", "analysing", "raw-data", "reports", "verifying", "packaging", "ready"];

const STAGE_LABELS: Array<{ key: string; label: string; detail: string }> = [
  { key: "collecting", label: "Preparing data", detail: "Reading every CRM table from one read-only snapshot" },
  { key: "reports", label: "Generating PDF reports", detail: "8 branded reports with KPIs and data tables" },
  { key: "verifying", label: "Verifying records", detail: "Counts, relationships and financial reconciliation" },
  { key: "packaging", label: "Packaging backup", detail: "Building the ZIP with PDF, CSV and JSON files" },
  { key: "ready", label: "Ready to download", detail: "Archive validated and download started" },
];

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatCount(value: number | undefined | null): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-IN");
}

function triggerBrowserDownload(url: string, filename?: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  if (filename) anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export function CompleteBackupCard() {
  const [job, setJob] = useState<BackupJobSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef<number>(0);

  const isGenerating = starting || job?.status === "running";

  const clearPoll = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  useEffect(() => () => clearPoll(), [clearPoll]);

  const runSynchronousFallback = useCallback(async () => {
    // Hosts that cannot keep an in-process job registry answer this POST with the finished ZIP.
    const response = await fetch("/api/backup/download", { method: "POST", credentials: "same-origin" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error || "The backup could not be generated. Please try again.");
    }
    const blob = await response.blob();
    const filename = response.headers.get("X-Backup-Filename") || "ScaleFlow_CRM_Backup.zip";
    const objectUrl = URL.createObjectURL(blob);
    triggerBrowserDownload(objectUrl, filename);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 20000);
    setDownloaded(true);
  }, []);

  const poll = useCallback(
    async (jobId: string) => {
      try {
        const response = await fetch(`/api/backup/jobs/${jobId}`, { credentials: "same-origin", cache: "no-store" });
        if (response.status === 404) {
          clearPoll();
          setJob(null);
          await runSynchronousFallback();
          setStarting(false);
          return;
        }
        const payload = (await response.json()) as { success?: boolean; job?: BackupJobSnapshot; error?: string };
        if (!response.ok || !payload.job) {
          throw new Error(payload.error || "Lost contact with the backup job.");
        }

        const snapshot = payload.job;
        setJob(snapshot);

        if (snapshot.status === "ready") {
          clearPoll();
          triggerBrowserDownload(`/api/backup/jobs/${jobId}/download`, snapshot.filename ?? undefined);
          setDownloaded(true);
          setStarting(false);
          return;
        }

        if (snapshot.status === "failed" || snapshot.status === "expired") {
          clearPoll();
          setStarting(false);
          setError(snapshot.error || "Backup generation failed. No incomplete archive was produced.");
          return;
        }

        if (Date.now() - startedAt.current > 15 * 60 * 1000) {
          clearPoll();
          setStarting(false);
          setError("The backup is taking longer than expected. Please try again.");
          return;
        }

        pollTimer.current = setTimeout(() => void poll(jobId), 1000);
      } catch (pollError) {
        clearPoll();
        setStarting(false);
        setError(pollError instanceof Error ? pollError.message : "The backup could not be completed.");
      }
    },
    [clearPoll, runSynchronousFallback]
  );

  const startBackup = useCallback(async () => {
    setError(null);
    setDownloaded(false);
    setStarting(true);
    startedAt.current = Date.now();
    setJob({
      jobId: "pending",
      status: "running",
      stage: "preparing",
      percent: 1,
      message: "Preparing data",
      filename: null,
      bytes: null,
      error: null,
      summary: null,
    });

    try {
      const response = await fetch("/api/backup/jobs", { method: "POST", credentials: "same-origin" });

      if (response.status === 404 || response.status === 405 || response.status === 501) {
        await runSynchronousFallback();
        setStarting(false);
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        job?: BackupJobSnapshot;
        error?: string;
      };

      if (!response.ok || !payload.job) {
        throw new Error(payload.error || "The backup could not be started.");
      }

      setJob(payload.job);
      void poll(payload.job.jobId);
    } catch (startError) {
      setStarting(false);
      setJob(null);
      setError(startError instanceof Error ? startError.message : "The backup could not be started.");
    }
  }, [poll, runSynchronousFallback]);

  const currentStageIndex = useMemo(() => {
    const stage = job?.stage ?? "preparing";
    const index = STAGE_ORDER.indexOf(stage);
    return index < 0 ? 0 : index;
  }, [job?.stage]);

  const downloadReport = (key: string) => {
    triggerBrowserDownload(`/api/backup/report?type=${encodeURIComponent(key)}`);
  };

  return (
    <section
      aria-labelledby="complete-backup-heading"
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-blue-50 p-2.5 text-blue-700">
              <Database className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="complete-backup-heading" className="text-base font-bold text-slate-900 sm:text-lg">
                Complete CRM Backup
              </h2>
              <p className="mt-1 max-w-2xl text-xs text-slate-500 sm:text-sm">
                Download your complete CRM data as professionally structured PDF reports and machine-readable
                backup files.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>Read-only · Administration only</span>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void startBackup()}
            disabled={isGenerating}
            aria-busy={isGenerating}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Generating backup…</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Download Complete Backup</span>
              </>
            )}
          </button>

          {downloaded && !isGenerating && (
            <button
              type="button"
              onClick={() => void startBackup()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>Generate a fresh backup</span>
            </button>
          )}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-500 sm:text-xs">
          Includes every lead (current, waste, lost, archived and merged), every project/deal, every payment, all
          follow-ups, activities, notes, sales assets and supporting records — across all time, with no date filter.
          Credentials and notification keys are never included.
        </p>
      </div>

      {/* Progress */}
      {job && (isGenerating || job.status === "running" || downloaded) && (
        <div className="border-b border-slate-100 p-5 sm:p-6" aria-live="polite">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>{job.stage === "ready" ? "Ready to download" : "Backup in progress"}</span>
            <span className="font-mono text-slate-500">{job.percent}%</span>
          </div>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={job.percent}
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-[width] duration-500 ease-out"
              style={{ width: `${Math.max(2, job.percent)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">{job.message}</p>

          <ol className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {STAGE_LABELS.map((stage) => {
              const stageIndex = STAGE_ORDER.indexOf(stage.key);
              const done = job.status === "ready" || stageIndex < currentStageIndex;
              const active = !done && job.status === "running" && stageIndex === currentStageIndex;
              return (
                <li
                  key={stage.key}
                  className={`rounded-lg border p-3 text-[11px] leading-snug ${
                    done
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : active
                        ? "border-blue-200 bg-blue-50 text-blue-900"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    {done ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    ) : active ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
                    ) : (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
                    )}
                    <span>{stage.label}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">{stage.detail}</p>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Success summary */}
      {downloaded && job?.summary && (
        <div className="border-b border-slate-100 bg-emerald-50/60 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span>Backup generated, validated and downloaded</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div className="rounded-lg border border-emerald-200 bg-white p-3">
              <dt className="text-[11px] text-slate-500">Records exported</dt>
              <dd className="mt-0.5 text-sm font-bold text-slate-900">{formatCount(job.summary.totalRecords)}</dd>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-white p-3">
              <dt className="text-[11px] text-slate-500">Files in archive</dt>
              <dd className="mt-0.5 text-sm font-bold text-slate-900">{formatCount(job.summary.totalArtifacts)}</dd>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-white p-3">
              <dt className="text-[11px] text-slate-500">PDF pages</dt>
              <dd className="mt-0.5 text-sm font-bold text-slate-900">{formatCount(job.summary.totalPdfPages)}</dd>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-white p-3">
              <dt className="text-[11px] text-slate-500">Archive size</dt>
              <dd className="mt-0.5 text-sm font-bold text-slate-900">{formatBytes(job.bytes)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[11px] text-emerald-900">
            Validation: {job.summary.validationPassed ? "all integrity checks passed" : "completed with warnings"} ·{" "}
            {formatCount(job.summary.criticalFailureCount)} critical issues · {formatCount(job.summary.warningCount)}{" "}
            warnings. The temporary server-side copy has been deleted.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border-b border-slate-100 bg-rose-50 p-5 sm:p-6" role="alert">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
            <div className="text-xs text-rose-900">
              <p className="text-sm font-semibold">Backup not completed</p>
              <p className="mt-1">{error}</p>
              <p className="mt-1 text-rose-700">
                No partial or unverified archive was produced. You can safely retry — nothing in your CRM data was
                modified.
              </p>
              <button
                type="button"
                onClick={() => void startBackup()}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Try again</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual reports */}
      <div className="p-5 sm:p-6">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="flex w-full items-center justify-between gap-2 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Sparkles className="h-4 w-4 text-blue-600" aria-hidden="true" />
            Download an individual PDF report
          </span>
          <span className="text-[11px] font-medium text-slate-500">{expanded ? "Hide" : "Show 8 reports"}</span>
        </button>

        {expanded && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {REPORTS.map((report) => (
              <button
                key={report.key}
                type="button"
                disabled={isGenerating}
                onClick={() => downloadReport(report.key)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 disabled:opacity-50"
              >
                <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate">{report.label}</span>
                  <span className="block truncate font-mono text-[10px] font-normal text-slate-400">
                    {report.file}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
          Every report is rendered from the same all-time snapshot as the complete backup, in Indian currency and IST
          timestamps. The ZIP additionally contains the raw CSV files plus a complete JSON export and a manifest with
          record counts and integrity checks.
        </p>
      </div>
    </section>
  );
}