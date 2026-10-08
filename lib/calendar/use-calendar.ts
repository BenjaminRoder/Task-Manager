"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRepositories } from "../supabase/repository-context";
import type { CalendarEvent } from "../../types/calendar-event";
import type { RecurringClassPattern } from "../../types/recurring-class-pattern";

export function useCalendar() {
  const { events, classes } = useRepositories();
  const [data, setData] = useState<{ events: CalendarEvent[]; classes: RecurringClassPattern[] }>({ events: [], classes: [] });
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false), version = useRef(0);
  const load = useCallback(async () => {
    const [savedEvents, savedClasses] = await Promise.all([events.list(), classes.list()]);
    return { events: savedEvents, classes: savedClasses };
  }, [events, classes]);
  const refresh = useCallback(async () => {
    if (saving.current) return;
    const current = ++version.current;
    try {
      const saved = await load();
      if (current !== version.current) return;
      setData(saved); setReady(true); setError(null);
    } catch (problem) {
      if (current !== version.current) return;
      setReady(false); setError(problem instanceof Error ? problem.message : "Could not load calendar data. Retry loading.");
    }
  }, [load]);
  useEffect(() => {
    let active = true;
    const current = ++version.current;
    load().then(saved => {
      if (!active || current !== version.current) return;
      setData(saved); setReady(true); setError(null);
    }).catch((problem: unknown) => {
      if (!active || current !== version.current) return;
      setReady(false); setError(problem instanceof Error ? problem.message : "Could not load calendar data. Retry loading.");
    });
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [refresh, load]);
  async function mutate(operation: () => Promise<void>): Promise<boolean> {
    if (saving.current || !ready) return false;
    saving.current = true; ++version.current; setBusy(true); setError(null);
    try {
      await operation();
      try { setData(await load()); }
      catch { setReady(false); setError("Your calendar change was saved, but reloading failed. Retry loading before making another change."); }
      return true;
    } catch (problem) {
      setReady(false); setError(problem instanceof Error ? problem.message : "Calendar save failed. Reload before retrying.");
      return false;
    } finally { saving.current = false; setBusy(false); }
  }
  return { ...data, ready, busy, error, refresh, mutate, eventRepository: events, classRepository: classes };
}
