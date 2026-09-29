"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task } from "@/types/task";
import type { Category } from "@/types/category";
import { taskRepository, type TaskRepository } from "./task-repository";
import {
  categoryRepository,
  type CategoryRepository,
} from "../categories/category-repository";
import { STORAGE_KEY, LEGACY_STORAGE_KEY } from "../storage/local-store";
import { localDate } from "./task-rules";

export function useTasks(
  repository: TaskRepository = taskRepository,
  categorySource: CategoryRepository = categoryRepository,
) {
  const [data, setData] = useState<{ tasks: Task[]; categories: Category[] }>({
    tasks: [],
    categories: [],
  });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const saving = useRef(false);

  const load = useCallback(async () => {
    const [tasks, categories] = await Promise.all([
      repository.list(),
      categorySource.list(),
    ]);
    return { tasks, categories };
  }, [repository, categorySource]);

  const refresh = useCallback(async () => {
    try {
      const saved = await load();
      setData(saved);
      setToday(localDate());
      setReady(true);
      setError(null);
    } catch (problem) {
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
    load()
      .then((saved) => {
        if (!active) return;
        setData(saved);
        setToday(localDate());
        setReady(true);
        setError(null);
      })
      .catch((problem: unknown) => {
        if (!active) return;
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
    ) => Promise<void>,
  ): Promise<boolean> {
    if (saving.current || !ready) return false;
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      await operation(repository, categorySource);
      setData(await load());
      return true;
    } catch (problem) {
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

  return { ...data, ready, busy, error, today, refresh, mutate };
}
