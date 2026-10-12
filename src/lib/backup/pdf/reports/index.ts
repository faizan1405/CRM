import { REPORT_DEFINITIONS, getReportDefinition } from "../../constants";
import type { ReportKey } from "../../types";
import { ReportBuilder } from "../report-builder";
import { verifyPdf, type PdfVerification } from "../verify";
import { buildReportMeta, type ReportContext, type ReportRenderSettings } from "./shared";
import { renderActivities } from "./report-activities";
import { renderFinance } from "./report-finance";
import { renderFollowUps } from "./report-followups";
import { renderLeads } from "./report-leads";
import { renderOtherRecords } from "./report-other";
import { renderOverview } from "./report-overview";
import { renderProjects } from "./report-projects";
import { renderSales } from "./report-sales";

type Renderer = (builder: ReportBuilder, ctx: ReportContext) => void;

const RENDERERS: Record<ReportKey, Renderer> = {
  overview: renderOverview,
  sales: renderSales,
  finance: renderFinance,
  leads: renderLeads,
  "projects-deals": renderProjects,
  followups: renderFollowUps,
  "activities-notes": renderActivities,
  "other-records": renderOtherRecords,
};

export interface GeneratedReport {
  reportKey: ReportKey;
  file: string;
  title: string;
  buffer: Buffer;
  pages: number;
  truncatedCells: number;
  verification: PdfVerification;
}

/** Renders a single PDF report (used by the ZIP pipeline and by the individual-report download). */
export async function generateReport(
  key: ReportKey,
  ctx: ReportContext,
  settings: ReportRenderSettings
): Promise<GeneratedReport> {
  const definition = getReportDefinition(key);
  const renderer = RENDERERS[key];
  if (!renderer) {
    throw new Error(`No renderer registered for report "${key}".`);
  }

  const builder = new ReportBuilder(buildReportMeta(definition, settings));
  renderer(builder, ctx);

  const buffer = await builder.finalize();
  const verification = verifyPdf(buffer);

  return {
    reportKey: key,
    file: definition.file,
    title: definition.title,
    buffer,
    pages: builder.pages,
    truncatedCells: builder.truncationCount(),
    verification,
  };
}

/**
 * Renders every report in catalogue order. A failure in any single report is surfaced to the
 * caller (never swallowed) so an incomplete ZIP can be reported as incomplete.
 */
export async function generateAllReports(
  ctx: ReportContext,
  settings: ReportRenderSettings,
  onReport?: (key: ReportKey, index: number, total: number) => void
): Promise<GeneratedReport[]> {
  const reports: GeneratedReport[] = [];
  for (let index = 0; index < REPORT_DEFINITIONS.length; index += 1) {
    const definition = REPORT_DEFINITIONS[index];
    onReport?.(definition.key, index, REPORT_DEFINITIONS.length);
    reports.push(await generateReport(definition.key, ctx, settings));
  }
  return reports;
}

export { buildRecordSummary, type ReportContext, type ReportRenderSettings } from "./shared";