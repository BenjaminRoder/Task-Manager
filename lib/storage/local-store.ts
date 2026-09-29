import type { Category } from "../../types/category.ts";
import { priorities, type Task } from "../../types/task.ts";
import {
  categoryColors,
  categoryNameKey,
  validateCategory,
} from "../categories/category-rules.ts";
import { validateTask } from "../tasks/task-rules.ts";

export const LEGACY_STORAGE_KEY = "personal-task-manager.tasks.v1";
export const STORAGE_KEY = "personal-task-manager.data.v2";
export type StorageAccess = Pick<Storage, "getItem" | "setItem">;

export interface LocalData {
  version: 2;
  tasks: Task[];
  categories: Category[];
}

export interface LocalStore {
  read(): LocalData;
  write(data: LocalData): void;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function hasTaskMetadata(value: Record<string, unknown>): boolean {
  return (
    typeof value.id === "string" &&
    !!value.id &&
    typeof value.title === "string" &&
    priorities.some((priority) => priority === value.priority) &&
    (value.status === "incomplete" || value.status === "completed") &&
    isTimestamp(value.createdAt) &&
    (value.completedAt === null || isTimestamp(value.completedAt)) &&
    (value.deletedAt === null || isTimestamp(value.deletedAt)) &&
    (value.status === "completed") === (value.completedAt !== null)
  );
}

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") return false;
  const task = value as Record<string, unknown>;
  if (!hasTaskMetadata(task) || typeof task.categoryId !== "string")
    return false;
  try {
    validateTask(value as Task);
    return true;
  } catch {
    return false;
  }
}

function isCategory(value: unknown): value is Category {
  if (!value || typeof value !== "object") return false;
  const category = value as Record<string, unknown>;
  if (
    typeof category.id !== "string" ||
    !category.id ||
    typeof category.name !== "string" ||
    typeof category.color !== "string" ||
    (category.archivedAt !== null && !isTimestamp(category.archivedAt))
  )
    return false;
  try {
    validateCategory(value as Category);
    return true;
  } catch {
    return false;
  }
}

function uniqueIds(records: { id: string }[]): boolean {
  return new Set(records.map((record) => record.id)).size === records.length;
}

export function validateStoredData(value: unknown): LocalData {
  if (!value || typeof value !== "object") throw new Error("Invalid document");
  const data = value as Record<string, unknown>;
  if (
    data.version !== 2 ||
    !Array.isArray(data.tasks) ||
    !data.tasks.every(isTask) ||
    !Array.isArray(data.categories) ||
    !data.categories.every(isCategory) ||
    !uniqueIds(data.tasks) ||
    !uniqueIds(data.categories)
  )
    throw new Error("Invalid records");
  const categoryIds = new Set(data.categories.map((category) => category.id));
  if (
    data.tasks.some((task) => !categoryIds.has(task.categoryId)) ||
    new Set(data.categories.map((category) => categoryNameKey(category.name)))
      .size !== data.categories.length
  ) {
    throw new Error("Invalid category relationships");
  }
  return value as LocalData;
}

// Retain every task, including completed and soft-deleted records. The original
// v1 document stays untouched as a recovery copy after the atomic v2 write.
export function migrateLegacyData(value: unknown): LocalData {
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("tasks" in value) ||
    !Array.isArray(value.tasks)
  )
    throw new Error("Invalid legacy document");
  const categories: Category[] = [];
  const byName = new Map<string, Category>();
  const tasks = value.tasks.map((value: unknown) => {
    if (!value || typeof value !== "object")
      throw new Error("Invalid legacy task");
    const legacy = value as Record<string, unknown>;
    if (
      !hasTaskMetadata(legacy) ||
      typeof legacy.category !== "string" ||
      !legacy.category.trim() ||
      legacy.category.trim().length > 60
    )
      throw new Error("Invalid legacy task");
    const key = categoryNameKey(legacy.category);
    let category = byName.get(key);
    if (!category) {
      category = {
        id: crypto.randomUUID(),
        name: legacy.category.trim(),
        color: categoryColors[categories.length % categoryColors.length].value,
        archivedAt: null,
      };
      categories.push(category);
      byName.set(key, category);
    }
    const { category: oldName, ...fields } = legacy;
    void oldName;
    return { ...fields, categoryId: category.id };
  });
  if (!categories.length)
    categories.push({
      id: crypto.randomUUID(),
      name: "Personal",
      color: categoryColors[0].value,
      archivedAt: null,
    });
  return validateStoredData({ version: 2, tasks, categories });
}

export function createLocalStore(getStorage: () => StorageAccess): LocalStore {
  function get(key: string): string | null {
    try {
      return getStorage().getItem(key);
    } catch {
      throw new Error(
        "Browser storage is unavailable. Allow site storage, then retry. Nothing was changed.",
      );
    }
  }

  function write(data: LocalData) {
    validateStoredData(data);
    try {
      getStorage().setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      throw new Error(
        "Tasks and categories could not be saved. Check available browser storage and retry. Your previous data is unchanged.",
      );
    }
  }

  return {
    read() {
      const raw = get(STORAGE_KEY);
      const legacy = raw === null ? get(LEGACY_STORAGE_KEY) : null;
      let data: LocalData;
      try {
        if (raw !== null) return validateStoredData(JSON.parse(raw));
        data = migrateLegacyData(
          legacy === null ? { version: 1, tasks: [] } : JSON.parse(legacy),
        );
      } catch {
        throw new Error(
          "Saved tasks and categories could not be read. Your data has been left untouched. Preserve this browser's site data and request recovery help before trying again.",
        );
      }
      // One write commits both categories and their task references together.
      write(data);
      return data;
    },
    write,
  };
}

export const localStore = createLocalStore(() => window.localStorage);
