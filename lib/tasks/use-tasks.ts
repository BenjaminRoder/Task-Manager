"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTimer } from "../timers/timer-provider";
import { predictTasks } from "../estimation/duration-estimation";
import type { Task } from "@/types/task";
import type { Category } from "@/types/category";
import type { TaskRepository } from "./task-repository";
import type { CategoryRepository } from "../categories/category-repository";
import type { Course } from "@/types/course";
import type { TaskType } from "@/types/task-type";
import type { CourseRepository } from "../classification/course-repository";
import type { TaskTypeRepository } from "../classification/task-type-repository";
import { STORAGE_KEY, LEGACY_STORAGE_KEY } from "../storage/local-store";
import { localDate } from "./task-rules";
import { useRepositories } from "../supabase/repository-context";

export function useTasks() {
  const timer = useTimer();
  const { tasks: repository, categories: categorySource, courses: courseSource, taskTypes: taskTypeSource } = useRepositories();
  const [data, setData] = useState<{ tasks: Task[]; categories: Category[]; courses: Course[]; taskTypes: TaskType[] }>({
    tasks: [],
    categories: [],
    courses: [],
    taskTypes: [],
  });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const saving = useRef(false);
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    const [tasks, categories, courses, taskTypes] = await Promise.all([
      repository.list(true),
      categorySource.list(),
      courseSource.list(),
      taskTypeSource.list(),
    ]);
    return { tasks, categories, courses, taskTypes };
  }, [repository, categorySource, courseSource, taskTypeSource]);

  const refresh = useCallback(async () => {
    if (saving.current) return;
    const version = ++requestVersion.current;
    try {
      const saved = await load();
      if (version !== requestVersion.current) return;
      setData(saved);
      setToday(localDate());
      setReady(true);
      setError(null);
    } catch (problem) {
      if (version !== requestVersion.current) return;
      setReady(false);
      setError(
        problem instanceof Error
          ? problem.message
          : "Could not load your tasks and categories. Please retry.",
      );
    }
  }, [load]);

  useEffect(() => {
    let active = true;
    const version = ++requestVersion.current;
    load()
      .then((saved) => {
        if (!active || version !== requestVersion.current) return;
        setData(saved);
        setToday(localDate());
        setReady(true);
        setError(null);
      })
      .catch((problem: unknown) => {
        if (!active || version !== requestVersion.current) return;
        setError(
          problem instanceof Error
            ? problem.message
            : "Could not load your tasks and categories. Please retry.",
        );
      });
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === STORAGE_KEY ||
        event.key === LEGACY_STORAGE_KEY ||
        event.key === null
      )
        void refresh();
    };
    const onFocus = () => void refresh();
    const clock = window.setInterval(() => setToday(localDate()), 30_000);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearInterval(clock);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, load]);

  async function mutate(
    operation: (
      repository: TaskRepository,
      categories: CategoryRepository,
      courses: CourseRepository,
      taskTypes: TaskTypeRepository,
    ) => Promise<void>,
  ): Promise<boolean> {
    if (saving.current || !ready) return false;
    saving.current = true;
    ++requestVersion.current;
    setBusy(true);
    setError(null);
    try {
      await operation(repository, categorySource, courseSource, taskTypeSource);
      window.dispatchEvent(new Event("tasks-changed"));
      try {
        setData(await load());
      } catch {
        setReady(false);
        setError(
          "Your change was saved, but the updated list could not load. Retry loading before making another change.",
        );
      }
      return true;
    } catch (problem) {
      setReady(false);
      setError(
        problem instanceof Error
          ? problem.message
          : "Could not save your change. Please retry.",
      );
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const predictions = useMemo(() => timer.ready ? predictTasks(data.tasks, timer.sessions) : undefined,
    [data.tasks, timer.sessions, timer.ready]);
  return { ...data, tasks: data.tasks.filter((task) => !task.deletedAt), predictions,
    estimationReady: timer.ready, ready, busy, error, today, refresh, mutate };
}
