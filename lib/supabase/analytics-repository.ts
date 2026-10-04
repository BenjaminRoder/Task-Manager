import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompletionEstimate } from "../../types/analytics.ts";
import type { AnalyticsRepository } from "../analytics/analytics-repository.ts";

export interface EstimateRow {
  id: string; task_id: string; completed_at: string;
  manual_minutes: number | null; predicted_minutes: number | null;
  effective_minutes: number; effective_source: CompletionEstimate["effectiveSource"];
  prediction_source: CompletionEstimate["predictionSource"]; sample_size: number;
}
export function estimateFromRow(row: EstimateRow): CompletionEstimate {
  return { id: row.id, taskId: row.task_id, completedAt: row.completed_at,
    manualMinutes: row.manual_minutes === null ? null : Number(row.manual_minutes),
    predictedMinutes: row.predicted_minutes === null ? null : Number(row.predicted_minutes),
    effectiveMinutes: Number(row.effective_minutes), effectiveSource: row.effective_source,
    predictionSource: row.prediction_source, sampleSize: row.sample_size };
}
export function createAnalyticsRepository(client: SupabaseClient, userId: string): AnalyticsRepository {
  return { async listEstimates() {
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || auth.user?.id !== userId) throw new Error("Your session changed. Sign in again.");
    const result: CompletionEstimate[] = [];
    for (let start = 0; ; start += 500) {
      const { data, error } = await client.from("completion_estimates").select("*")
        .eq("user_id", userId).order("id").range(start, start + 499);
      if (error) throw new Error(`Could not load completion estimates: ${error.message}. Check that the M6 migration is applied, then reload analytics.`);
      result.push(...((data ?? []) as EstimateRow[]).map(estimateFromRow));
      if (!data || data.length < 500) return result;
    }
  } };
}
