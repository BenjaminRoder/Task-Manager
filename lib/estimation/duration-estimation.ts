import type { Task } from "../../types/task.ts";
import type { TimeSession } from "../../types/time-session.ts";

export const estimationRules = {
  minimumSamples: 3,
  maximumSamples: 20,
  defaultMinutes: 25,
  roundingMinutes: 5,
  highConfidenceSamples: 8,
} as const;

export interface DurationPrediction {
  minutes: number | null;
  source: "category" | "global" | "fallback";
  sampleSize: number;
  confidence: "low" | "medium" | "high";
}
export type Predictions = ReadonlyMap<string, DurationPrediction>;
export interface HistoricalObservation {
  taskId: string;
  categoryId: string;
  completedAt: number;
  minutes: number;
}

// The session ledger is authoritative: no active elapsed time or cached actuals.
export function historicalObservations(
  tasks: readonly Task[],
  sessions: readonly TimeSession[],
): HistoricalObservation[] {
  const totals = new Map<string, number>();
  const activeTasks = new Set<string>();
  for (const session of sessions) {
    if (session.voidedAt) continue;
    if (session.endedAt === null) {
      activeTasks.add(session.taskId);
      continue;
    }
    const start = Date.parse(session.startedAt);
    const end = Date.parse(session.endedAt);
    const seconds = session.durationSeconds;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start ||
      seconds === null || !Number.isFinite(seconds) || seconds <= 0) continue;
    totals.set(session.taskId, (totals.get(session.taskId) ?? 0) + seconds);
  }
  return tasks.flatMap((task) => {
    const completedAt = task.completedAt === null ? NaN : Date.parse(task.completedAt);
    const minutes = (totals.get(task.id) ?? 0) / 60;
    // Soft deletion preserves finished history. Reopening removes eligibility;
    // recompletion uses the accumulated ledger and latest completion timestamp.
    if (task.status !== "completed" || !Number.isFinite(completedAt) ||
      activeTasks.has(task.id) || !Number.isFinite(minutes) || minutes <= 0) return [];
    return [{ taskId: task.id, categoryId: task.categoryId, completedAt, minutes }];
  });
}

export function predictDuration(
  task: Pick<Task, "id" | "categoryId">,
  observations: readonly HistoricalObservation[],
): DurationPrediction {
  const recent = observations
    .filter((row) => row.taskId !== task.id && Number.isFinite(row.minutes) &&
      row.minutes > 0 && Number.isFinite(row.completedAt))
    .sort((a, b) => b.completedAt - a.completedAt || a.taskId.localeCompare(b.taskId));
  const category = recent.filter((row) => row.categoryId === task.categoryId);
  const source = category.length >= estimationRules.minimumSamples ? "category" : "global";
  const samples = (source === "category" ? category : recent).slice(0, estimationRules.maximumSamples);
  if (samples.length < estimationRules.minimumSamples) {
    return { minutes: null, source: "fallback", sampleSize: samples.length, confidence: "low" };
  }
  // Newest gets weight N, next N-1, ... oldest 1. Rank weighting needs no clock.
  const numerator = samples.reduce((sum, row, index) => sum + row.minutes * (samples.length - index), 0);
  const denominator = samples.length * (samples.length + 1) / 2;
  const rounding = estimationRules.roundingMinutes;
  const minutes = Math.max(rounding, Math.round(numerator / denominator / rounding) * rounding);
  return {
    minutes,
    source,
    sampleSize: samples.length,
    confidence: source === "category" && samples.length >= estimationRules.highConfidenceSamples
      ? "high" : source === "category" ? "medium" : "low",
  };
}

export function predictTasks(tasks: readonly Task[], sessions: readonly TimeSession[]): Predictions {
  const observations = historicalObservations(tasks, sessions);
  return new Map(tasks.map((task) => [task.id, predictDuration(task, observations)]));
}

export function effectiveEstimate(task: Pick<Task, "estimatedMinutes">, prediction?: DurationPrediction): number {
  const manual = task.estimatedMinutes;
  if (manual !== null && Number.isInteger(manual) && manual >= 1 && manual <= 1440) return manual;
  if (prediction?.minutes !== null && prediction?.minutes !== undefined &&
    Number.isFinite(prediction.minutes) && prediction.minutes > 0) return prediction.minutes;
  return estimationRules.defaultMinutes;
}

export function predictionExplanation(prediction: DurationPrediction): string {
  if (prediction.minutes === null) return `Not enough history yet (need ${estimationRules.minimumSamples} completed timed tasks).`;
  return `Based on ${prediction.sampleSize} recent ${prediction.source === "category" ? "same-category" : "overall"} completed tasks · ${prediction.confidence} confidence (heuristic).`;
}
