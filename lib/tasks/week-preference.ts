import { weekOrganization, type WeekOrganization } from "./week-organization.ts";
import type { StorageAccess } from "../storage/local-store.ts";

export function weekPreferenceKey(userId: string): string {
  return `personal-task-manager.week-organization.v1:${userId}`;
}

// Account-local store with an in-memory fallback when browser storage is blocked.
// No data recovery keys are read or written by this preference.
export function createWeekPreference(getStorage: () => StorageAccess, userId?: string) {
  let fallback: WeekOrganization = "shortest";
  let memoryOnly = false;
  const listeners = new Set<() => void>();
  return {
    read(): WeekOrganization {
      if (!userId || memoryOnly) return fallback;
      try { return weekOrganization(getStorage().getItem(weekPreferenceKey(userId))); }
      catch { return fallback; }
    },
    write(value: WeekOrganization) {
      fallback = weekOrganization(value);
      if (userId) {
        try { getStorage().setItem(weekPreferenceKey(userId), fallback); memoryOnly = false; }
        catch { memoryOnly = true; }
      }
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
