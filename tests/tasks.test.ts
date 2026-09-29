import assert from "node:assert/strict";
import { test } from "node:test";
import type { Task, TaskInput } from "../types/task.ts";
import {
  createLocalTaskRepository,
  STORAGE_KEY,
} from "../lib/tasks/task-repository.ts";
import {
  isDate,
  localDate,
  remainingMinutes,
  sortTasks,
  tasksForToday,
  validateTask,
} from "../lib/tasks/task-rules.ts";

const input: TaskInput = {
  title: "Read chapter",
  category: "School",
  priority: "medium",
  estimatedMinutes: 25,
  dueDate: null,
  scheduledDate: "2026-09-28",
};
function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    ...input,
    id,
    status: "incomplete",
    createdAt: "2026-09-28T12:00:00.000Z",
    completedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

test("Momentum, priority, and deadline ordering are independent and do not mutate input", () => {
  const tasks = [
    task("a", {
      estimatedMinutes: 45,
      priority: "critical",
      dueDate: "2026-10-02",
    }),
    task("b", { estimatedMinutes: 8, priority: "low", dueDate: "2026-09-29" }),
    task("c", { estimatedMinutes: 25, priority: "high" }),
    task("d", {
      estimatedMinutes: 1,
      status: "completed",
      completedAt: "2026-09-28T13:00:00.000Z",
    }),
  ];
  const before = structuredClone(tasks);
  assert.deepEqual(
    sortTasks(tasks, "momentum").map((t) => t.id),
    ["b", "c", "a", "d"],
  );
  assert.deepEqual(
    sortTasks(tasks, "priority").map((t) => t.id),
    ["a", "c", "b", "d"],
  );
  assert.deepEqual(
    sortTasks(tasks, "deadline").map((t) => t.id),
    ["b", "a", "c", "d"],
  );
  assert.deepEqual(tasks, before);
});

test("Today includes carryover and overdue work, excludes future and deleted work, and only shows today's completions", () => {
  const tasks = [
    task("today"),
    task("carryover", { scheduledDate: "2026-09-27" }),
    task("overdue", { scheduledDate: "2026-10-01", dueDate: "2026-09-27" }),
    task("future", { scheduledDate: "2026-10-01" }),
    task("done", {
      status: "completed",
      completedAt: new Date(2026, 8, 28, 12).toISOString(),
    }),
    task("old-done", {
      status: "completed",
      completedAt: new Date(2026, 8, 27, 12).toISOString(),
    }),
    task("deleted", { deletedAt: "2026-09-28T14:00:00.000Z" }),
  ];
  const today = tasksForToday(tasks, "2026-09-28");
  assert.deepEqual(
    today.map((t) => t.id),
    ["today", "carryover", "overdue", "done"],
  );
  assert.equal(remainingMinutes(today), 75);
});

test("Dates use local calendar days; impossible dates and invalid inputs are rejected", () => {
  assert.equal(localDate(new Date(2026, 8, 28, 23, 59)), "2026-09-28");
  assert.equal(isDate("2026-02-30"), false);
  assert.equal(isDate("2028-02-29"), true);
  assert.equal(validateTask({ ...input, title: "  Read  " }).title, "Read");
  for (const patch of [
    { title: "   " },
    { category: " " },
    { estimatedMinutes: 0 },
    { estimatedMinutes: 1.5 },
    { estimatedMinutes: 1441 },
    { dueDate: "2026-02-30" },
  ]) {
    assert.throws(() => validateTask({ ...input, ...patch }));
  }
});

test("Repository persists creation, edits, completion, reopening, and soft deletion across instances", async () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  const repository = createLocalTaskRepository(() => storage);
  assert.deepEqual(await repository.list(), []);
  await repository.create(input);
  const [created] = await repository.list();
  await repository.update(created.id, {
    ...input,
    title: "Read chapter two",
    estimatedMinutes: 40,
  });
  const freshRepository = createLocalTaskRepository(() => storage);
  assert.equal((await freshRepository.list())[0].title, "Read chapter two");
  await freshRepository.setStatus(created.id, "completed");
  assert.ok((await repository.list())[0].completedAt);
  await freshRepository.setStatus(created.id, "incomplete");
  assert.equal((await repository.list())[0].completedAt, null);
  await freshRepository.remove(created.id);
  assert.deepEqual(await repository.list(), []);
  const stored = JSON.parse(data.get(STORAGE_KEY)!);
  assert.ok(stored.tasks[0].deletedAt);
  assert.equal(stored.tasks[0].estimatedMinutes, 40);
  await assert.rejects(
    repository.update(created.id, input),
    /no longer available/,
  );
});

test("Corrupt or unsupported storage is not overwritten", async () => {
  for (const raw of [
    "bad JSON",
    JSON.stringify({ version: 2, tasks: [] }),
    JSON.stringify({ version: 1, tasks: [{ title: "broken" }] }),
  ]) {
    let value = raw;
    const repository = createLocalTaskRepository(() => ({
      getItem: () => value,
      setItem: (_key, next) => {
        value = next;
      },
    }));
    await assert.rejects(repository.list(), /left untouched/);
    await assert.rejects(repository.create(input), /left untouched/);
    assert.equal(value, raw);
  }
});

test("Unavailable storage and failed writes report actionable errors", async () => {
  const blocked = createLocalTaskRepository(() => {
    throw new Error("denied");
  });
  await assert.rejects(blocked.list(), /Allow site storage/);
  const full = createLocalTaskRepository(() => ({
    getItem: () => null,
    setItem: () => {
      throw new Error("quota exceeded");
    },
  }));
  await assert.rejects(full.create(input), /could not be saved/);
});
