import type { Task, TaskInput, TaskStatus } from "../../types/task.ts";
import {
  localStore,
  type LocalData,
  type LocalStore,
} from "../storage/local-store.ts";
import { validateTask } from "./task-rules.ts";

export interface TaskRepository {
  list(): Promise<Task[]>;
  create(input: TaskInput): Promise<void>;
  update(id: string, input: TaskInput): Promise<void>;
  setStatus(id: string, status: TaskStatus): Promise<void>;
  remove(id: string): Promise<void>;
}

function validateCategoryAssignment(
  data: LocalData,
  categoryId: string,
  previousCategoryId?: string,
) {
  const category = data.categories.find(
    (category) => category.id === categoryId,
  );
  if (!category)
    throw new Error(
      "Choose an existing category. Reload if your category list is out of date.",
    );
  if (category.archivedAt && category.id !== previousCategoryId) {
    throw new Error(
      "This category is archived. Restore it or choose an active category.",
    );
  }
}

export function createLocalTaskRepository(store: LocalStore): TaskRepository {
  function change(id: string, update: (task: Task, data: LocalData) => Task) {
    const data = store.read();
    const index = data.tasks.findIndex(
      (task) => task.id === id && !task.deletedAt,
    );
    if (index < 0)
      throw new Error(
        "This task is no longer available. Refresh the list and try again.",
      );
    data.tasks[index] = update(data.tasks[index], data);
    store.write(data);
  }

  return {
    async list() {
      return store.read().tasks.filter((task) => !task.deletedAt);
    },
    async create(input) {
      const fields = validateTask(input);
      const data = store.read();
      validateCategoryAssignment(data, fields.categoryId);
      data.tasks.push({
        ...fields,
        id: crypto.randomUUID(),
        status: "incomplete",
        createdAt: new Date().toISOString(),
        completedAt: null,
        deletedAt: null,
      });
      store.write(data);
    },
    async update(id, input) {
      const fields = validateTask(input);
      change(id, (task, data) => {
        validateCategoryAssignment(data, fields.categoryId, task.categoryId);
        return { ...task, ...fields };
      });
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

export const taskRepository = createLocalTaskRepository(localStore);
