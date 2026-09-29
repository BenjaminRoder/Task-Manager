"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task } from "@/types/task";
import {
  taskRepository,
  STORAGE_KEY,
  type TaskRepository,
} from "./task-repository";
import { localDate } from "./task-rules";

export function useTasks(repository: TaskRepository = taskRepository) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const saving = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const saved = await repository.list();
      setTasks(saved);
      setToday(localDate());
      setReady(true);
      setError(null);
    } catch (problem) {
      setReady(false);
      setError(
        problem instanceof Error
          ? problem.message
          : "Could not load your tasks. Please retry.",
      );
    }
  }, [repository]);

  useEffect(() => {
    let active = true;
    repository
      .list()
      .then((saved) => {
        if (!active) return;
        setTasks(saved);
        setToday(localDate());
        setReady(true);
        setError(null);
      })
      .catch((problem: unknown) => {
        if (!active) return;
        setError(
          problem instanceof Error
            ? problem.message
            : "Could not load your tasks. Please retry.",
        );
      });
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) void refresh();
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
  }, [refresh, repository]);

  async function mutate(
    operation: (repository: TaskRepository) => Promise<void>,
  ): Promise<boolean> {
    if (saving.current || !ready) return false;
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      await operation(repository);
      const saved = await repository.list();
      setTasks(saved);
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

  return { tasks, ready, busy, error, today, refresh, mutate };
}
