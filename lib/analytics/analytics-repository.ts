import type { CompletionEstimate } from "../../types/analytics.ts";
export interface AnalyticsRepository {
  listEstimates(): Promise<CompletionEstimate[]>;
}
