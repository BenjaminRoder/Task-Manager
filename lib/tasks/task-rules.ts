import {
  priorities,
  type Task,
  type TaskInput,
  type SortMode,
} from "../../types/task.ts";

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function validateTask(input: TaskInput): TaskInput {
  const title = input.title.trim();
  const categoryId = input.categoryId.trim();
  if (!title || title.length > 160)
    throw new Error("Enter a task title between 1 and 160 characters.");
  if (!categoryId) throw new Error("Choose a category for this task.");
  if (!priorities.includes(input.priority))
    throw new Error("Choose a valid priority.");
  if (
    !Number.isInteger(input.estimatedMinutes) ||
    input.estimatedMinutes < 1 ||
    input.estimatedMinutes > 1440
  ) {
    throw new Error(
      "Estimate must be a whole number between 1 and 1,440 minutes.",
    );
  }
  if (
    !isDate(input.scheduledDate) ||
    (input.dueDate !== null && !isDate(input.dueDate))
  ) {
    throw new Error("Choose a valid planned date and optional due date.");
  }
  return { ...input, title, categoryId };
}

export function tasksForToday(tasks: Task[], today = localDate()): Task[] {
  return tasks.filter(
    (task) =>
      !task.deletedAt &&
      (task.status === "completed"
        ? task.completedAt !== null &&
          localDate(new Date(task.completedAt)) === today
        : task.scheduledDate <= today ||
          (task.dueDate !== null && task.dueDate <= today)),
  );
}

const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 };

export function sortTasks(tasks: Task[], mode: SortMode): Task[] {
  return [...tasks].sort((a, b) => {
    const statusOrder =
      Number(a.status === "completed") - Number(b.status === "completed");
    if (statusOrder) return statusOrder;
    let order = 0;
    if (mode === "momentum") order = a.estimatedMinutes - b.estimatedMinutes;
    if (mode === "priority")
      order = priorityRank[a.priority] - priorityRank[b.priority];
    if (mode === "deadline")
      order = (a.dueDate ?? "9999-12-31").localeCompare(
        b.dueDate ?? "9999-12-31",
      );
    return (
      order ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id)
    );
  });
}

export function remainingMinutes(tasks: Task[]): number {
  return tasks.reduce(
    (total, task) =>
      total +
      (task.status === "incomplete" && !task.deletedAt
        ? task.estimatedMinutes
        : 0),
    0,
  );
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const remainder = minutes % 60;
  return `${Math.floor(minutes / 60)}h${remainder ? ` ${remainder}m` : ""}`;
}

export function formatDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
