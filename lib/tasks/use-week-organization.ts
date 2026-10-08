"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useRepositories } from "../supabase/repository-context";
import { createWeekPreference } from "./week-preference";
import type { WeekOrganization } from "./week-organization";

const serverSnapshot = (): WeekOrganization => "shortest";

export function useWeekOrganization() {
  const { userId } = useRepositories();
  const store = useMemo(() => createWeekPreference(() => window.localStorage, userId), [userId]);
  const subscribe = useMemo(() => (listener: () => void) => {
    const unsubscribe = store.subscribe(listener);
    window.addEventListener("storage", listener);
    return () => { unsubscribe(); window.removeEventListener("storage", listener); };
  }, [store]);
  const mode = useSyncExternalStore(subscribe, store.read, serverSnapshot);
  return { mode, setMode: store.write };
}
