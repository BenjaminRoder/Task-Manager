import type { Task } from "../../types/task.ts";
import { isDate, remainingMinutes, sortTasks } from "./task-rules.ts";

// Arithmetic on calendar dates, not elapsed milliseconds, avoids DST shifts.
export function addCalendarDays(value: string, days: number): string {
  if (!isDate(value)) throw new Error("Invalid calendar date");
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function startOfWeek(value: string): string {
  if (!isDate(value)) throw new Error("Invalid calendar date");
  const weekday = new Date(`${value}T12:00:00Z`).getUTCDay();
  return addCalendarDays(value, -((weekday + 6) % 7));
}

export interface WeekDay {
  date: string;
  tasks: Task[];
  incompleteCount: number;
  estimatedMinutes: number;
}

export function buildWeek(tasks: Task[], weekStart: string): WeekDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addCalendarDays(weekStart, index);
    const dueTasks = sortTasks(
      tasks.filter((task) => !task.deletedAt && task.dueDate === date),
      "momentum",
    );
    return {
      date,
      tasks: dueTasks,
      incompleteCount: dueTasks.filter((task) => task.status === "incomplete")
        .length,
      estimatedMinutes: remainingMinutes(dueTasks),
    };
  });
}
