import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseRepositories } from "../lib/supabase/repositories.ts";

const owner = "11111111-1111-4111-8111-111111111111";
function fixture() {
  const requests: { url: URL; method: string; body: Record<string, unknown> | null }[] = [];
  let account = owner;
  let failure = false;
  const client = createClient("https://fixture.supabase.co", "fixture-public-key", {
    accessToken: async () => "fixture-token",
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null;
      requests.push({ url, method, body });
      if (failure) return new Response(JSON.stringify({ message: "Classification unavailable" }), { status: 503 });
      const row = { id: "record", name: "Accounting", code: "ACCT 151", archived_at: "2026-01-02T00:00:00Z", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-02T00:00:00Z" };
      const response = method === "PATCH" ? { id: "record" } : method === "POST" ? null : [row];
      return new Response(JSON.stringify(response), { status: 200, headers: { "Content-Type": "application/json" } });
    } },
  });
  Object.defineProperty(client, "auth", { value: { getUser: async () => ({ data: { user: { id: account } }, error: null }) } });
  return { repositories: createSupabaseRepositories(client, owner), requests, fail: () => { failure = true; }, changeAccount: () => { account = "different"; } };
}

test("course and task-type adapters preserve identity/timestamps, scope lifecycle requests and retain archives", async () => {
  const f = fixture();
  await f.repositories.courses.create({ name: " Accounting ", code: " ACCT 151 " });
  const [course] = await f.repositories.courses.list();
  assert.equal(course.code, "ACCT 151"); assert.ok(course.archivedAt); assert.ok(course.createdAt); assert.ok(course.updatedAt);
  await f.repositories.courses.update("record", { name: "Accounting I", code: null });
  await f.repositories.courses.setArchived("record", true);
  await f.repositories.courses.setArchived("record", false);
  await f.repositories.taskTypes.create({ name: "Homework" });
  const [type] = await f.repositories.taskTypes.list();
  assert.equal(type.name, "Accounting"); assert.ok(type.archivedAt); assert.ok(type.createdAt); assert.ok(type.updatedAt);
  await f.repositories.taskTypes.update("record", { name: "Exam Prep" });
  await f.repositories.taskTypes.setArchived("record", true);
  await f.repositories.taskTypes.setArchived("record", false);
  for (const request of f.requests) {
    assert.notEqual(request.method, "DELETE");
    if (request.method === "POST") assert.equal(request.body?.user_id, owner);
    else assert.equal(request.url.searchParams.get("user_id"), `eq.${owner}`);
    if (request.method === "GET") {
      assert.equal(request.url.searchParams.has("archived_at"), false);
      assert.equal(request.url.searchParams.get("limit"), "500");
      assert.equal(request.url.searchParams.get("order"), "id.asc");
    }
    if (request.method === "PATCH") assert.equal(request.url.searchParams.get("id"), "eq.record");
  }
  assert.equal(f.requests[0].body?.name, "Accounting");
  assert.equal(f.requests[0].body?.code, "ACCT 151");
  f.fail();
  await assert.rejects(f.repositories.courses.list(), /Classification unavailable/);
  await assert.rejects(f.repositories.taskTypes.create({ name: "Practice" }), /Classification unavailable/);
});
test("classification adapters reject switched ownership and invalid names before issuing writes", async () => {
  const f = fixture();
  await assert.rejects(f.repositories.courses.create({ name: " " }));
  await assert.rejects(f.repositories.taskTypes.update("record", { name: " " }));
  assert.equal(f.requests.length, 0);
  f.changeAccount();
  await assert.rejects(f.repositories.courses.list(), /session changed/);
  await assert.rejects(f.repositories.taskTypes.create({ name: "Research" }), /session changed/);
  await assert.rejects(f.repositories.courses.setArchived("record", true), /session changed/);
  assert.equal(f.requests.length, 0);
});
test("task writes persist independent nullable classification references and preserve the manual value", async () => {
  const f = fixture();
  const input = { title: "Chapter 7", categoryId: null, courseId: "acct", taskTypeId: "hw", priority: "medium" as const,
    scheduledDate: "2026-10-03", dueDate: null, estimatedMinutes: 45 };
  await f.repositories.tasks.create(input);
  assert.equal(f.requests[0].body?.category_id, null);
  assert.equal(f.requests[0].body?.course_id, "acct");
  assert.equal(f.requests[0].body?.task_type_id, "hw");
  assert.equal(f.requests[0].body?.estimated_minutes, 45);
  await f.repositories.tasks.update("record", { ...input, courseId: null, taskTypeId: null });
  assert.equal(f.requests[1].body?.course_id, null);
  assert.equal(f.requests[1].body?.task_type_id, null);
  assert.equal(f.requests[1].body?.estimated_minutes, 45);
});


test("topic adapter scopes lifecycle and rejects changed accounts or persistence failures", async () => {
  const f = fixture(); const r = f.repositories.topics;
  await r.create({ name: " Chapter 8 " });
  const [topic] = await r.list();
  assert.ok(topic.archivedAt); assert.ok(topic.createdAt); assert.ok(topic.updatedAt);
  await r.update("record", { name: "Chapter Eight" });
  await r.setArchived("record", true); await r.setArchived("record", false);
  assert.equal(f.requests[0].body?.name, "Chapter 8");
  for (const request of f.requests) {
    assert.ok(request.url.pathname.endsWith("/topics"));
    if (request.method === "POST") assert.equal(request.body?.user_id, owner);
    else assert.equal(request.url.searchParams.get("user_id"), "eq." + owner);
  }
  f.changeAccount();
  for (const operation of [() => r.list(), () => r.create({name:"New"}), () => r.update("record",{name:"New"}), () => r.setArchived("record",true)]) {
    await assert.rejects(operation(), /session changed/);
  }
  const failed = fixture(); failed.fail();
  await assert.rejects(failed.repositories.topics.list(), /Classification unavailable/);
  await assert.rejects(failed.repositories.topics.create({ name: "New" }), /Classification unavailable/);
});

test("task adapter uses one atomic RPC for topic selections, including clearing all and preserving omitted legacy fields", async () => {
  const f = fixture(); const r = f.repositories.tasks;
  const input = { title:"Study", categoryId:null, priority:"medium" as const, scheduledDate:"2026-10-03", dueDate:null, estimatedMinutes:null, topicIds:["one","two","one"] };
  await r.create(input);
  await r.update("record", { ...input, topicIds: [] });
  assert.equal(f.requests.length, 2);
  assert.ok(f.requests.every((request) => request.url.pathname.endsWith("/rpc/save_task_with_topics")));
  assert.deepEqual(f.requests[0].body?.p_topic_ids, ["one", "two"]);
  assert.equal(f.requests[0].body?.p_task_id, null);
  assert.equal(f.requests[0].body?.expected_user_id, owner);
  assert.deepEqual(f.requests[1].body?.p_topic_ids, []);
  assert.equal(f.requests[1].body?.p_task_id, "record");
  const { topicIds, ...legacy } = input; void topicIds;
  await r.update("record", legacy);
  assert.equal(f.requests[2].method, "PATCH");
  assert.ok(!Object.hasOwn(f.requests[2].body!, "topic_ids"));
  f.fail(); await assert.rejects(r.update("record", input), /Classification unavailable/);
  const pinned=fixture(); pinned.changeAccount();
  await assert.rejects(pinned.repositories.tasks.create(input), /session changed/);
  assert.equal(pinned.requests.length, 0);
});
