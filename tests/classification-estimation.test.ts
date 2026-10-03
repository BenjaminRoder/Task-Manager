import test from "node:test";
import assert from "node:assert/strict";
import type { Task } from "../types/task.ts";
import { effectiveEstimate, predictDuration, predictionExplanation, type HistoricalObservation, type PredictionSource } from "../lib/estimation/duration-estimation.ts";
import { remainingMinutes, sortTasks, validateTask } from "../lib/tasks/task-rules.ts";
import { buildWeek } from "../lib/tasks/week-rules.ts";
import { validateCourse, validateTaskType } from "../lib/classification/classification-rules.ts";

const target: Task = {
  id: "target", title: "Chapter 7", categoryId: "school", courseId: "acct", taskTypeId: "homework",
  priority: "medium", status: "incomplete", estimatedMinutes: null,
  dueDate: "2026-10-03", scheduledDate: "2026-10-03", createdAt: "2026-01-01", completedAt: null, deletedAt: null,
};
function observations(patch: Partial<HistoricalObservation> = {}, prefix = "sample", count = 3): HistoricalObservation[] {
  return Array.from({ length: count }, (_, index) => ({
    taskId: `${prefix}-${index}`, categoryId: "school", courseId: "acct", taskTypeId: "homework",
    completedAt: Date.parse(`2026-01-0${index + 1}`), minutes: 60, ...patch,
  }));
}
const sources: [PredictionSource, Partial<HistoricalObservation>][] = [
  ["course_task_type", {}],
  ["course", { taskTypeId: "exam" }],
  ["category_task_type", { courseId: "econ" }],
  ["task_type", { courseId: "econ", categoryId: "work" }],
  ["category", { courseId: "econ", taskTypeId: "exam" }],
  ["global", { courseId: "econ", taskTypeId: "exam", categoryId: "work" }],
];
for (const [source, patch] of sources) {
  test(`full hierarchy independently selects ${source}`, () => {
    const prediction = predictDuration(target, observations(patch));
    assert.equal(prediction.source, source);
    assert.equal(prediction.sampleSize, 3);
    assert.equal(prediction.minutes, 60);
    assert.equal(prediction.confidence, source === "global" ? "low" : "medium");
  });
}
test("classification fallback needs three observations; two are never represented as a specific group", () => {
  assert.deepEqual(predictDuration(target, observations({}, "short", 2)),
    { minutes: null, source: "fallback", sampleSize: 2, confidence: "low" });
  for (let level = 0; level < sources.length - 1; level++) {
    const rows = [...observations(sources[level][1], "specific", 2), ...observations(sources[level + 1][1], "broader", 4)];
    const prediction = predictDuration(target, rows);
    assert.equal(prediction.source, sources[level + 1][0]);
    // Course -> category/type and type -> category are overlapping dimensions,
    // not nested sets: only the four matching broader rows count there.
    assert.equal(prediction.sampleSize, [6, 4, 6, 4, 6][level]);
  }
});
test("hierarchy precedence wins over more numerous, newer broader observations", () => {
  for (let level = 0; level < sources.length - 1; level++) {
    const rows = [...observations(sources[level][1]), ...observations({ ...sources[level + 1][1], minutes: 300, completedAt: Date.parse("2026-02-01") }, "broader", 8)];
    assert.equal(predictDuration(target, rows).source, sources[level][0]);
    assert.equal(predictDuration(target, rows).minutes, 60);
  }
});
test("null or missing dimensions do not form fake specific comparison groups", () => {
  const rows = observations({ categoryId: null, courseId: null, taskTypeId: null });
  assert.equal(predictDuration({ ...target, categoryId: null, courseId: null, taskTypeId: null }, rows).source, "global");
  assert.equal(predictDuration({ ...target, courseId: null, taskTypeId: null }, observations()).source, "category");
  assert.equal(predictDuration({ ...target, categoryId: null, taskTypeId: null }, observations()).source, "course");
  assert.equal(predictDuration({ ...target, categoryId: null, courseId: null }, observations()).source, "task_type");
});
test("specific matching keeps the M4 cap, weights, rounding, determinism and confidence rules", () => {
  const rows = Array.from({ length: 25 }, (_, index) => ({ ...observations()[0], taskId: String(index), completedAt: index, minutes: index < 5 ? 10000 : 10 }));
  const prediction = predictDuration(target, rows);
  assert.deepEqual(prediction, { minutes: 10, source: "course_task_type", confidence: "high", sampleSize: 20 });
  assert.deepEqual(prediction, predictDuration(target, [...rows].reverse()));
  const weighted = observations().map((row, index) => ({ ...row, minutes: [10, 20, 30][index] }));
  assert.equal(predictDuration(target, weighted).minutes, 25);
});
test("explanations identify named comparison levels and heuristic confidence", () => {
  for (const [source, patch] of sources) {
    const explanation = predictionExplanation(predictDuration(target, observations(patch)), { course: "ACCT 151", taskType: "Homework", category: "School" });
    if (source.includes("course")) assert.match(explanation, /ACCT 151/);
    if (source.includes("task_type")) assert.match(explanation, /Homework/);
    if (source.includes("category")) assert.match(explanation, /School/);
    assert.match(explanation, /3 recent/);
    assert.match(explanation, /heuristic/);
  }
});
test("classified predictions flow unchanged into Momentum and Today/Week with manual precedence", () => {
  const manual = { ...target, id: "manual", estimatedMinutes: 45, priority: "critical" as const };
  const prediction = predictDuration(target, observations());
  const predictions = new Map([[target.id, prediction], [manual.id, prediction]]);
  assert.equal(effectiveEstimate(manual, prediction), 45);
  assert.deepEqual(sortTasks([target, manual], "momentum", predictions).map((row) => row.id), ["manual", "target"]);
  assert.equal(remainingMinutes([target, manual], predictions), 105);
  assert.equal(buildWeek([target, manual], "2026-09-28", predictions)[5].estimatedMinutes, 105);
  assert.deepEqual(sortTasks([target, manual], "priority", predictions), sortTasks([target, manual], "priority"));
  assert.deepEqual(sortTasks([target, manual], "deadline", predictions), sortTasks([target, manual], "deadline"));
});
test("classification validation accepts optional assignments and trims names/codes while rejecting bad input", () => {
  assert.deepEqual(validateCourse({ name: " Accounting ", code: " ACCT 151 " }), { name: "Accounting", code: "ACCT 151" });
  assert.deepEqual(validateCourse({ name: "Japanese" }), { name: "Japanese", code: null });
  assert.deepEqual(validateTaskType({ name: " Homework " }), { name: "Homework" });
  assert.equal(validateTask({ ...target, categoryId: null, courseId: null, taskTypeId: null }).categoryId, null);
  assert.throws(() => validateCourse({ name: " " }));
  assert.throws(() => validateCourse({ name: "Accounting", code: "x".repeat(21) }));
  assert.throws(() => validateTaskType({ name: "x".repeat(61) }));
  assert.throws(() => validateTask({ ...target, courseId: " " }));
  assert.throws(() => validateTask({ ...target, taskTypeId: "x".repeat(201) }));
});
