import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { taskFromRow, type TaskRow } from "../lib/supabase/repositories.ts";
import { sessionFromRow, type SessionRow } from "../lib/supabase/time-session-repository.ts";
import { predictTasks } from "../lib/estimation/duration-estimation.ts";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key); insert into auth.users values('${alice}'),('${bob}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  for (const name of ["202609290001_milestone2.sql", "202609300001_time_sessions.sql", "202610030001_optional_manual_estimate.sql"]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
  }
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}';
    insert into categories(id,name,color) values('school','School','#123456');
    insert into tasks(id,title,category_id,priority,scheduled_date,estimated_minutes)
    values('old','Pre-migration task','school','medium','2026-10-03',35);
    reset role;`);
  await db.exec(await readFile(new URL("../supabase/migrations/202610030002_task_classification.sql", import.meta.url), "utf8"));
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}';`);
  return db;
}

test("classification migration preserves tasks and enforces lifecycle, archives, references and two-owner RLS", async () => {
  const db = await database();
  try {
    const old = (await db.query<{ category_id: string; course_id: string | null; task_type_id: string | null; estimated_minutes: number }>("select * from tasks where id='old'")).rows[0];
    assert.equal(old.category_id, "school"); assert.equal(old.course_id, null); assert.equal(old.task_type_id, null); assert.equal(old.estimated_minutes, 35);
    await db.exec(`insert into courses(id,name,code) values('acct','Accounting','ACCT 151');
      insert into task_types(id,name) values('hw','Homework');
      update courses set name='Accounting I',code='ACCT 151A' where id='acct';
      update task_types set name='Problem sets' where id='hw';
      insert into tasks(id,title,priority,scheduled_date,estimated_minutes,course_id,task_type_id)
      values('classified','Chapter 7','medium','2026-10-03',null,'acct','hw'),('title-only','Only title','medium','2026-10-03',null,null,null);
      update courses set archived_at=now() where id='acct';
      update task_types set archived_at=now() where id='hw';
      update tasks set title='Retains archived classifications',course_id='acct',task_type_id='hw' where id='classified';`);
    assert.equal((await db.query<{ name: string }>("select name from courses where id='acct'")).rows[0].name, "Accounting I");
    assert.equal((await db.query<{ name: string }>("select name from task_types where id='hw'")).rows[0].name, "Problem sets");
    for (const table of ["courses", "task_types"]) {
      const timestamps = (await db.query<{ created_at: Date; updated_at: Date }>(`select created_at,updated_at from ${table}`)).rows[0];
      assert.ok(timestamps.created_at); assert.ok(timestamps.updated_at);
      await assert.rejects(db.exec(`delete from ${table}`));
      await assert.rejects(db.exec(`update ${table} set id='different'`));
      await assert.rejects(db.exec(`update ${table} set user_id='${bob}'`));
    }
    await assert.rejects(db.exec("update tasks set course_id='acct' where id='title-only'"));
    await assert.rejects(db.exec("update tasks set task_type_id='hw' where id='title-only'"));
    await assert.rejects(db.exec("insert into tasks(title,priority,scheduled_date,course_id) values('Archived','low','2026-10-03','acct')"));
    await assert.rejects(db.exec("insert into tasks(title,priority,scheduled_date,task_type_id) values('Archived','low','2026-10-03','hw')"));
    await db.exec("update courses set archived_at=null; update task_types set archived_at=null; update tasks set course_id='acct',task_type_id='hw' where id='title-only'");
    await assert.rejects(db.exec("insert into courses(name) values(' accounting i ')"));
    await assert.rejects(db.exec("insert into task_types(name) values('PROBLEM SETS')"));
    await assert.rejects(db.exec("insert into courses(name,code) values('Bad',repeat('a',21))"));
    await assert.rejects(db.exec("insert into task_types(name) values(' ')"));
    await db.exec(`set request.jwt.claim.sub='${bob}';`);
    assert.equal((await db.query("select * from courses")).rows.length, 0);
    assert.equal((await db.query("select * from task_types")).rows.length, 0);
    await assert.rejects(db.exec(`insert into courses(user_id,name) values('${alice}','Spoofed')`));
    await assert.rejects(db.exec(`insert into task_types(user_id,name) values('${alice}','Spoofed')`));
    await assert.rejects(db.exec("insert into tasks(title,priority,scheduled_date,course_id) values('Cross owner','low','2026-10-03','acct')"));
    await assert.rejects(db.exec("insert into tasks(title,priority,scheduled_date,task_type_id) values('Cross owner','low','2026-10-03','hw')"));
    await db.exec("update courses set name='Stolen'; update task_types set name='Stolen'; insert into courses(id,name) values('acct','Bob course'); insert into task_types(id,name) values('hw','Bob type')");
    await db.exec(`set request.jwt.claim.sub='${alice}';`);
    assert.equal((await db.query<{ name: string }>("select name from courses")).rows[0].name, "Accounting I");
    await db.exec("update tasks set status='completed' where id='classified'; update tasks set deleted_at=now() where id='classified'; update courses set archived_at=now(); update task_types set archived_at=now()");
    assert.equal((await db.query("select * from tasks join courses on courses.user_id=tasks.user_id and courses.id=tasks.course_id join task_types on task_types.user_id=tasks.user_id and task_types.id=tasks.task_type_id where tasks.id='classified'")).rows.length, 1);
    // Composite FKs also protect relationships against privileged accidental deletion.
    await db.exec("reset role");
    await assert.rejects(db.exec(`delete from courses where user_id='${alice}'`));
    await assert.rejects(db.exec(`delete from task_types where user_id='${alice}'`));
    await db.exec("set role anon");
    for (const table of ["courses", "task_types"]) {
      await assert.rejects(db.exec(`select * from ${table}`));
      await assert.rejects(db.exec(`insert into ${table}(name) values('Anonymous')`));
    }
  } finally { await db.close(); }
});

test("persisted historical reclassification changes derived hierarchy while retaining timer and history rules", async () => {
  const db = await database();
  try {
    await db.exec("insert into courses(id,name) values('acct','Accounting'),('econ','Economics'); insert into task_types(id,name) values('hw','Homework'),('exam','Exam Prep')");
    for (let index = 1; index <= 3; index++) {
      const id = `historical-${index}`; const sessionId = crypto.randomUUID();
      await db.query("insert into tasks(id,title,category_id,priority,scheduled_date,estimated_minutes,course_id,task_type_id) values($1,$1,'school','medium','2026-10-03',null,'acct','hw')", [id]);
      await db.query("select start_task_timer($1,$2,null,$3)", [id, sessionId, alice]);
      await db.query("select stop_task_timer($1,$2)", [sessionId, alice]);
      await db.query("update time_sessions set started_at='2026-01-01T00:00:00Z',ended_at=$1 where id=$2", [`2026-01-01T00:${index * 10}:00Z`, sessionId]);
      await db.query("update tasks set status='completed' where id=$1", [id]);
    }
    await db.exec("insert into tasks(id,title,category_id,priority,scheduled_date,course_id,task_type_id) values('target','Next','school','medium','2026-10-03','acct','hw')");
    async function prediction() {
      const tasks = (await db.query<TaskRow>("select * from tasks")).rows.map(taskFromRow);
      const sessions = (await db.query<SessionRow>("select * from time_sessions")).rows.map(sessionFromRow);
      return predictTasks(tasks, sessions).get("target")!;
    }
    assert.equal((await prediction()).source, "course_task_type");
    await db.exec("update tasks set task_type_id='exam' where id='historical-3'");
    assert.equal((await prediction()).source, "course");
    await db.exec("update tasks set course_id='econ',task_type_id='hw' where id like 'historical-%'");
    assert.equal((await prediction()).source, "category_task_type");
    await db.exec("update tasks set category_id=null where id like 'historical-%'");
    assert.equal((await prediction()).source, "task_type");
    await db.exec("update tasks set category_id='school',task_type_id='exam' where id like 'historical-%'");
    assert.equal((await prediction()).source, "category");
    await db.exec("update tasks set category_id=null where id like 'historical-%'");
    assert.equal((await prediction()).source, "global");
    await db.exec("update tasks set deleted_at=now() where id='historical-1'");
    assert.equal((await prediction()).sampleSize, 3);
    await db.exec("update tasks set status='incomplete',completed_at=null where id='historical-2'");
    assert.equal((await prediction()).source, "fallback");
    await db.exec("update tasks set status='completed' where id='historical-2'");
    assert.equal((await prediction()).source, "global");
  } finally { await db.close(); }
});
