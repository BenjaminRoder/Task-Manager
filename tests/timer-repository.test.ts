import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createTimeSessionRepository } from "../lib/supabase/time-session-repository.ts";
import type { TimeSession } from "../types/time-session.ts";
const owner = "11111111-1111-4111-8111-111111111111";
const row = {
  id: "33333333-3333-4333-8333-333333333333",
  user_id: owner,
  task_id: "task",
  started_at: "2026-01-01T00:00:00Z",
  ended_at: "2026-01-01T00:01:00Z",
  duration_seconds: 60,
  voided_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:01:00Z",
};
test("timer adapter scopes reads and corrections, uses RPC consent/identity, paginates and surfaces failures", async () => {
  const requests: {
    url: URL;
    method: string;
    body: Record<string, unknown> | null;
  }[] = [];
  let failed = false,
    currentOwner = owner;
  const client = createClient("https://fixture.supabase.co", "fixture-public", {
    accessToken: async () => "fixture",
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input)),
          method = init?.method ?? "GET",
          body = init?.body ? JSON.parse(String(init.body)) : null;
        requests.push({ url, method, body });
        if (failed)
          return new Response(JSON.stringify({ message: "fixture failure" }), {
            status: 503,
          });
        let data: unknown = null;
        if (url.pathname.endsWith("/time_sessions"))
          data =
            method === "GET"
              ? url.searchParams.get("offset") === "500"
                ? [row]
                : Array.from({ length: 500 }, (_, i) => ({
                    ...row,
                    id: `row-${i}`,
                  }))
              : { id: row.id };
        if (url.pathname.endsWith("/tasks")) data = { title: "Task" };
        if (url.pathname.endsWith("/timer_server_time"))
          data = "2026-09-30T00:00:00Z";
        return new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });
  Object.defineProperty(client, "auth", {
    value: {
      getUser: async () => ({
        data: { user: { id: currentOwner } },
        error: null,
      }),
    },
  });
  const repo = createTimeSessionRepository(client, owner);
  const sessions = await repo.list();
  assert.equal(sessions.length, 501);
  assert.equal(sessions[0].durationSeconds, 60);
  assert.equal(await repo.serverTime(), Date.parse("2026-09-30T00:00:00Z"));
  assert.equal(await repo.taskTitle("task"), "Task");
  await repo.start("task", row.id, null);
  await repo.start("other", row.id, row.id);
  await repo.stop(row.id);
  const session = { ...sessions[0], id: row.id } as TimeSession;
  await repo.update(session, {
    startedAt: row.started_at,
    endedAt: "2026-01-01T00:02:00Z",
  });
  await repo.remove(session);
  for (const request of requests.filter((r) =>
    r.url.pathname.endsWith("/time_sessions"),
  )) {
    assert.equal(request.url.searchParams.get("user_id"), `eq.${owner}`);
    if (request.method === "PATCH") {
      assert.equal(
        request.url.searchParams.get("updated_at"),
        `eq.${row.updated_at}`,
      );
      assert.equal(request.url.searchParams.get("ended_at"), "not.is.null");
    }
  }
  const starts = requests.filter((r) =>
    r.url.pathname.endsWith("/start_task_timer"),
  );
  assert.equal(starts[0].body?.expected_active, null);
  assert.equal(starts[1].body?.expected_active, row.id);
  assert.equal(starts[0].body?.expected_user, owner);
  failed = true;
  await assert.rejects(repo.stop(row.id), /fixture failure/);
  const count = requests.length;
  currentOwner = "other";
  await assert.rejects(repo.start("task", row.id, null), /session changed/);
  assert.equal(requests.length, count);
});
