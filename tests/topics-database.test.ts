import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const fields = { title: "Study", category_id: null, course_id: null, task_type_id: null, priority: "medium", due_date: "2026-10-03", scheduled_date: "2026-10-03", estimated_minutes: null };
async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key); insert into auth.users values('${alice}'),('${bob}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  for (const name of ["202609290001_milestone2.sql", "202609300001_time_sessions.sql", "202610030001_optional_manual_estimate.sql", "202610030002_task_classification.sql"]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
  }
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}';
    insert into tasks(id,title,priority,scheduled_date,estimated_minutes) values('old','Existing','low','2026-10-03',35); reset role;`);
  await db.exec(await readFile(new URL("../supabase/migrations/202610030003_task_topics.sql", import.meta.url), "utf8"));
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}';`);
  return db;
}
async function save(db: PGlite, id: string | null, ids: string[], title = "Study", owner = alice) {
  await db.query("select save_task_with_topics($1,$2::jsonb,$3::text[],$4::uuid)", [id, JSON.stringify({ ...fields, title }), ids, owner]);
}

test("topics migration preserves existing tasks and supports rename, archive/restore and many-to-many history", async () => {
  const db = await database();
  try {
    assert.equal((await db.query("select * from task_topics")).rows.length, 0);
    assert.equal((await db.query<{ estimated_minutes: number }>("select * from tasks where id='old'")).rows[0].estimated_minutes, 35);
    await db.exec("insert into topics(id,name) values('entries','Adjusting Entries'),('chapter','Chapter 8'); update topics set name='Chapter Eight' where id='chapter'");
    await save(db, "old", ["entries", "chapter", "chapter"]);
    assert.equal((await db.query("select * from task_topics")).rows.length, 2);
    await db.exec("update tasks set status='completed' where id='old'; update topics set archived_at=now() where id='chapter'");
    await save(db, "old", ["entries", "chapter"], "Retained history");
    assert.equal((await db.query("select * from task_topics join topics on topics.user_id=task_topics.user_id and topics.id=topic_id where archived_at is not null")).rows.length, 1);
    await assert.rejects(save(db, null, ["chapter"]), /active topic/);
    await save(db, "old", ["entries"]);
    await assert.rejects(save(db, "old", ["entries", "chapter"]), /active topic/);
    await db.exec("update topics set archived_at=null where id='chapter'");
    await save(db, "old", ["chapter"]);
    assert.deepEqual((await db.query<{ topic_id: string }>("select topic_id from task_topics")).rows.map((row) => row.topic_id), ["chapter"]);
    await db.exec("update tasks set deleted_at=now() where id='old'; update topics set archived_at=now()");
    assert.equal((await db.query("select * from task_topics")).rows.length, 1);
    await assert.rejects(save(db, "old", []), /no longer available/);
    await assert.rejects(db.exec("delete from topics"));
    await assert.rejects(db.exec("update topics set id='changed'"));
    await assert.rejects(db.exec("insert into topics(name) values(' chapter eight ')"));
    await assert.rejects(db.exec("insert into topics(name) values(' ')"));
    await assert.rejects(db.exec("insert into topics(name) values(repeat('x',61))"));
    await assert.rejects(db.exec("update task_topics set topic_id='entries'"));
  } finally { await db.close(); }
});

test("topics RLS isolates owners, prevents spoofed relationships and denies anonymous access", async () => {
  const db = await database();
  try {
    await db.exec("insert into topics(id,name) values('private','Private'); insert into task_topics(task_id,topic_id) values('old','private')");
    await db.exec(`set request.jwt.claim.sub='${bob}'`);
    for (const table of ["topics", "task_topics"]) assert.equal((await db.query(`select * from ${table}`)).rows.length, 0);
    await assert.rejects(db.exec(`insert into topics(user_id,name) values('${alice}','Spoof')`));
    await assert.rejects(db.exec(`insert into task_topics(user_id,task_id,topic_id) values('${alice}','old','private')`));
    await assert.rejects(save(db, "old", [], "Stolen", bob), /no longer available/);
    await assert.rejects(save(db, null, ["private"], "Cross user", bob), /active topic/);
    await assert.rejects(save(db, null, [], "Wrong session", alice), /session changed/);
    await db.exec("delete from task_topics; update topics set name='Stolen'; insert into topics(id,name) values('private','Bob private')");
    await db.exec(`set request.jwt.claim.sub='${alice}'`);
    assert.equal((await db.query("select * from task_topics")).rows.length, 1);
    assert.equal((await db.query<{ name: string }>("select name from topics")).rows[0].name, "Private");
    await db.exec("reset role; set role anon");
    for (const table of ["topics", "task_topics"]) await assert.rejects(db.exec(`select * from ${table}`));
    await assert.rejects(save(db, null, []));
  } finally { await db.close(); }
});

test("topic save rolls back fields and associations together on invalid assignment and survives reload", async () => {
  const db = await database();
  try {
    await db.exec("insert into topics(id,name) values('one','One'),('two','Two')");
    await save(db, "old", ["one"]);
    await assert.rejects(save(db, "old", ["two", "missing"], "Must roll back"));
    assert.equal((await db.query<{ title: string }>("select title from tasks where id='old'")).rows[0].title, "Study");
    assert.deepEqual((await db.query<{ topic_id: string }>("select topic_id from task_topics")).rows.map((row) => row.topic_id), ["one"]);
    const count = (await db.query("select * from tasks")).rows.length;
    await assert.rejects(save(db, null, ["missing"]));
    assert.equal((await db.query("select * from tasks")).rows.length, count);
    // New transaction/read under the authenticated role reconstructs selection.
    await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${alice}'`);
    assert.equal((await db.query("select * from task_topics where task_id='old'")).rows.length, 1);
    await save(db, "old", []);
    assert.equal((await db.query("select * from task_topics")).rows.length, 0);
  } finally { await db.close(); }
});
