import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseRepositories } from "../lib/supabase/repositories.ts";
import {
  detectLocalImport,
  importLocalData,
  pendingLocalImport,
  markerKey,
} from "../lib/storage/local-import.ts";
import { STORAGE_KEY, LEGACY_STORAGE_KEY } from "../lib/storage/local-store.ts";

const owner = "11111111-1111-4111-8111-111111111111";
const task = {
  id: "task",
  title: "Read",
  categoryId: "cat",
  priority: "high" as const,
  dueDate: null,
  scheduledDate: "2026-09-29",
  estimatedMinutes: 15,
  status: "completed" as const,
  createdAt: "2026-01-01T00:00:00Z",
  completedAt: "2026-01-02T00:00:00Z",
  deletedAt: "2026-01-03T00:00:00Z",
};
const category = {
  id: "cat",
  name: "Study",
  color: "#123456",
  archivedAt: "2026-01-04T00:00:00Z",
};
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
function fixture() {
  const requests: {
    url: URL;
    method: string;
    body: Record<string, unknown> | null;
  }[] = [];
  let fail = false;
  let currentOwner = owner;
  let imported = false;
  const client = createClient(
    "https://fixture.supabase.co",
    "test-public-key",
    {
      accessToken: async () => "fixture-token",
      global: {
        fetch: async (input, init) => {
          const url = new URL(String(input));
          const body = init?.body
            ? (JSON.parse(String(init.body)) as Record<string, unknown>)
            : null;
          requests.push({ url, method: init?.method ?? "GET", body });
          if (fail)
            return new Response(
              JSON.stringify({ message: "Network fixture failure" }),
              { status: 503 },
            );
          const object =
            init?.headers &&
            new Headers(init.headers)
              .get("Accept")
              ?.includes("vnd.pgrst.object");
          let response: unknown = [];
          if (url.pathname.endsWith("/rpc/import_local_data")) {
            imported = true;
            response = null;
          } else if (url.pathname.endsWith("/local_imports"))
            response = imported ? { dataset_id: "saved" } : null;
          else if (init?.method === "PATCH") response = { id: "task" };
          else if (url.pathname.endsWith("/tasks") && !body)
            response = [
              {
                id: task.id,
                title: task.title,
                category_id: task.categoryId,
                priority: task.priority,
                due_date: null,
                scheduled_date: task.scheduledDate,
                estimated_minutes: 15,
                status: task.status,
                created_at: task.createdAt,
                completed_at: task.completedAt,
                deleted_at: null,
              },
            ];
          else if (url.pathname.endsWith("/categories") && !body)
            response = [
              { id: "cat", name: "Study", color: "#123456", archived_at: null },
            ];
          return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
              "Content-Type": object
                ? "application/vnd.pgrst.object+json"
                : "application/json",
            },
          });
        },
      },
    },
  );
  // Explicit test fixture: Auth identity validation is separately exercised below.
  Object.defineProperty(client, "auth", {
    value: {
      getUser: async () => ({
        data: { user: { id: currentOwner } },
        error: null,
      }),
    },
  });
  return {
    client,
    requests,
    fail: () => {
      fail = true;
    },
    changeAccount: () => {
      currentOwner = "another-user";
    },
  };
}

test("Supabase adapters preserve contracts, scope requests, and soft-delete", async () => {
  const f = fixture();
  const repositories = createSupabaseRepositories(f.client, owner);
  await repositories.tasks.create(task);
  const read = await repositories.tasks.list();
  assert.equal(read[0].categoryId, "cat");
  assert.equal(read[0].completedAt, task.completedAt);
  await repositories.tasks.update("task", { ...task, title: "Updated" });
  await repositories.tasks.setStatus("task", "completed");
  await repositories.tasks.setStatus("task", "incomplete");
  await repositories.tasks.remove("task");
  await repositories.categories.create(category);
  assert.equal((await repositories.categories.list())[0].name, "Study");
  await repositories.categories.update("cat", {
    name: "Other",
    color: "#abcdef",
  });
  await repositories.categories.setArchived("cat", true);
  await repositories.categories.setArchived("cat", false);
  for (const request of f.requests) {
    if (request.method === "POST") assert.equal(request.body?.user_id, owner);
    else assert.equal(request.url.searchParams.get("user_id"), `eq.${owner}`);
    assert.notEqual(request.method, "DELETE");
  }
  assert.ok(f.requests.some((r) => r.body?.deleted_at));
  assert.ok(
    f.requests.some(
      (r) => r.body?.status === "incomplete" && r.body.completed_at === null,
    ),
  );
  f.fail();
  await assert.rejects(
    repositories.tasks.create(task),
    /Network fixture failure/,
  );
});

test("expired/switched account rejects old repositories before issuing data requests", async () => {
  const f = fixture();
  const r = createSupabaseRepositories(f.client, owner);
  f.changeAccount();
  await assert.rejects(r.tasks.create(task), /session changed/);
  await assert.rejects(r.tasks.list(), /session changed/);
  assert.equal(f.requests.length, 0);
});

test("estimation reads retained history with owner scoping and writes nullable manual estimates separately", async () => {
  const f = fixture();
  const r = createSupabaseRepositories(f.client, owner);
  await r.tasks.list(true);
  assert.equal(f.requests[0].url.searchParams.get("deleted_at"), null);
  assert.equal(f.requests[0].url.searchParams.get("user_id"), `eq.${owner}`);
  await r.tasks.list();
  assert.equal(f.requests[1].url.searchParams.get("deleted_at"), "is.null");
  await r.tasks.create({ ...task, estimatedMinutes: null });
  assert.equal(f.requests[2].body?.estimated_minutes, null);
  assert.equal(Object.hasOwn(f.requests[2].body!, "predicted_minutes"), false);
});

test("local discovery is non-destructive, stable, preserves all history and handles empty/corrupt data", async () => {
  const s = storage();
  assert.equal(await detectLocalImport(s), null);
  assert.equal(s.getItem(STORAGE_KEY), null);
  s.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 2, tasks: [], categories: [] }),
  );
  assert.equal(await detectLocalImport(s), null);
  const raw = JSON.stringify({
    version: 2,
    tasks: [task],
    categories: [category],
  });
  s.setItem(STORAGE_KEY, raw);
  const first = await detectLocalImport(s);
  const second = await detectLocalImport(s);
  assert.deepEqual(first, second);
  assert.deepEqual(first?.data.tasks[0], task);
  assert.equal(s.getItem(STORAGE_KEY), raw);
  s.setItem(STORAGE_KEY, "corrupt");
  await assert.rejects(detectLocalImport(s), /left untouched/);
  assert.equal(s.getItem(STORAGE_KEY), "corrupt");
});

test("v1 migrates once retaining original recovery data and relationships", async () => {
  const s = storage();
  const { categoryId, ...fields } = task;
  void categoryId;
  const original = JSON.stringify({
    version: 1,
    tasks: [{ ...fields, category: "Study" }],
  });
  s.setItem(LEGACY_STORAGE_KEY, original);
  const first = await detectLocalImport(s);
  const second = await detectLocalImport(s);
  assert.equal(first?.datasetId, second?.datasetId);
  assert.equal(first?.data.tasks[0].categoryId, first?.data.categories[0].id);
  assert.equal(s.getItem(LEGACY_STORAGE_KEY), original);
});

test("consented import marks only success and durable server ledger suppresses repeat offers", async () => {
  const s = storage();
  s.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 2, tasks: [task], categories: [category] }),
  );
  const f = fixture();
  const candidate = await pendingLocalImport(f.client, owner, s, "project");
  assert.ok(candidate);
  assert.equal(
    f.requests.some((r) => r.method === "POST"),
    false,
  );
  await importLocalData(f.client, owner, candidate, s, "project");
  assert.ok(s.getItem(markerKey("project", owner, candidate.datasetId)));
  assert.ok(s.getItem(STORAGE_KEY));
  assert.equal(await pendingLocalImport(f.client, owner, s, "project"), null);
  const copy = storage();
  copy.setItem(STORAGE_KEY, s.getItem(STORAGE_KEY)!);
  assert.equal(
    await pendingLocalImport(f.client, owner, copy, "project"),
    null,
  );
  const failure = fixture();
  failure.fail();
  await assert.rejects(
    importLocalData(failure.client, owner, candidate, copy, "project"),
  );
  assert.equal(
    copy.getItem(markerKey("project", owner, candidate.datasetId)),
    null,
  );
  const noMarker = {
    getItem: copy.getItem,
    setItem: () => {
      throw new Error("Quota");
    },
  };
  assert.match(
    await importLocalData(f.client, owner, candidate, noMarker, "project"),
    /cloud import record prevents duplicates/,
  );
});
