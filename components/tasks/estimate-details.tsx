import type { Task } from "@/types/task";
import { effectiveEstimate, predictionExplanation, type DurationPrediction } from "@/lib/estimation/duration-estimation";
import { formatDuration } from "@/lib/tasks/task-rules";

export function EstimateDetails({ task, prediction }: { task: Task; prediction?: DurationPrediction }) {
  return (
    <details className="task-duration">
      <summary>Estimated: {prediction || task.estimatedMinutes !== null
        ? formatDuration(effectiveEstimate(task, prediction)) : "Loading history…"}</summary>
      <p>Manual: {task.estimatedMinutes === null ? "Automatic" : formatDuration(task.estimatedMinutes)}</p>
      <p>Prediction: {prediction?.minutes ? formatDuration(prediction.minutes) : "Unavailable"}</p>
      <p>{prediction ? predictionExplanation(prediction) : "History is loading or unavailable. Retry timing data if needed."}</p>
      {task.estimatedMinutes !== null ? <p>Manual estimate used for sorting and workload.</p> : null}
    </details>
  );
}
