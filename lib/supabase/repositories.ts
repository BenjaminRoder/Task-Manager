import type { SupabaseClient } from "@supabase/supabase-js";
import type { Task, TaskInput } from "../../types/task.ts";
import type { Category } from "../../types/category.ts";
import type { TaskRepository } from "../tasks/task-repository.ts";
import type { CategoryRepository } from "../categories/category-repository.ts";
import { validateTask } from "../tasks/task-rules.ts";
import { validateCategory } from "../categories/category-rules.ts";
import type { CourseRepository } from "../classification/course-repository.ts";
import type { TaskTypeRepository } from "../classification/task-type-repository.ts";
import { validateCourse, validateTaskType } from "../classification/classification-rules.ts";
import type { Course } from "../../types/course.ts";
import type { TaskType } from "../../types/task-type.ts";

import type { TopicRepository } from "../classification/topic-repository.ts";
import { validateTopic, validateTopicIds } from "../classification/topic-rules.ts";

import type { ReadingRepository } from "../reading/reading-repository.ts";
import { createReadingRepository } from "./reading-repository.ts";
import { createAnalyticsRepository } from "./analytics-repository.ts";
import type { AnalyticsRepository } from "../analytics/analytics-repository.ts";
import { createCalendarRepositories } from "./calendar-repositories.ts";
import type { EventRepository } from "../calendar/event-repository.ts";
import type { RecurringClassRepository } from "../calendar/recurring-class-repository.ts";

export type TaskRow = {
  task_topics?: { topic_id: string }[];
  id: string;
  title: string;
  category_id: string | null;
  course_id?: string | null;
  task_type_id?: string | null;
  priority: Task["priority"];
  due_date: string | null;
  due_time?: string | null;
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
export type TaskTypeRow = {
  id: string;
  name: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};
export type CourseRow = TaskTypeRow & { code: string | null };

export function taskTypeFromRow(row: TaskTypeRow): TaskType {
  return { id: row.id, name: row.name, archivedAt: row.archived_at,
    createdAt: row.created_at, updatedAt: row.updated_at };
}
export function courseFromRow(row: CourseRow): Course {
  return { ...taskTypeFromRow(row), code: row.code };
}
export function taskFromRow(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    categoryId: row.category_id,
    courseId: row.course_id ?? null,
    taskTypeId: row.task_type_id ?? null,
    topicIds: (row.task_topics ?? []).map((link) => link.topic_id),
    priority: row.priority,
    dueDate: row.due_date,
    dueTime: row.due_time?.slice(0, 5) ?? null,
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
    course_id: value.courseId,
    task_type_id: value.taskTypeId,
    priority: value.priority,
    due_date: value.dueDate,
    due_time: value.dueTime ?? null,
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
      "A classification name or record ID already exists in your account. No conflicting data was overwritten. If importing, resolve the conflict before retrying.",
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
  courses: CourseRepository;
  taskTypes: TaskTypeRepository;
  topics: TopicRepository;
  reading: ReadingRepository;
  analytics: AnalyticsRepository;
  events: EventRepository;
  classes: RecurringClassRepository;
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
    table: "tasks" | "categories" | "courses" | "task_types" | "topics",
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
  async function list(table: "tasks" | "categories" | "courses" | "task_types" | "topics", includeDeleted = false) {
    await authorize();
    const rows: (TaskRow | CategoryRow | CourseRow | TaskTypeRow)[] = [];
    // PostgREST defaults to a 1,000-row cap. Page explicitly to retain history.
    for (let start = 0; ; start += 500) {
      let query = client
        .from(table)
        .select(table === "tasks" ? "*,task_topics(topic_id)" : "*")
        .eq("user_id", userId)
        .order("id")
        .range(start, start + 499);
      if (table === "tasks" && !includeDeleted) query = query.is("deleted_at", null);
      const { data, error } = await query.returns<(TaskRow | CategoryRow | CourseRow | TaskTypeRow)[]>();
      databaseError(error);
      rows.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }
    return rows;
  }
  async function saveWithTopics(id: string | null, input: TaskInput) {
    const fields = taskFields(input);
    const ids = validateTopicIds(input.topicIds ?? []);
    await authorize();
    const { error } = await client.rpc("save_task_with_topics", { p_task_id: id, p_fields: fields, p_topic_ids: ids, expected_user_id: userId });
    databaseError(error);
  }
  return {
    ...createCalendarRepositories(client, userId),
    reading: createReadingRepository(client, userId),
    analytics: createAnalyticsRepository(client, userId),
    topics: {
      async list() { return ((await list("topics")) as TaskTypeRow[]).map(taskTypeFromRow); },
      async create(input) {
        const fields = validateTopic(input);
        await authorize();
        const { error } = await client.from("topics").insert({ ...fields, user_id: userId });
        databaseError(error);
      },
      async update(id, input) { await update("topics", id, { ...validateTopic(input) }); },
      async setArchived(id, archived) { await update("topics", id, { archived_at: archived ? new Date().toISOString() : null }); },
    },
    tasks: {
      async list(includeDeleted = false) {
        return ((await list("tasks", includeDeleted)) as TaskRow[]).map(taskFromRow);
      },
      async create(input) {
        if (input.topicIds?.length) return saveWithTopics(null, input);
        const fields = taskFields(input);
        await authorize();
        // Ownership is checked against Auth above and again by database RLS.
        const { error } = await client
          .from("tasks")
          .insert({ ...fields, user_id: userId });
        databaseError(error);
      },
      async update(id, input) {
        if (input.topicIds !== undefined) return saveWithTopics(id, input);
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
    courses: {
      async list() {
        return ((await list("courses")) as CourseRow[]).map(courseFromRow);
      },
      async create(input) {
        const fields = validateCourse(input);
        await authorize();
        const { error } = await client.from("courses").insert({ ...fields, user_id: userId });
        databaseError(error);
      },
      async update(id, input) {
        await update("courses", id, { ...validateCourse(input) });
      },
      async setArchived(id, archived) {
        await update("courses", id, { archived_at: archived ? new Date().toISOString() : null });
      },
    },
    taskTypes: {
      async list() {
        return ((await list("task_types")) as TaskTypeRow[]).map(taskTypeFromRow);
      },
      async create(input) {
        const fields = validateTaskType(input);
        await authorize();
        const { error } = await client.from("task_types").insert({ ...fields, user_id: userId });
        databaseError(error);
      },
      async update(id, input) {
        await update("task_types", id, { ...validateTaskType(input) });
      },
      async setArchived(id, archived) {
        await update("task_types", id, { archived_at: archived ? new Date().toISOString() : null });
      },
    },
  };
}
