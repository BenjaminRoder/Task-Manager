export const priorities = ["low", "medium", "high", "critical"] as const;
export type Priority = (typeof priorities)[number];
export type TaskStatus = "incomplete" | "completed";
export type SortMode = "momentum" | "priority" | "deadline";

export interface TaskInput {
  title: string;
  categoryId: string | null;
  // Optional at the legacy import boundary; persisted rows normalize to null.
  courseId?: string | null;
  taskTypeId?: string | null;
  priority: Priority;
  dueDate: string | null;
  scheduledDate: string;
  // Persisted manual estimate. Null means the user chooses automatic estimation.
  estimatedMinutes: number | null;
}

export interface Task extends TaskInput {
  id: string;
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
  deletedAt: string | null;
}
