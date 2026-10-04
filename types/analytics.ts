import type { PredictionSource } from "../lib/estimation/duration-estimation.ts";

export interface CompletionEstimate {
  id: string;
  taskId: string;
  completedAt: string;
  manualMinutes: number | null;
  predictedMinutes: number | null;
  effectiveMinutes: number;
  effectiveSource: "manual" | "prediction" | "default";
  predictionSource: PredictionSource;
  sampleSize: number;
}
