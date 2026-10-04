"use client";

// Explicit browser-only UI fixture. It never connects to Supabase and is mounted
// by the runner in a temporary Next app, never in the production application.
import { useMemo, useState } from "react";
import { TaskBoard } from "@/components/tasks/task-board";
import { WeekBoard } from "@/components/tasks/week-board";
import { RepositoryContext } from "@/lib/supabase/repository-context";
import { TimerProvider } from "@/lib/timers/timer-provider";
import { localDate, validateTask } from "@/lib/tasks/task-rules";
import type { Task } from "@/types/task";
import type { Category } from "@/types/category";
import type { Course } from "@/types/course";
import type { TaskType } from "@/types/task-type";
import type { TimeSession } from "@/types/time-session";
import type { TimeSessionRepository } from "@/lib/timers/time-session-repository";

import type { Topic } from "@/types/topic";

interface FixtureData {
  topics: Topic[]; tasks: Task[]; categories: Category[]; courses: Course[]; taskTypes: TaskType[]; sessions: TimeSession[];
}
const key = "task-manager.classification.ui.fixture.v1";
function read(): FixtureData {
  const saved = localStorage.getItem(key);
  if (saved) return JSON.parse(saved) as FixtureData;
  const today = localDate();
  const tasks: Task[] = [1, 2, 3].map((index) => ({
    id: `history-${index}`, title: `Timed homework ${index}`, categoryId: "school", courseId: "acct", taskTypeId: "hw",
    priority: "medium", estimatedMinutes: null, dueDate: null, scheduledDate: today, createdAt: "2026-01-01T00:00:00Z",
    status: "completed", completedAt: `2026-01-0${index}T12:00:00Z`, deletedAt: null,
  }));
  const data: FixtureData = {
    tasks,
    topics: [],
    categories: [{ id: "school", name: "School", color: "#23624c", archivedAt: null }],
    courses: [{ id: "acct", name: "Accounting", code: "ACCT 151", archivedAt: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" }],
    taskTypes: [{ id: "hw", name: "Homework", archivedAt: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" }],
    sessions: tasks.map((task, index) => ({ id: task.id, taskId: task.id, userId: "fixture",
      startedAt: "2026-01-01T00:00:00Z", endedAt: new Date(Date.parse("2026-01-01") + (index + 1) * 30 * 60000).toISOString(),
      durationSeconds: (index + 1) * 1800, voidedAt: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" })),
  };
  write(data); return data;
}
function write(data: FixtureData) { localStorage.setItem(key, JSON.stringify(data)); }
function changeTask(id: string, update: (task: Task) => void) {
  const data = read(); const task = data.tasks.find((row) => row.id === id)!;
  update(task); write(data);
}

export default function ClassificationFixture() {
  const [week, setWeek] = useState(false);
  const repositories = useMemo(() => ({ analytics: { listEstimates: async () => [] },
    tasks: {
      async list(includeDeleted = false) { return read().tasks.filter((task) => includeDeleted || !task.deletedAt); },
      async create(input: Parameters<typeof validateTask>[0]) {
        const data = read(); data.tasks.push({ ...validateTask(input), id: crypto.randomUUID(), status: "incomplete", createdAt: new Date().toISOString(), completedAt: null, deletedAt: null }); write(data);
      },
      async update(id: string, input: Parameters<typeof validateTask>[0]) { changeTask(id, (task) => Object.assign(task, validateTask(input))); },
      async setStatus(id: string, status: Task["status"]) { changeTask(id, (task) => { task.status = status; task.completedAt = status === "completed" ? new Date().toISOString() : null; }); },
      async remove(id: string) { changeTask(id, (task) => { task.deletedAt = new Date().toISOString(); }); },
    },
    categories: {
      async list() { return read().categories; },
      async create(input: Pick<Category, "name" | "color">) { const data = read(); data.categories.push({ ...input, id: crypto.randomUUID(), archivedAt: null }); write(data); },
      async update(id: string, input: Pick<Category, "name" | "color">) { const data = read(); Object.assign(data.categories.find((row) => row.id === id)!, input); write(data); },
      async setArchived(id: string, archived: boolean) { const data = read(); data.categories.find((row) => row.id === id)!.archivedAt = archived ? new Date().toISOString() : null; write(data); },
    },
    courses: {
      async list() { return read().courses; },
      async create(input: Pick<Course, "name"> & { code?: string | null }) { const data = read(); data.courses.push({ ...input, code: input.code ?? null, id: crypto.randomUUID(), archivedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); write(data); },
      async update(id: string, input: Pick<Course, "name"> & { code?: string | null }) { const data = read(); Object.assign(data.courses.find((row) => row.id === id)!, input); write(data); },
      async setArchived(id: string, archived: boolean) { const data = read(); data.courses.find((row) => row.id === id)!.archivedAt = archived ? new Date().toISOString() : null; write(data); },
    },
    reading: {
      async listBooks() { return []; }, async listSessions() { return []; },
      async createBook() { throw new Error("Reading is outside this classification fixture"); },
      async updateBook() { throw new Error("Reading is outside this classification fixture"); },
      async setArchived() { throw new Error("Reading is outside this classification fixture"); },
      async logSession() { throw new Error("Reading is outside this classification fixture"); },
      async correctSession() { throw new Error("Reading is outside this classification fixture"); },
      async removeSession() { throw new Error("Reading is outside this classification fixture"); },
    },
    topics: {
      async list() { return read().topics; },
      async create(input: Pick<Topic, "name">) { const data = read(); data.topics.push({ ...input, id: crypto.randomUUID(), archivedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); write(data); },
      async update(id: string, input: Pick<Topic, "name">) { const data = read(); Object.assign(data.topics.find((row) => row.id === id)!, input); write(data); },
      async setArchived(id: string, archived: boolean) { const data = read(); data.topics.find((row) => row.id === id)!.archivedAt = archived ? new Date().toISOString() : null; write(data); },
    },
    taskTypes: {
      async list() { return read().taskTypes; },
      async create(input: Pick<TaskType, "name">) { const data = read(); data.taskTypes.push({ ...input, id: crypto.randomUUID(), archivedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); write(data); },
      async update(id: string, input: Pick<TaskType, "name">) { const data = read(); Object.assign(data.taskTypes.find((row) => row.id === id)!, input); write(data); },
      async setArchived(id: string, archived: boolean) { const data = read(); data.taskTypes.find((row) => row.id === id)!.archivedAt = archived ? new Date().toISOString() : null; write(data); },
    },
  }), []);
  const timers: TimeSessionRepository = useMemo(() => ({
    async list() { return read().sessions; },
    async serverTime() { return Date.now(); },
    async taskTitle(id) { return read().tasks.find((task) => task.id === id)!.title; },
    async start(taskId, id) { const data = read(); const now = new Date().toISOString(); data.sessions.push({ id, taskId, userId: "fixture", startedAt: now, endedAt: null, durationSeconds: null, voidedAt: null, createdAt: now, updatedAt: now }); write(data); },
    async stop(id) { const data = read(); const row = data.sessions.find((session) => session.id === id)!; row.endedAt = new Date().toISOString(); row.durationSeconds = (Date.parse(row.endedAt) - Date.parse(row.startedAt)) / 1000; write(data); },
    async update(session, correction) { const data = read(); const row = data.sessions.find((item) => item.id === session.id)!; Object.assign(row, correction); row.durationSeconds = (Date.parse(correction.endedAt) - Date.parse(correction.startedAt)) / 1000; write(data); },
    async remove(session) { const data = read(); data.sessions.find((item) => item.id === session.id)!.voidedAt = new Date().toISOString(); write(data); },
  }), []);
  return <RepositoryContext.Provider value={repositories}><TimerProvider repository={timers}>
    <p>Local classification UI fixture — synthetic history, no hosted verification.</p>
    <button onClick={() => setWeek(!week)}>{week ? "Show Today fixture" : "Show Week fixture"}</button>
    {week ? <WeekBoard /> : <TaskBoard view="today" />}
  </TimerProvider></RepositoryContext.Provider>;
}
