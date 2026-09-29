import {
  priorities,
  type Task,
  type TaskInput,
  type TaskStatus,
} from "../../types/task.ts";
import { validateTask } from "./task-rules.ts";

export interface TaskRepository {
  list(): Promise<Task[]>;
  create(input: TaskInput): Promise<void>;
  update(id: string, input: TaskInput): Promise<void>;
  setStatus(id: string, status: TaskStatus): Promise<void>;
  remove(id: string): Promise<void>;
}

type StorageAccess = Pick<Storage, "getItem" | "setItem">;
export const STORAGE_KEY = "personal-task-manager.tasks.v1";

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isStoredTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) return false;
  const task = value as Record<string, unknown>;
  if (
    typeof task.id !== "string" ||
    !task.id ||
    typeof task.title !== "string" ||
    typeof task.category !== "string" ||
    !priorities.some((priority) => priority === task.priority) ||
    (task.status !== "incomplete" && task.status !== "completed") ||
    !isTimestamp(task.createdAt) ||
    (task.completedAt !== null && !isTimestamp(task.completedAt)) ||
    (task.deletedAt !== null && !isTimestamp(task.deletedAt)) ||
    (task.status === "completed") !== (task.completedAt !== null)
  )
    return false;
  try {
    validateTask(value as Task);
    return true;
  } catch {
    return false;
  }
}

// Only this adapter knows about browser storage. A future Supabase adapter can
// implement the same asynchronous interface without changing task components.
export function createLocalTaskRepository(
  getStorage: () => StorageAccess,
): TaskRepository {
  function read(): Task[] {
    let raw: string | null;
    try {
      raw = getStorage().getItem(STORAGE_KEY);
    } catch {
      throw new Error(
        "Browser storage is unavailable. Allow site storage, then retry. Nothing was changed.",
      );
    }
    if (raw === null) return [];
    try {
      const data: unknown = JSON.parse(raw);
      if (
        typeof data !== "object" ||
        data === null ||
        !("version" in data) ||
        data.version !== 1 ||
        !("tasks" in data) ||
        !Array.isArray(data.tasks) ||
        !data.tasks.every(isStoredTask) ||
        new Set(data.tasks.map((task) => task.id)).size !== data.tasks.length
      )
        throw new Error("Invalid data");
      return data.tasks;
    } catch {
      throw new Error(
        "Saved tasks could not be read. Your data has been left untouched. Preserve this browser's site data and request recovery help before trying again.",
      );
    }
  }

  function write(tasks: Task[]) {
    try {
      getStorage().setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks }));
    } catch {
      throw new Error(
        "Tasks could not be saved. Check available browser storage and retry. Your previous tasks are unchanged.",
      );
    }
  }

  function change(id: string, update: (task: Task) => Task) {
    const tasks = read();
    const index = tasks.findIndex((task) => task.id === id && !task.deletedAt);
    if (index < 0)
      throw new Error(
        "This task is no longer available. Refresh the list and try again.",
      );
    tasks[index] = update(tasks[index]);
    write(tasks);
  }

  return {
    async list() {
      return read().filter((task) => !task.deletedAt);
    },
    async create(input) {
      const fields = validateTask(input);
      const tasks = read();
      tasks.push({
        ...fields,
        id: crypto.randomUUID(),
        status: "incomplete",
        createdAt: new Date().toISOString(),
        completedAt: null,
        deletedAt: null,
      });
      write(tasks);
    },
    async update(id, input) {
      const fields = validateTask(input);
      change(id, (task) => ({ ...task, ...fields }));
    },
    async setStatus(id, status) {
      change(id, (task) => ({
        ...task,
        status,
        completedAt: status === "completed" ? new Date().toISOString() : null,
      }));
    },
    async remove(id) {
      change(id, (task) => ({ ...task, deletedAt: new Date().toISOString() }));
    },
  };
}

export const taskRepository = createLocalTaskRepository(
  () => window.localStorage,
);
