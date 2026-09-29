export const priorities = ["low", "medium", "high", "critical"] as const;
export type Priority = (typeof priorities)[number];
export type TaskStatus = "incomplete" | "completed";
export type SortMode = "momentum" | "priority" | "deadline";

export interface TaskInput {
  title: string;
  category: string;
  priority: Priority;
  dueDate: string | null;
  scheduledDate: string;
  estimatedMinutes: number;
}

export interface Task extends TaskInput {
  id: string;
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
  deletedAt: string | null;
}
