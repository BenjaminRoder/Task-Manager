import test from "node:test";
import assert from "node:assert/strict";
import type { Task } from "../types/task.ts";
import { validateTask, formatDueTime, sortTasks } from "../lib/tasks/task-rules.ts";
import { groupWeekTasks, sortWeekTasks } from "../lib/tasks/week-organization.ts";
import { createWeekPreference, weekPreferenceKey } from "../lib/tasks/week-preference.ts";
import { createLocalStore, STORAGE_KEY } from "../lib/storage/local-store.ts";
import { createLocalTaskRepository } from "../lib/tasks/task-repository.ts";
import { detectLocalImport } from "../lib/storage/local-import.ts";
import { taskFromRow } from "../lib/supabase/repositories.ts";
import { buildWeek } from "../lib/tasks/week-rules.ts";

function task(id: string, fields: Partial<Task> = {}): Task {
  return { id, title: id, categoryId: null, priority: "medium", dueDate: "2026-10-04",
    scheduledDate: "2026-10-04", estimatedMinutes: 25, createdAt: "2026-10-01T00:00:00Z",
    status: "incomplete", completedAt: null, deletedAt: null, ...fields };
}

test("Week shortest-first preserves duration priority, time ties and completed-last without mutation", () => {
  const rows = [task("untimed"), task("noon", { dueTime: "12:00" }), task("midnight", { dueTime: "00:00" }),
    task("short", { estimatedMinutes: 5 }), task("done", { estimatedMinutes: 1, status: "completed" }),
    task("a", { dueTime: "12:00" }), task("long", { dueTime: "00:00", estimatedMinutes: 60 })];
  const before = structuredClone(rows);
  assert.deepEqual(sortWeekTasks(rows, "shortest").map(t => t.id), ["short", "midnight", "a", "noon", "untimed", "long", "done"]);
  assert.deepEqual(rows, before);
  assert.deepEqual(buildWeek(rows, "2026-09-28")[6].tasks.map(t => t.id), sortWeekTasks(rows, "shortest").map(t => t.id));
  assert.deepEqual(sortWeekTasks([...rows].reverse(), "shortest").map(t => t.id), sortWeekTasks(rows, "shortest").map(t => t.id));
  assert.deepEqual(sortTasks([task("late", { dueTime: "15:00" }), task("early", { dueTime: "09:00" }), task("none")], "deadline").map(t => t.id), ["early", "late", "none"]);
});

test("grouped Week modes use IDs, archived labels, Unassigned and chronological order before duration", () => {
  const records = [{ id: "one", name: "Same name", code: null, archivedAt: "2026-10-01", createdAt: "", updatedAt: "" },
    { id: "two", name: "Same name", code: null, archivedAt: null, createdAt: "", updatedAt: "" }];
  for (const mode of ["course", "task-type"] as const) {
    const link = mode === "course" ? "courseId" : "taskTypeId";
    const rows = [task("none"), task("other", { [link]: "two" }),
      task("late-short", { [link]: "one", dueTime: "16:00", estimatedMinutes: 1 }),
      task("early-long", { [link]: "one", dueTime: "09:00", estimatedMinutes: 90 }),
      task("early-short", { [link]: "one", dueTime: "09:00", estimatedMinutes: 5 }),
      task("early-a", { [link]: "one", dueTime: "09:00", estimatedMinutes: 5 }),
      task("untimed", { [link]: "one", estimatedMinutes: 1 }),
      task("done", { [link]: "one", status: "completed", dueTime: "00:00" })];
    const groups = groupWeekTasks(rows, mode, records, records);
    assert.deepEqual(groups.find(g => g.label === "Same name (archived)")?.tasks.map(t => t.id),
      ["early-a", "early-short", "early-long", "late-short", "untimed"]);
    assert.deepEqual(groups.find(g => g.label === "Unassigned")?.tasks.map(t => t.id), ["none"]);
    assert.equal(groups.filter(g => g.label?.startsWith("Same name")).length, 2);
    assert.equal(groups.at(-1)?.tasks[0].id, "done");
  }
});

test("due time validates minute precision, requires date, normalizes legacy records and formats midnight/noon", () => {
  for (const dueTime of ["24:00", "12:30:01", "12:30:00", "9:00", "12:60", "", "noon"]) {
    assert.throws(() => validateTask(task("bad", { dueTime })));
  }
  assert.throws(() => validateTask(task("bad", { dueDate: null, dueTime: "12:00" })));
  assert.equal(validateTask(task("old")).dueTime, null);
  assert.equal(validateTask(task("clear-time", { dueTime: null })).dueDate, "2026-10-04");
  assert.equal(validateTask(task("clear-date", { dueDate: null, dueTime: null })).dueTime, null);
  assert.equal(formatDueTime("00:00"), "12am");
  assert.equal(formatDueTime("12:00"), "12pm");
  assert.equal(formatDueTime("13:05"), "1:05pm");
  const row = { id: "old", title: "Old", category_id: null, priority: "medium" as const, due_date: "2026-10-04",
    scheduled_date: "2026-10-04", estimated_minutes: null, status: "incomplete" as const,
    created_at: "", completed_at: null, deleted_at: null };
  assert.equal(taskFromRow(row).dueTime, null);
  assert.equal(taskFromRow({ ...row, due_time: "12:05:00" }).dueTime, "12:05");
});

test("Week preference is account scoped, persists, falls back for invalid values and tolerates unavailable storage", () => {
  const map = new Map<string, string>();
  const storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } };
  const first = createWeekPreference(() => storage, "alice");
  assert.equal(first.read(), "shortest");
  let notified = 0;
  const unsubscribe = first.subscribe(() => notified++);
  first.write("course");
  assert.equal(notified, 1); unsubscribe();
  assert.equal(createWeekPreference(() => storage, "alice").read(), "course");
  assert.equal(createWeekPreference(() => storage, "bob").read(), "shortest");
  map.set(weekPreferenceKey("alice"), "invalid");
  assert.equal(first.read(), "shortest");
  const blocked = createWeekPreference(() => { throw Error("Denied"); }, "alice");
  assert.equal(blocked.read(), "shortest"); blocked.write("task-type");
  assert.equal(blocked.read(), "task-type");
  const writeBlocked = createWeekPreference(() => ({ ...storage, setItem: () => { throw Error("Quota"); } }), "alice");
  writeBlocked.write("course"); assert.equal(writeBlocked.read(), "course");
});

test("recovery preserves due times, rejects malformed times, and preserves legacy import fingerprints", async () => {
  const map = new Map<string, string>();
  const storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } };
  const data = { version: 2, categories: [], tasks: [task("legacy")] };
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
  const legacy = await detectLocalImport(storage);
  storage.setItem(STORAGE_KEY, JSON.stringify({ ...data, tasks: [task("legacy", { dueTime: null })] }));
  assert.equal((await detectLocalImport(storage))?.datasetId, legacy?.datasetId);
  const repository = createLocalTaskRepository(createLocalStore(() => storage));
  await repository.update("legacy", task("legacy", { dueTime: "12:00" }));
  assert.equal((await repository.list())[0].dueTime, "12:00");
  assert.notEqual((await detectLocalImport(storage))?.datasetId, legacy?.datasetId);
  await repository.update("legacy", task("legacy", { dueTime: null }));
  assert.equal((await repository.list())[0].dueDate, "2026-10-04");
  storage.setItem(STORAGE_KEY, JSON.stringify({ ...data, tasks: [task("legacy", { dueTime: "25:00" })] }));
  await assert.rejects(repository.list(), /left untouched/);
});
