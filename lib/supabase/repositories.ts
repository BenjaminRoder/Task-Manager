import type { SupabaseClient } from "@supabase/supabase-js";
import type { Task, TaskInput } from "../../types/task.ts";
import type { Category } from "../../types/category.ts";
import type { TaskRepository } from "../tasks/task-repository.ts";
import type { CategoryRepository } from "../categories/category-repository.ts";
import { validateTask } from "../tasks/task-rules.ts";
import { validateCategory } from "../categories/category-rules.ts";

export type TaskRow = {
  id: string;
  title: string;
  category_id: string;
  priority: Task["priority"];
  due_date: string | null;
  scheduled_date: string;
  estimated_minutes: number | null;
  status: Task["status"];
  created_at: string;
  completed_at: string | null;
  deleted_at: string | null;
};
export type CategoryRow = {
  id: string;
  name: string;
  color: string;
  archived_at: string | null;
};
export function taskFromRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    categoryId: row.category_id,
    priority: row.priority,
    dueDate: row.due_date,
    scheduledDate: row.scheduled_date,
    estimatedMinutes: row.estimated_minutes,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    deletedAt: row.deleted_at,
  };
}
export function taskFields(input: TaskInput) {
  const value = validateTask(input);
  return {
    title: value.title,
    category_id: value.categoryId,
    priority: value.priority,
    due_date: value.dueDate,
    scheduled_date: value.scheduledDate,
    estimated_minutes: value.estimatedMinutes,
  };
}
export function categoryFromRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    archivedAt: row.archived_at,
  };
}
export function databaseError(
  error: { message: string; code?: string } | null,
) {
  if (!error) return;
  if (error.code === "23505")
    throw new Error(
      "A category name or record ID already exists in your account. No conflicting data was overwritten. If importing, resolve the conflict before retrying.",
    );
  throw new Error(
    `Could not save or load cloud data: ${error.message}. Check your connection and sign in again if your session expired.`,
  );
}

export function createSupabaseRepositories(
  client: SupabaseClient,
  userId: string,
): {
  tasks: TaskRepository;
  categories: CategoryRepository;
} {
  // Pin this repository to one account. Never let an in-flight old-account action
  // write into a newly signed-in account, even when browser auth changes tabs.
  async function authorize() {
    const { data, error } = await client.auth.getUser();
    if (error || data.user?.id !== userId)
      throw new Error(
        "Your session changed or expired. Sign in again before continuing.",
      );
  }
  async function update(
    table: "tasks" | "categories",
    id: string,
    fields: Record<string, unknown>,
  ) {
    await authorize();
    let query = client
      .from(table)
      .update(fields)
      .eq("user_id", userId)
      .eq("id", id);
    if (table === "tasks") query = query.is("deleted_at", null);
    const { data, error } = await query.select("id").single();
    databaseError(error);
    if (!data)
      throw new Error(
        "This record is no longer available. Refresh and try again.",
      );
  }
  async function list(table: "tasks" | "categories", includeDeleted = false) {
    await authorize();
    const rows: (TaskRow | CategoryRow)[] = [];
    // PostgREST defaults to a 1,000-row cap. Page explicitly to retain history.
    for (let start = 0; ; start += 500) {
      let query = client
        .from(table)
        .select("*")
        .eq("user_id", userId)
        .order("id")
        .range(start, start + 499);
      if (table === "tasks" && !includeDeleted) query = query.is("deleted_at", null);
      const { data, error } = await query;
      databaseError(error);
      rows.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }
    return rows;
  }
  return {
    tasks: {
      async list(includeDeleted = false) {
        return ((await list("tasks", includeDeleted)) as TaskRow[]).map(taskFromRow);
      },
      async create(input) {
        const fields = taskFields(input);
        await authorize();
        // Ownership is checked against Auth above and again by database RLS.
        const { error } = await client
          .from("tasks")
          .insert({ ...fields, user_id: userId });
        databaseError(error);
      },
      async update(id, input) {
        await update("tasks", id, taskFields(input));
      },
      async setStatus(id, status) {
        await update("tasks", id, {
          status,
          completed_at:
            status === "completed" ? new Date().toISOString() : null,
        });
      },
      async remove(id) {
        await update("tasks", id, { deleted_at: new Date().toISOString() });
      },
    },
    categories: {
      async list() {
        return ((await list("categories")) as CategoryRow[]).map(
          categoryFromRow,
        );
      },
      async create(input) {
        const fields = validateCategory(input);
        await authorize();
        const { error } = await client
          .from("categories")
          .insert({ ...fields, user_id: userId });
        databaseError(error);
      },
      async update(id, input) {
        await update("categories", id, { ...validateCategory(input) });
      },
      async setArchived(id, archived) {
        await update("categories", id, {
          archived_at: archived ? new Date().toISOString() : null,
        });
      },
    },
  };
}
