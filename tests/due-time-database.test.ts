import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseRepositories, taskFields } from "../lib/supabase/repositories.ts";
import type { TaskInput } from "../types/task.ts";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const input: TaskInput = { title: "QA local due-time", categoryId: null, priority: "medium",
  scheduledDate: "2026-10-04", dueDate: "2026-10-04", dueTime: "12:00", estimatedMinutes: 25 };

async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key); insert into auth.users values('${owner}'),('${other}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  const directory = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(directory)).filter(name => name.endsWith(".sql")).sort()) {
    if (file === "202610040002_task_due_time.sql") {
      await db.exec(`set role authenticated; set request.jwt.claim.sub='${owner}';
        insert into tasks(id,title,priority,scheduled_date,due_date) values('legacy','QA legacy','medium','2026-10-04','2026-10-04'); reset role;`);
    }
    await db.exec(await readFile(new URL(file, directory), "utf8"));
  }
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${owner}'`);
  return db;
}

// Explicit local transport fixture: real production adapter requests execute SQL
// in PGlite under authenticated RLS. No hosted requests or mocked successful saves.
function repository(db: PGlite) {
  const paths: string[] = [];
  const columns = new Set([...Object.keys(taskFields(input)), "user_id", "status", "completed_at", "deleted_at"]);
  const client = createClient("https://local-fixture.invalid", "fixture-public-key", {
    accessToken: async () => "fixture-token",
    global: { fetch: async (request, init) => {
      const url = new URL(String(request));
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      const method = init?.method ?? "GET";
      paths.push(method + " " + url.pathname);
      try {
        if (url.pathname.endsWith("/rpc/save_task_with_topics")) {
          await db.query("select save_task_with_topics($1,$2::jsonb,$3::text[],$4::uuid)",
            [body.p_task_id, JSON.stringify(body.p_fields), body.p_topic_ids, body.expected_user_id]);
          return new Response(null, { status: 204 });
        }
        assert.ok(url.pathname.endsWith("/tasks"));
        if (method === "GET") {
          const result = await db.query(`select t.*, t.due_date::text as due_date, t.scheduled_date::text as scheduled_date,
            coalesce((select jsonb_agg(jsonb_build_object('topic_id',topic_id))
            from task_topics tt where tt.user_id=t.user_id and tt.task_id=t.id),'[]'::jsonb) as task_topics from tasks t order by id`);
          return Response.json(result.rows);
        }
        const keys = Object.keys(body);
        assert.ok(keys.every(key => columns.has(key)));
        const values = keys.map(key => body[key]);
        if (method === "POST") {
          await db.query(`insert into tasks(${keys.join(",")}) values(${keys.map((_, i) => "$" + (i + 1)).join(",")})`, values);
          return new Response(null, { status: 201 });
        }
        assert.equal(method, "PATCH");
        values.push(url.searchParams.get("id")!.slice(3));
        const result = await db.query(`update tasks set ${keys.map((key, i) => key + "=$" + (i + 1)).join(",")}
          where id=$${values.length} and deleted_at is null returning id`, values);
        return Response.json(result.rows[0]);
      } catch (error) {
        return Response.json({ message: error instanceof Error ? error.message : String(error) }, { status: 400 });
      }
    } },
  });
  Object.defineProperty(client, "auth", { value: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) } });
  return { tasks: createSupabaseRepositories(client, owner).tasks, paths };
}

test("due time survives production adapter direct and topic RPC create/edit/read/clear against the full local schema", async () => {
  const db = await database();
  try {
    const { tasks, paths } = repository(db);
    assert.equal((await tasks.list()).find(t => t.id === "legacy")?.dueTime, null);
    await db.exec("insert into topics(id,name) values('topic','QA local topic')");
    for (const topicIds of [undefined, ["topic"]]) {
      const title = topicIds ? "QA RPC" : "QA direct";
      await tasks.create({ ...input, title, topicIds });
      const task = (await tasks.list()).find(t => t.title === title)!;
      assert.equal(task.dueTime, "12:00");
      await tasks.update(task.id, { ...input, title, topicIds, dueTime: "00:00" });
      assert.equal((await tasks.list()).find(t => t.id === task.id)?.dueTime, "00:00");
      await tasks.update(task.id, { ...input, title, topicIds, dueTime: null });
      const cleared = (await tasks.list()).find(t => t.id === task.id)!;
      assert.equal(cleared.dueTime, null); assert.equal(cleared.dueDate, input.dueDate);
      await tasks.update(task.id, { ...input, title, topicIds });
      await tasks.update(task.id, { ...input, title, topicIds, dueDate: null, dueTime: null });
      assert.equal((await tasks.list()).find(t => t.id === task.id)?.dueTime, null);
    }
    assert.ok(paths.includes("POST /rest/v1/tasks"));
    assert.ok(paths.includes("PATCH /rest/v1/tasks"));
    assert.ok(paths.includes("POST /rest/v1/rpc/save_task_with_topics"));
    await db.exec("update tasks set due_time='12:30' where id='legacy'; update tasks set due_date=null where id='legacy'");
    assert.equal((await tasks.list()).find(t => t.id === "legacy")?.dueTime, null);
  } finally { await db.close(); }
});

test("due-time constraints, topic atomicity, legacy RPC compatibility, ownership and imports remain enforced", async () => {
  const db = await database();
  try {
    for (const time of ["24:00", "12:30:01", "12:30:00.1"]) {
      await assert.rejects(db.query("update tasks set due_time=$1::time where id='legacy'", [time]), /tasks_due_time_valid/);
    }
    await assert.rejects(db.exec("insert into tasks(title,priority,scheduled_date,due_time) values('QA invalid','low','2026-10-04','12:00')"), /tasks_due_time_valid/);
    await db.exec("insert into topics(id,name) values('keep','QA Keep'); update tasks set due_time='09:00' where id='legacy'");
    const save = (fields: object, ids: string[] = ["keep"], expected = owner) => db.query(
      "select save_task_with_topics('legacy',$1::jsonb,$2::text[],$3::uuid)", [JSON.stringify(fields), ids, expected]);
    const legacyFields = { ...taskFields(input) } as Record<string, unknown>;
    delete legacyFields.due_time;
    await save(legacyFields);
    assert.equal((await db.query<{ due_time: string }>("select due_time from tasks where id='legacy'")).rows[0].due_time, "09:00:00");
    await assert.rejects(save({ ...taskFields(input), title: "Must roll back" }, ["missing"]), /active topic/);
    assert.equal((await db.query<{ due_time: string }>("select due_time from tasks where id='legacy'")).rows[0].due_time, "09:00:00");
    assert.equal((await db.query("select * from task_topics where task_id='legacy'")).rows.length, 1);
    await assert.rejects(save(taskFields(input), [], other), /session changed/);
    await db.exec(`set request.jwt.claim.sub='${other}'`);
    assert.equal((await db.query("select * from tasks")).rows.length, 0);
    await assert.rejects(save(taskFields(input), [], other), /no longer available/);
    await db.exec(`set request.jwt.claim.sub='${owner}'`);
    const recovery = (id: string, dueTime?: string) => ({ ...input, id, dueTime, status: "incomplete", createdAt: "2026-10-01T00:00:00Z", completedAt: null, deletedAt: null });
    const payload = { version: 2, categories: [], tasks: [recovery("import-timed", "17:45"), recovery("import-legacy")] };
    await db.query("select import_local_data($1,$2::jsonb,$3::uuid)", ["a".repeat(64), JSON.stringify(payload), owner]);
    const rows = (await db.query<{ id: string; due_time: string | null }>("select id,due_time from tasks where id like 'import-%' order by id")).rows;
    assert.deepEqual(rows, [{ id: "import-legacy", due_time: null }, { id: "import-timed", due_time: "17:45:00" }]);
    await db.query("select import_local_data($1,$2::jsonb,$3::uuid)", ["a".repeat(64), JSON.stringify(payload), owner]);
    await assert.rejects(db.exec("delete from tasks"));
    await db.exec("reset role; set role anon");
    await assert.rejects(db.exec("select * from tasks"));
    await assert.rejects(save(taskFields(input)));
  } finally { await db.close(); }
});
