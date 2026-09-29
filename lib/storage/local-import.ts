import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createLocalStore,
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  validateStoredData,
  type LocalData,
  type StorageAccess,
} from "../storage/local-store.ts";
import { databaseError } from "../supabase/repositories.ts";

export interface LocalImport {
  data: LocalData;
  datasetId: string;
}
export function markerKey(project: string, userId: string, datasetId: string) {
  return `personal-task-manager.import.v1:${project}:${userId}:${datasetId}`;
}
export async function detectLocalImport(
  storage: StorageAccess,
): Promise<LocalImport | null> {
  // Do not initialize a fresh store just to discover importable records.
  if (
    storage.getItem(STORAGE_KEY) === null &&
    storage.getItem(LEGACY_STORAGE_KEY) === null
  )
    return null;
  const data = createLocalStore(() => storage).read();
  if (!data.tasks.length && !data.categories.length) return null;
  const canonical = JSON.stringify({
    version: 2,
    categories: [...data.categories]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        archivedAt: c.archivedAt,
      })),
    tasks: [...data.tasks]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((t) => ({
        id: t.id,
        title: t.title,
        categoryId: t.categoryId,
        priority: t.priority,
        dueDate: t.dueDate,
        scheduledDate: t.scheduledDate,
        estimatedMinutes: t.estimatedMinutes,
        status: t.status,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
        deletedAt: t.deletedAt,
      })),
  });
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return {
    data,
    datasetId: Array.from(new Uint8Array(hash), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join(""),
  };
}
export async function importLocalData(
  client: SupabaseClient,
  userId: string,
  candidate: LocalImport,
  storage: StorageAccess,
  project: string,
) {
  validateStoredData(candidate.data);
  const { data, error } = await client.auth.getUser();
  if (error || data.user?.id !== userId)
    throw new Error("Your session changed. Sign in again before importing.");
  const result = await client.rpc("import_local_data", {
    dataset_id: candidate.datasetId,
    payload: candidate.data,
    expected_user_id: userId,
  });
  databaseError(result.error);
  // A local marker failure is recoverable: the transactional server ledger makes
  // retry safe even after a lost HTTP response, cleared marker, or another browser.
  try {
    storage.setItem(
      markerKey(project, userId, candidate.datasetId),
      new Date().toISOString(),
    );
  } catch {
    return "Imported successfully. The browser marker could not be saved; the cloud import record prevents duplicates.";
  }
  return "Local data imported successfully. The original browser data has been kept for recovery.";
}
export async function pendingLocalImport(
  client: SupabaseClient,
  userId: string,
  storage: StorageAccess,
  project: string,
) {
  const candidate = await detectLocalImport(storage);
  if (!candidate) return null;
  const key = markerKey(project, userId, candidate.datasetId);
  if (storage.getItem(key)) return null;
  const { data, error } = await client
    .from("local_imports")
    .select("dataset_id")
    .eq("user_id", userId)
    .eq("dataset_id", candidate.datasetId)
    .maybeSingle();
  databaseError(error);
  if (data) return null;
  return candidate;
}
