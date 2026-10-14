import { inr } from "@/lib/crm/format";
import { followUpTypeLabel } from "@/lib/crm/labels";
import type { AnalyticsData, FunnelStage } from "./types";
import type { LostReasonsAnalyticsData } from "@/features/lost-reasons/types";

export type Transition = {
  from: string;
  to: string;
  fromCount: number;
  toCount: number;
  conversion: number | null;
  dropOff: number | null;
  index: number;
};

export function transitions(stages: FunnelStage[]): Transition[] {
  if (!stages || stages.length <= 1) return [];
  return stages.slice(1).map((s, i) => {
    const prev = stages[i]!;
    const c = s.conversionFromPrev;
    return {
      from: prev.label,
      to: s.label,
      fromCount: prev.reached,
      toCount: s.reached,
      conversion: c,
      dropOff: c === null ? null : Math.max(0, 1 - c),
      index: i + 1,
    };
  });
}

/** Largest drop-off among transitions with verified history. */
export function bottleneck(stages: FunnelStage[]): Transition | null {
  const list = transitions(stages);
  const valid = list.filter((t) => t.dropOff !== null && t.fromCount >= 1);
  if (!valid.length) return null;
  return valid.sort((a, b) => b.dropOff! - a.dropOff!)[0] ?? null;
}

export const pct = (fraction: number, digits = 0) =>
  `${(fraction * 100).toFixed(digits)}%`;

export type Insight = {
  id: string;
  kind: "funnel" | "followup" | "revenue" | "lost" | "pipeline";
  title: string;
  detail: string;
  value: string;
  tone: "neutral" | "attention" | "positive";
};

/** Rule-based insights derived strictly from real production data. */
export function deriveInsights(
  data: AnalyticsData,
  lostReasons?: LostReasonsAnalyticsData
): Insight[] {
  const out: Insight[] = [];

  const b = bottleneck(data.funnel);
  if (b && b.dropOff !== null && b.dropOff > 0) {
    out.push({
      id: "bottleneck",
      kind: "funnel",
      tone: "attention",
      value: pct(b.dropOff),
      title: `${b.from} → ${b.to} has the largest measured drop-off.`,
      detail: `${b.fromCount - b.toCount} of ${b.fromCount} leads that reached ${b.from} did not reach ${b.to}.`,
    });
  }

  const f = data.followUpPerformance;
  if (f.overdue > 0) {
    out.push({
      id: "overdue",
      kind: "followup",
      tone: "attention",
      value: String(f.overdue),
      title: `${f.overdue} follow-up${f.overdue === 1 ? " is" : "s are"} overdue.`,
      detail: `Pending follow-ups past their scheduled time. Completion rate is ${pct(f.completionRate, 1)} excluding cancelled.`,
    });
  }

  const topType = [...f.byType].sort((a, b) => b.total - a.total)[0];
  if (topType && topType.total > 0) {
    const typeName = (followUpTypeLabel as Record<string, string>)[topType.type] || topType.type;
    out.push({
      id: "volume",
      kind: "followup",
      tone: "neutral",
      value: String(topType.total),
      title: `${typeName} has the highest follow-up volume.`,
      detail: `${topType.total} of ${f.created} follow-ups in this period.`,
    });
  }

  const outstanding = data.kpis.totalOutstanding ?? 0;
  if (outstanding > 0) {
    out.push({
      id: "outstanding",
      kind: "revenue",
      tone: "attention",
      value: inr(outstanding),
      title: `Outstanding collections total ${inr(outstanding)}.`,
      detail: `${(data.kpis.collectionRate ?? 0).toFixed(1)}% of contracted value from deals in this period has been received.`,
    });
  }

  if (lostReasons?.topReason && lostReasons.topReason.count > 0) {
    out.push({
      id: "loss",
      kind: "lost",
      tone: "neutral",
      value: String(lostReasons.topReason.count),
      title: `"${lostReasons.topReason.label}" is the most recorded lost reason.`,
      detail: `${lostReasons.topReason.count} of ${lostReasons.totalLost} lost leads (${lostReasons.topReason.percentage.toFixed(1)}%). Based on recorded reasons.`,
    });
  }

  const stagesWithVal = [...data.pipelineHealth.stages].sort((a, b) => b.value - a.value);
  const topStage = stagesWithVal[0];
  if (topStage && topStage.value > 0) {
    out.push({
      id: "pipeline",
      kind: "pipeline",
      tone: "neutral",
      value: inr(topStage.value),
      title: `${topStage.label} holds the most open pipeline value.`,
      detail: `${topStage.count} active ${topStage.count === 1 ? "lead" : "leads"} holding ${inr(topStage.value)}, current snapshot.`,
    });
  }

  return out;
}
