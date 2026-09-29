"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task } from "@/types/task";
import type { Category } from "@/types/category";
import type { TaskRepository } from "./task-repository";
import type { CategoryRepository } from "../categories/category-repository";
import { STORAGE_KEY, LEGACY_STORAGE_KEY } from "../storage/local-store";
import { localDate } from "./task-rules";
import { useRepositories } from "../supabase/repository-context";

export function useTasks() {
  const { tasks: repository, categories: categorySource } = useRepositories();
  const [data, setData] = useState<{ tasks: Task[]; categories: Category[] }>({
    tasks: [],
    categories: [],
  });
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const saving = useRef(false);
  const requestVersion = useRef(0);

  const load = useCallback(async () => {
    const [tasks, categories] = await Promise.all([
      repository.list(),
      categorySource.list(),
    ]);
    return { tasks, categories };
  }, [repository, categorySource]);

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
    ) => Promise<void>,
  ): Promise<boolean> {
    if (saving.current || !ready) return false;
    saving.current = true;
    ++requestVersion.current;
    setBusy(true);
    setError(null);
    try {
      await operation(repository, categorySource);
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

  return { ...data, ready, busy, error, today, refresh, mutate };
}
