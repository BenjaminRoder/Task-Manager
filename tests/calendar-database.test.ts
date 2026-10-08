import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { createCalendarRepositories, eventFields, classFields } from "../lib/supabase/calendar-repositories.ts";

const alice = "11111111-1111-4111-8111-111111111111", bob = "22222222-2222-4222-8222-222222222222";
const event = { title: "QA local event", date: "2026-10-05", startTime: "09:00", endTime: "10:00", taskId: "task", courseId: "course" };
const pattern = { title: "QA local class", weekdays: [1, 3] as const, startTime: "09:00", endTime: "10:00", courseId: "course", startDate: null, endDate: null };
async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key); insert into auth.users values('${alice}'),('${bob}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  const directory = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(directory)).filter(name => name.endsWith(".sql")).sort()) {
    await db.exec(await readFile(new URL(file, directory), "utf8"));
  }
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${bob}';
    insert into courses(id,name) values('foreign-course','QA Foreign');
    insert into tasks(id,title,priority,scheduled_date) values('foreign-task','QA Foreign task','low','2026-10-05');
    set request.jwt.claim.sub='${alice}';
    insert into courses(id,name) values('course','QA Course');
    insert into tasks(id,title,priority,scheduled_date,due_date,due_time) values('task','QA Task','medium','2026-10-05','2026-10-05','12:00');
    insert into books(id,title,total_pages,status,started_date) values('book','QA Book',100,'reading','2026-10-05');
    insert into reading_sessions(book_id,session_date,start_page,end_page,minutes) values('book','2026-10-05',0,10,5);
    insert into time_sessions(task_id,started_at,ended_at) values('task','2026-01-01T09:00:00Z','2026-01-01T09:10:00Z');`);
  return db;
}
async function insert(db: PGlite, table: "calendar_events" | "recurring_class_patterns", fields: object) {
  const entries = Object.entries(fields);
  return db.query<{ id: string }>(`insert into ${table}(${entries.map(([key]) => key).join(",")}) values(${entries.map((_, i) => "$" + (i + 1)).join(",")}) returning id`, entries.map(([, value]) => value));
}

test("calendar schema validates both retained records, archive/restore and unchanged historical links", async () => {
  const db = await database();
  try {
    const before = await db.query("select (select count(*) from time_sessions)::int as timers,(select sum(pages_read) from reading_sessions)::int as pages,(select due_time::text from tasks where id='task') as due_time");
    await insert(db, "calendar_events", { id: "event", ...eventFields(event) });
    await insert(db, "recurring_class_patterns", { id: "class", ...classFields(pattern) });
    await db.exec("update courses set archived_at=now() where id='course'; update tasks set deleted_at=now() where id='task'; update calendar_events set title='QA Retained', archived_at=now() where id='event'; update recurring_class_patterns set archived_at=now() where id='class'");
    await db.exec("update calendar_events set archived_at=null,task_id='task',course_id='course'; update recurring_class_patterns set archived_at=null,course_id='course'");
    assert.equal((await db.query("select * from calendar_events")).rows.length, 1);
    assert.equal((await db.query("select * from recurring_class_patterns")).rows.length, 1);
    await assert.rejects(insert(db, "calendar_events", eventFields(event)), /active course|available task/);
    await assert.rejects(insert(db, "recurring_class_patterns", classFields(pattern)), /active course/);
    for (const table of ["calendar_events", "recurring_class_patterns"]) {
      await assert.rejects(db.exec(`delete from ${table}`));
      await assert.rejects(db.exec(`update ${table} set id='changed'`), /identity cannot change/);
      await assert.rejects(db.exec(`update ${table} set user_id='${bob}'`), /identity cannot change/);
      const beforeCreated = (await db.query(`select created_at from ${table}`)).rows;
      await db.exec(`update ${table} set created_at='2000-01-01'`);
      assert.deepEqual((await db.query(`select created_at from ${table}`)).rows, beforeCreated);
    }
    const after = await db.query("select (select count(*) from time_sessions)::int as timers,(select sum(pages_read) from reading_sessions)::int as pages,(select due_time::text from tasks where id='task') as due_time");
    assert.deepEqual(after.rows, before.rows);
    assert.equal((await db.query<{ current_page: number }>("select current_page from books_with_progress where id='book'")).rows[0].current_page, 10);
  } finally { await db.close(); }
});

test("calendar schema rejects foreign links, spoofed owners, anonymous access and invalid date/time/weekday ranges", async () => {
  const db = await database();
  try {
    for (const table of ["calendar_events", "recurring_class_patterns"] as const) {
      const valid = table === "calendar_events" ? eventFields(event) : classFields(pattern);
      await insert(db, table, { ...valid, id: "private" });
      for (const fields of [{ start_time: "10:00", end_time: "09:00" }, { end_time: "09:00" }, { end_time: "24:00" }, { start_time: "09:00:00.1" }, { end_time: "10:00:01" }, { title: " " }, { course_id: "foreign-course" }, { user_id: bob }])
        await assert.rejects(insert(db, table, { ...valid, ...fields }));
      await db.exec(`set request.jwt.claim.sub='${bob}'`);
      assert.equal((await db.query(`select * from ${table}`)).rows.length, 0);
      await db.exec(`update ${table} set title='Stolen'`);
      await db.exec(`set request.jwt.claim.sub='${alice}'`);
      assert.notEqual((await db.query<{ title: string }>(`select title from ${table} where id='private'`)).rows[0].title, "Stolen");
    }
    for (const fields of [{ event_date: "infinity" }, { event_date: "2026-02-30" }, { task_id: "foreign-task" }]) await assert.rejects(insert(db, "calendar_events", { ...eventFields(event), ...fields }));
    for (const fields of [{ weekdays: [] }, { weekdays: [1, 1] }, { weekdays: [null] }, { weekdays: [7] }, { weekdays: [-1] }, { weekdays: [[1, 2], [3, 4]] }, { start_date: "infinity" }, { end_date: "-infinity" }, { start_date: "2026-10-10", end_date: "2026-10-01" }])
      await assert.rejects(insert(db, "recurring_class_patterns", { ...classFields(pattern), ...fields }));
    await db.exec("reset role; set role anon");
    for (const table of ["calendar_events", "recurring_class_patterns"] as const) {
      await assert.rejects(db.exec(`select * from ${table}`));
      await assert.rejects(insert(db, table, table === "calendar_events" ? eventFields(event) : classFields(pattern)));
    }
  } finally { await db.close(); }
});

test("calendar production adapters round-trip both record types through an authenticated local SQL transport", async () => {
  const db = await database();
  try {
    let currentOwner = alice, fail = false;
    const requests: string[] = [];
    const client = createClient("https://calendar-fixture.invalid", "fixture-public-key", { accessToken: async () => "fixture-token", global: { fetch: async (request, init) => {
      const url = new URL(String(request)), table = url.pathname.split("/").at(-1)!;
      assert.ok(table === "calendar_events" || table === "recurring_class_patterns");
      const method = init?.method ?? "GET"; requests.push(method + " " + table);
      assert.equal(method === "POST" ? JSON.parse(String(init?.body)).user_id : url.searchParams.get("user_id"), method === "POST" ? alice : "eq." + alice);
      if (fail) return Response.json({ message: "QA unavailable" }, { status: 503 });
      try {
        if (method === "GET") {
          const dates = table === "calendar_events" ? "event_date::text as event_date" : "start_date::text as start_date,end_date::text as end_date";
          return Response.json((await db.query(`select *,${dates} from ${table} order by id`)).rows);
        }
        const body = JSON.parse(String(init?.body));
        if (method === "POST") { await insert(db, table, body); return new Response(null, { status: 201 }); }
        assert.equal(method, "PATCH");
        const entries = Object.entries(body), values = entries.map(([, value]) => value);
        values.push(url.searchParams.get("id")!.slice(3));
        const result = await db.query(`update ${table} set ${entries.map(([key], index) => key + "=$" + (index + 1)).join(",")} where id=$${values.length} returning id`, values);
        return Response.json(result.rows[0]);
      } catch (error) { return Response.json({ message: error instanceof Error ? error.message : String(error) }, { status: 400 }); }
    } } });
    Object.defineProperty(client, "auth", { value: { getUser: async () => ({ data: { user: { id: currentOwner } }, error: null }) } });
    const repositories = createCalendarRepositories(client, alice);
    await repositories.events.create(event); await repositories.classes.create(pattern);
    const savedEvent = (await repositories.events.list())[0], savedClass = (await repositories.classes.list())[0];
    assert.equal(savedEvent.startTime, "09:00"); assert.equal(savedEvent.date, event.date);
    assert.deepEqual(savedClass.weekdays, [1, 3]);
    await repositories.events.update(savedEvent.id, { ...event, title: "QA edited", endTime: "11:00" });
    await repositories.classes.update(savedClass.id, { ...pattern, weekdays: [2], startDate: "2026-10-01", endDate: "2026-11-01" });
    assert.equal((await repositories.events.list())[0].endTime, "11:00");
    assert.equal((await repositories.classes.list())[0].endDate, "2026-11-01");
    for (const [repository, id] of [[repositories.events, savedEvent.id], [repositories.classes, savedClass.id]] as const) {
      await repository.setArchived(id, true); assert.ok((await repository.list())[0].archivedAt);
      await repository.setArchived(id, false); assert.equal((await repository.list())[0].archivedAt, null);
    }
    fail = true; await assert.rejects(repositories.events.list(), /QA unavailable/); fail = false;
    const count = requests.length; currentOwner = bob;
    await assert.rejects(repositories.classes.create(pattern), /session changed/);
    assert.equal(requests.length, count);
    assert.ok(!requests.some(request => request.startsWith("DELETE")));
  } finally { await db.close(); }
});
