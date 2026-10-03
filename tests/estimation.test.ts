import assert from "node:assert/strict";
import test from "node:test";
import type { Task } from "../types/task.ts";
import type { TimeSession } from "../types/time-session.ts";
import { effectiveEstimate, historicalObservations, predictDuration, predictTasks } from "../lib/estimation/duration-estimation.ts";
import { remainingMinutes, sortTasks, validateTask } from "../lib/tasks/task-rules.ts";
import { buildWeek } from "../lib/tasks/week-rules.ts";

function task(id: string, patch: Partial<Task> = {}): Task {
  return { id, title: id, categoryId: "school", priority: "medium", estimatedMinutes: null,
    dueDate: "2026-10-03", scheduledDate: "2026-10-03", createdAt: "2026-01-01T00:00:00Z",
    status: "completed", completedAt: `2026-01-${String(Number(id) + 1).padStart(2, "0")}T12:00:00Z`,
    deletedAt: null, ...patch };
}
function session(taskId: string, minutes: number, patch: Partial<TimeSession> = {}): TimeSession {
  return { id: taskId, taskId, userId: "owner", startedAt: "2025-12-01T00:00:00Z",
    endedAt: new Date(Date.parse("2025-12-01T00:00:00Z") + minutes * 60000).toISOString(),
    durationSeconds: minutes * 60, voidedAt: null, createdAt: "2025-12-01T00:00:00Z",
    updatedAt: "2025-12-01T01:00:00Z", ...patch };
}
const target = task("target", { status: "incomplete", completedAt: null });
const history = [task("1"), task("2"), task("3")];
const sessions = [session("1", 10), session("2", 20), session("3", 30)];
const observations = historicalObservations(history, sessions);

test("same-category prediction uses recent rank weights and nearest-five rounding", () => {
  const prediction = predictDuration(target, observations);
  assert.deepEqual(prediction, { minutes: 25, source: "category", sampleSize: 3, confidence: "medium" });
  const reversedDates = observations.map((row, index) => ({ ...row, completedAt: observations[2-index].completedAt }));
  assert.equal(predictDuration(target, reversedDates).minutes, 15);
});
test("global fallback requires enough overall observations and has low confidence", () => {
  assert.deepEqual(predictDuration({ ...target, categoryId: "other" }, observations),
    { minutes: 25, source: "global", sampleSize: 3, confidence: "low" });
  const mixed = observations.map((row, index) => ({ ...row, categoryId: index === 0 ? "school" : "other" }));
  assert.equal(predictDuration(target, mixed).source, "global");
});
test("zero, one, and two observations do not produce a prediction", () => {
  for (let count = 0; count < 3; count++) {
    const prediction = predictDuration(target, observations.slice(0, count));
    assert.deepEqual(prediction, { minutes: null, source: "fallback", sampleSize: count, confidence: "low" });
    assert.equal(effectiveEstimate(target, prediction), 25);
  }
});
test("only newest twenty observations are used, with deterministic timestamp ties", () => {
  const rows = Array.from({ length: 25 }, (_, index) => ({ taskId: String(index), categoryId: "school",
    completedAt: index, minutes: index < 5 ? 99999 : 10 }));
  assert.equal(predictDuration(target, rows).sampleSize, 20);
  assert.equal(predictDuration(target, rows).minutes, 10);
  const tied = rows.map((row) => ({ ...row, completedAt: 1 }));
  assert.deepEqual(predictDuration(target, tied), predictDuration(target, [...tied].reverse()));
});
test("confidence is heuristic: eight category samples are high; global always low", () => {
  const rows = Array.from({ length: 8 }, (_, index) => ({ ...observations[0], taskId: String(index) }));
  assert.equal(predictDuration(target, rows).confidence, "high");
  assert.equal(predictDuration({ ...target, categoryId: "other" }, rows).confidence, "low");
});
test("rounding has a five-minute floor and no upper cap on real task totals", () => {
  for (const [minutes, expected] of [[0.1, 5], [12.5, 15], [12.4, 10], [2001, 2000]]) {
    assert.equal(predictDuration(target, observations.map((row) => ({ ...row, minutes }))).minutes, expected);
  }
});
test("invalid, zero, negative, missing and nonfinite session durations are excluded", () => {
  for (const seconds of [0, -1, NaN, Infinity, null]) {
    assert.equal(historicalObservations([history[0]], [session("1", 10, { durationSeconds: seconds })]).length, 0);
  }
  for (const patch of [{ startedAt: "bad" }, { endedAt: "bad" }, { endedAt: "2020-01-01" }]) {
    assert.equal(historicalObservations([history[0]], [session("1", 10, patch)]).length, 0);
  }
  assert.equal(predictDuration(target, observations.map((row) => ({ ...row, minutes: NaN }))).minutes, null);
});
test("active tasks cannot train even alongside stopped sessions; voided sessions are excluded", () => {
  const active = session("1", 1, { id: "active", endedAt: null, durationSeconds: null });
  assert.equal(historicalObservations(history, [...sessions, active]).length, 2);
  assert.equal(historicalObservations(history, sessions.map((row) => ({ ...row, voidedAt: row.updatedAt }))).length, 0);
});
test("multiple stopped sessions accumulate and corrections/voids change future predictions", () => {
  const corrected = sessions.map((row) => row.taskId === "3" ? session("3", 60) : row);
  assert.equal(predictDuration(target, historicalObservations(history, corrected)).minutes, 40);
  const extra = session("3", 30, { id: "extra" });
  assert.equal(predictDuration(target, historicalObservations(history, [...sessions, extra])).minutes, 40);
  assert.equal(predictDuration(target, historicalObservations(history, [...sessions, { ...extra, voidedAt: extra.updatedAt }])).minutes, 25);
  assert.equal(predictDuration(target, historicalObservations(history, corrected.map((row) => row.taskId === "3" ? { ...row, voidedAt: row.updatedAt } : row))).minutes, null);
});
test("completed soft-deleted tasks retain truth; reopened tasks are ineligible until recompleted", () => {
  assert.equal(historicalObservations(history.map((row) => ({ ...row, deletedAt: "2026-02-01" })), sessions).length, 3);
  const reopened = history.map((row) => row.id === "3" ? { ...row, status: "incomplete" as const, completedAt: null } : row);
  assert.equal(predictDuration(target, historicalObservations(reopened, sessions)).minutes, null);
  const recompleted = reopened.map((row) => row.id === "3" ? { ...row, status: "completed" as const, completedAt: "2026-02-01" } : row);
  assert.equal(predictDuration(target, historicalObservations(recompleted, sessions)).minutes, 25);
  assert.equal(historicalObservations([{ ...history[0], completedAt: "invalid" }], sessions).length, 0);
});
test("manual overrides prediction; valid prediction overrides default; stored manual is never changed", () => {
  const prediction = predictDuration(target, observations);
  const manual = { ...target, estimatedMinutes: 7 };
  assert.equal(effectiveEstimate(manual, prediction), 7);
  assert.equal(manual.estimatedMinutes, 7);
  assert.equal(effectiveEstimate(target, { ...prediction, minutes: 40 }), 40);
  for (const minutes of [NaN, Infinity, 0, -10, null]) {
    assert.equal(effectiveEstimate(target, { ...prediction, minutes }), 25);
  }
  assert.equal(validateTask(target).estimatedMinutes, null);
});
test("identical inputs are deterministic, immutable, order-independent and exclude the target itself", () => {
  const before = structuredClone({ history, sessions });
  assert.deepEqual(predictTasks(history, sessions), predictTasks([...history].reverse(), [...sessions].reverse()));
  assert.deepEqual({ history, sessions }, before);
  assert.equal(predictDuration(history[0], observations).minutes, null);
});
test("Momentum and Today/Week workload share effective estimates; other sorts remain independent", () => {
  const planned = [target, { ...target, id: "manual", estimatedMinutes: 45, priority: "critical" as const },
    { ...target, id: "fallback", categoryId: "other" }];
  const predictions = predictTasks([...history, ...planned], [session("1", 30), session("2", 60), session("3", 90)]);
  assert.deepEqual(sortTasks(planned, "momentum", predictions).map((row) => row.id), ["manual", "fallback", "target"]);
  assert.equal(remainingMinutes(planned, predictions), 185);
  assert.equal(buildWeek(planned, "2026-09-28", predictions)[5].estimatedMinutes, 185);
  assert.deepEqual(sortTasks(planned, "priority", predictions), sortTasks(planned, "priority"));
  assert.deepEqual(sortTasks(planned, "deadline", predictions), sortTasks(planned, "deadline"));
  assert.equal(remainingMinutes([...planned, ...history, { ...target, id: "deleted", deletedAt: "2026-10-03" }], predictions), 185);
});
