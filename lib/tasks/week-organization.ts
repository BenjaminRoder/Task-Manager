import type { Task } from "../../types/task.ts";
import type { Course } from "../../types/course.ts";
import type { TaskType } from "../../types/task-type.ts";
import { effectiveEstimate, type Predictions } from "../estimation/duration-estimation.ts";
import { compareDueTimes } from "./task-rules.ts";

export type WeekOrganization = "shortest" | "course" | "task-type";
export function weekOrganization(value: unknown): WeekOrganization {
  return value === "course" || value === "task-type" ? value : "shortest";
}

export function sortWeekTasks(tasks: readonly Task[], mode: WeekOrganization, predictions?: Predictions): Task[] {
  return [...tasks].sort((a, b) => {
    const completed = Number(a.status === "completed") - Number(b.status === "completed");
    const duration = effectiveEstimate(a, predictions?.get(a.id)) - effectiveEstimate(b, predictions?.get(b.id));
    const time = compareDueTimes(a, b);
    return completed || (mode === "shortest" ? duration || time : time || duration)
      || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
  });
}

export interface WeekTaskGroup {
  key: string;
  label: string | null;
  tasks: Task[];
}

export function groupWeekTasks(tasks: readonly Task[], mode: WeekOrganization,
  courses: readonly Course[], taskTypes: readonly TaskType[], predictions?: Predictions): WeekTaskGroup[] {
  const sorted = sortWeekTasks(tasks, mode, predictions);
  if (mode === "shortest") return [{ key: "all", label: null, tasks: sorted }];
  const records = new Map((mode === "course" ? courses : taskTypes).map((record) => [record.id, record]));
  // Partition status before classification so every completed task stays last.
  return (["incomplete", "completed"] as const).flatMap((status) => {
    const groups = new Map<string | null, Task[]>();
    for (const task of sorted.filter((task) => task.status === status)) {
      const id = (mode === "course" ? task.courseId : task.taskTypeId) ?? null;
      const group = groups.get(id) ?? [];
      group.push(task);
      groups.set(id, group);
    }
    return [...groups.entries()].map(([id, tasks]) => {
      const record = id ? records.get(id) : undefined;
      const name = id === null ? "Unassigned" : record
        ? record.name + (record.archivedAt ? " (archived)" : "")
        : "Unavailable classification";
      return { key: JSON.stringify([status, id]), label: (status === "completed" ? "Completed · " : "") + name, tasks };
    }).sort((a, b) => a.label.localeCompare(b.label) || a.key.localeCompare(b.key));
  });
}
