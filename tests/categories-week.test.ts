import assert from "node:assert/strict";
import { test } from "node:test";
import type { Task, TaskInput } from "../types/task.ts";
import {
  createLocalStore,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
} from "../lib/storage/local-store.ts";
import { createLocalTaskRepository } from "../lib/tasks/task-repository.ts";
import { createLocalCategoryRepository } from "../lib/categories/category-repository.ts";
import {
  addCalendarDays,
  buildWeek,
  startOfWeek,
} from "../lib/tasks/week-rules.ts";

const input: TaskInput = {
  title: "Accounting homework",
  categoryId: "",
  priority: "high",
  dueDate: "2026-09-30",
  scheduledDate: "2026-09-28",
  estimatedMinutes: 25,
};
function legacyTask(
  id: string,
  category: string,
  extra: Record<string, unknown> = {},
) {
  const { categoryId, ...fields } = input;
  void categoryId;
  return {
    ...fields,
    id,
    category,
    status: "incomplete",
    createdAt: "2026-09-27T15:00:00.000Z",
    completedAt: null,
    deletedAt: null,
    ...extra,
  };
}
function fixture(legacy?: string) {
  const values = new Map<string, string>();
  if (legacy !== undefined) values.set(LEGACY_STORAGE_KEY, legacy);
  const store = createLocalStore(() => ({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  }));
  return {
    values,
    store,
    tasks: createLocalTaskRepository(store),
    categories: createLocalCategoryRepository(store),
  };
}

test("Migration deduplicates names and preserves every task, including history, with an untouched v1 recovery copy", async () => {
  const originals = [
    legacyTask("a", "Accounting"),
    legacyTask("b", "Accounting", {
      status: "completed",
      completedAt: "2026-09-28T16:00:00.000Z",
    }),
    legacyTask("c", " accounting ", { deletedAt: "2026-09-28T17:00:00.000Z" }),
    legacyTask("d", "Reading"),
  ];
  const raw = JSON.stringify({ version: 1, tasks: originals });
  const { store, values, tasks, categories } = fixture(raw);
  const migrated = store.read();
  assert.equal(migrated.tasks.length, 4);
  assert.equal(migrated.categories.length, 2);
  assert.equal((await tasks.list()).length, 3);
  assert.equal(values.get(LEGACY_STORAGE_KEY), raw);
  const [accounting] = await categories.list();
  for (const [index, task] of migrated.tasks.entries()) {
    const { category, ...expected } = originals[index];
    void category;
    const { categoryId, ...actual } = task;
    assert.deepEqual(actual, expected);
    if (index < 3) assert.equal(categoryId, accounting.id);
  }
  const saved = values.get(STORAGE_KEY);
  assert.deepEqual(store.read(), migrated);
  assert.equal(values.get(STORAGE_KEY), saved);
  values.set(LEGACY_STORAGE_KEY, JSON.stringify({ version: 1, tasks: [] }));
  assert.equal(
    store.read().tasks.length,
    4,
    "v2 takes precedence after migration",
  );
});

test("Migration failure never writes partial data or replaces the legacy document", () => {
  const broken = JSON.stringify({
    version: 1,
    tasks: [
      legacyTask("a", "Accounting"),
      legacyTask("b", "Reading", { estimatedMinutes: -2 }),
    ],
  });
  const { store, values } = fixture(broken);
  assert.throws(() => store.read(), /left untouched/);
  assert.equal(values.has(STORAGE_KEY), false);
  assert.equal(values.get(LEGACY_STORAGE_KEY), broken);
  const valid = JSON.stringify({
    version: 1,
    tasks: [legacyTask("a", "Accounting")],
  });
  const full = createLocalStore(() => ({
    getItem: (key) => (key === LEGACY_STORAGE_KEY ? valid : null),
    setItem: () => {
      throw new Error("quota");
    },
  }));
  assert.throws(() => full.read(), /could not be saved/);
});

test("Invalid v2 category references are preserved for recovery, never replaced with v1 data", () => {
  const { store, values } = fixture(JSON.stringify({ version: 1, tasks: [] }));
  const valid = store.read();
  const invalid = JSON.stringify({
    ...valid,
    tasks: [{ ...legacyTask("a", "Accounting"), categoryId: "missing" }],
  });
  values.set(STORAGE_KEY, invalid);
  assert.throws(() => store.read(), /left untouched/);
  assert.equal(values.get(STORAGE_KEY), invalid);
});

test("Custom categories, renaming, colors, and task reassignment persist through the same stable IDs", async () => {
  const { tasks, categories, store } = fixture();
  await categories.create({ name: "  Club Work  ", color: "#8256B4" });
  await categories.create({ name: "Hockey", color: "#ffffff" });
  const club = (await categories.list()).find(
    (category) => category.name === "Club Work",
  )!;
  const hockey = (await categories.list()).find(
    (category) => category.name === "Hockey",
  )!;
  assert.equal(club.color, "#8256b4");
  await tasks.create({ ...input, categoryId: club.id });
  const [task] = await tasks.list();
  await categories.update(club.id, { name: "Clubs", color: "#356cc4" });
  assert.equal((await tasks.list())[0].categoryId, club.id);
  assert.deepEqual(
    store.read().categories.find((category) => category.id === club.id),
    { ...club, name: "Clubs", color: "#356cc4" },
  );
  await tasks.update(task.id, { ...input, categoryId: hockey.id });
  assert.equal((await tasks.list())[0].categoryId, hockey.id);
  const fresh = createLocalCategoryRepository(store);
  assert.equal(
    (await fresh.list()).find((category) => category.id === club.id)!.name,
    "Clubs",
  );
  await assert.rejects(
    tasks.create({ ...input, categoryId: "nonexistent" }),
    /existing category/,
  );
});

test("Archiving preserves active, completed, and deleted relationships; blocks new assignments and supports restoration", async () => {
  const { tasks, categories, store } = fixture(
    JSON.stringify({
      version: 1,
      tasks: [
        legacyTask("a", "School"),
        legacyTask("b", "School", {
          status: "completed",
          completedAt: "2026-09-28T16:00:00Z",
        }),
        legacyTask("c", "School", { deletedAt: "2026-09-28T17:00:00Z" }),
      ],
    }),
  );
  const [school] = await categories.list();
  await categories.setArchived(school.id, true);
  assert.ok((await categories.list())[0].archivedAt);
  assert.equal(
    store.read().tasks.filter((task) => task.categoryId === school.id).length,
    3,
  );
  await tasks.update("a", {
    ...input,
    categoryId: school.id,
    title: "Still editable",
  });
  await assert.rejects(
    tasks.create({ ...input, categoryId: school.id }),
    /archived/,
  );
  await categories.create({ name: "Research", color: "#267e86" });
  const research = (await categories.list()).find(
    (category) => category.name === "Research",
  )!;
  await tasks.create({ ...input, categoryId: research.id });
  const other = (await tasks.list()).find(
    (task) => task.categoryId === research.id,
  )!;
  await assert.rejects(
    tasks.update(other.id, { ...input, categoryId: school.id }),
    /archived/,
  );
  await categories.setArchived(school.id, false);
  await tasks.update(other.id, { ...input, categoryId: school.id });
  assert.equal((await categories.list())[0].archivedAt, null);
});

test("Category validation rejects blank names, invalid colors, and duplicate names including archived categories", async () => {
  const { categories } = fixture();
  const [initial] = await categories.list();
  await assert.rejects(
    categories.create({ name: " ", color: "#356cc4" }),
    /name/,
  );
  await assert.rejects(
    categories.create({ name: "School", color: "red" }),
    /color/,
  );
  await assert.rejects(
    categories.create({ name: initial.name.toUpperCase(), color: "#356cc4" }),
    /already exists/,
  );
  await categories.setArchived(initial.id, true);
  await assert.rejects(
    categories.create({ name: initial.name, color: "#356cc4" }),
    /already exists/,
  );
  await categories.create({ name: "Other", color: "#356cc4" });
  const other = (await categories.list()).find(
    (category) => category.name === "Other",
  )!;
  await assert.rejects(
    categories.update(other.id, { name: initial.name, color: "#356cc4" }),
    /already exists/,
  );
});

test("Week date arithmetic handles Sundays, year boundaries, leap years, and DST weeks", () => {
  assert.equal(startOfWeek("2026-09-28"), "2026-09-28");
  assert.equal(startOfWeek("2026-10-04"), "2026-09-28");
  assert.equal(startOfWeek("2027-01-01"), "2026-12-28");
  assert.equal(addCalendarDays("2026-12-28", 7), "2027-01-04");
  assert.equal(addCalendarDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addCalendarDays("2026-03-08", 1), "2026-03-09");
  assert.equal(addCalendarDays("2026-11-01", -1), "2026-10-31");
});

test("Week uses due dates, counts and sums only incomplete tasks, retains completed tasks, and excludes undated/deleted tasks", () => {
  const make = (id: string, overrides: Partial<Task> = {}): Task => ({
    ...input,
    categoryId: "school",
    id,
    status: "incomplete",
    createdAt: "2026-09-28T12:00:00Z",
    completedAt: null,
    deletedAt: null,
    ...overrides,
  });
  const tasks = [
    make("a", {
      dueDate: "2026-09-28",
      scheduledDate: "2026-10-10",
      estimatedMinutes: 15,
    }),
    make("b", { dueDate: "2026-09-28", estimatedMinutes: 45 }),
    make("done", {
      dueDate: "2026-09-28",
      status: "completed",
      completedAt: "2026-09-27T12:00:00Z",
    }),
    make("sunday", { dueDate: "2026-10-04" }),
    make("undated", { dueDate: null }),
    make("deleted", {
      dueDate: "2026-09-28",
      deletedAt: "2026-09-28T13:00:00Z",
    }),
    make("next-week", { dueDate: "2026-10-05" }),
  ];
  const week = buildWeek(tasks, "2026-09-28");
  assert.equal(week.length, 7);
  assert.deepEqual(
    week[0].tasks.map((task) => task.id),
    ["a", "b", "done"],
  );
  assert.equal(week[0].incompleteCount, 2);
  assert.equal(week[0].estimatedMinutes, 60);
  assert.equal(week[1].incompleteCount, 0);
  assert.equal(week[1].estimatedMinutes, 0);
  assert.equal(week[6].tasks[0].id, "sunday");
  assert.equal(week.flatMap((day) => day.tasks).length, 4);
  const next = buildWeek(tasks, "2026-10-05");
  assert.equal(next[0].tasks[0].id, "next-week");
});
