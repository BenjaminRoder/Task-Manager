import type { Task } from "../../types/task.ts";
import type { TimeSession } from "../../types/time-session.ts";

export const estimationRules = {
  minimumSamples: 3,
  maximumSamples: 20,
  defaultMinutes: 25,
  roundingMinutes: 5,
  highConfidenceSamples: 8,
} as const;

export type PredictionSource = "course_task_type" | "course" | "category_task_type" |
  "task_type" | "category" | "global" | "fallback";

export interface DurationPrediction {
  minutes: number | null;
  source: PredictionSource;
  sampleSize: number;
  confidence: "low" | "medium" | "high";
}
export type Predictions = ReadonlyMap<string, DurationPrediction>;
export interface HistoricalObservation {
  taskId: string;
  categoryId: string | null;
  courseId?: string | null;
  taskTypeId?: string | null;
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
    return [{ taskId: task.id, categoryId: task.categoryId, courseId: task.courseId ?? null,
      taskTypeId: task.taskTypeId ?? null, completedAt, minutes }];
  });
}

export function predictDuration(
  task: Pick<Task, "id" | "categoryId" | "courseId" | "taskTypeId">,
  observations: readonly HistoricalObservation[],
): DurationPrediction {
  const recent = observations
    .filter((row) => row.taskId !== task.id && Number.isFinite(row.minutes) &&
      row.minutes > 0 && Number.isFinite(row.completedAt))
    .sort((a, b) => b.completedAt - a.completedAt || a.taskId.localeCompare(b.taskId));
  // Missing dimensions never match each other as a specific classification.
  const levels: { source: PredictionSource; matches: (row: HistoricalObservation) => boolean }[] = [
    { source: "course_task_type", matches: (row) => !!task.courseId && !!task.taskTypeId && row.courseId === task.courseId && row.taskTypeId === task.taskTypeId },
    { source: "course", matches: (row) => !!task.courseId && row.courseId === task.courseId },
    { source: "category_task_type", matches: (row) => !!task.categoryId && !!task.taskTypeId && row.categoryId === task.categoryId && row.taskTypeId === task.taskTypeId },
    { source: "task_type", matches: (row) => !!task.taskTypeId && row.taskTypeId === task.taskTypeId },
    { source: "category", matches: (row) => !!task.categoryId && row.categoryId === task.categoryId },
    { source: "global", matches: () => true },
  ];
  let source: PredictionSource = "global";
  let samples = recent.slice(0, estimationRules.maximumSamples);
  for (const level of levels) {
    const comparable = recent.filter(level.matches);
    if (comparable.length < estimationRules.minimumSamples) continue;
    source = level.source;
    samples = comparable.slice(0, estimationRules.maximumSamples);
    break;
  }
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
    confidence: source !== "global" && samples.length >= estimationRules.highConfidenceSamples
      ? "high" : source !== "global" ? "medium" : "low",
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

export function predictionExplanation(prediction: DurationPrediction, labels: {
  category?: string; course?: string; taskType?: string;
} = {}): string {
  if (prediction.minutes === null) return `Not enough history yet (need ${estimationRules.minimumSamples} completed timed tasks).`;
  const comparisons: Record<PredictionSource, string> = {
    course_task_type: `${labels.course ?? "same-course"} ${labels.taskType ?? "same-type"}`,
    course: labels.course ?? "same-course",
    category_task_type: `${labels.category ?? "same-category"} ${labels.taskType ?? "same-type"}`,
    task_type: labels.taskType ?? "same-type",
    category: labels.category ?? "same-category",
    global: "overall",
    fallback: "overall",
  };
  return `Based on ${prediction.sampleSize} recent ${comparisons[prediction.source]} completed tasks · ${prediction.confidence} confidence (heuristic).`;
}
