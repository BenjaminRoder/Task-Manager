import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { taskFromRow, type TaskRow } from "../lib/supabase/repositories.ts";
import { sessionFromRow, type SessionRow } from "../lib/supabase/time-session-repository.ts";
import { effectiveEstimate, predictTasks } from "../lib/estimation/duration-estimation.ts";

test("persisted completed ledger drives estimates after correction, void, deletion and reopening", async () => {
  const db = new PGlite();
  const owner = "11111111-1111-4111-8111-111111111111";
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key); insert into auth.users values('${owner}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
    for (const file of ["202609290001_milestone2.sql", "202609300001_time_sessions.sql", "202610030001_optional_manual_estimate.sql"]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    }
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${owner}';
      insert into categories(id,name,color) values('cat','Study','#123456');`);
    const ids: string[] = [];
    for (let index = 1; index <= 3; index++) {
      await db.query(`insert into tasks(id,title,category_id,priority,scheduled_date,estimated_minutes)
        values($1,$1,'cat','medium','2026-10-03',null)`, [String(index)]);
      const id = crypto.randomUUID();
      ids.push(id);
      await db.query("select start_task_timer($1,$2,null,$3)", [String(index), id, owner]);
      await db.query("select stop_task_timer($1,$2)", [id, owner]);
      await db.query("update time_sessions set started_at=$1,ended_at=$2 where id=$3", [
        "2026-01-01T00:00:00Z", `2026-01-01T00:${index * 10}:00Z`, id]);
      await db.query("update tasks set status='completed' where id=$1", [String(index)]);
    }
    // Set distinct persisted completion dates so weighting is reproducible.
    await db.exec(`update tasks set completed_at=('2026-01-0' || id || 'T12:00:00Z')::timestamptz;
      insert into tasks(id,title,category_id,priority,scheduled_date,estimated_minutes)
      values('target','Next task','cat','medium','2026-10-03',null);`);
    async function readPrediction() {
      const tasks = (await db.query<TaskRow>("select * from tasks order by id")).rows.map(taskFromRow);
      const sessions = (await db.query<SessionRow>("select * from time_sessions order by id")).rows.map(sessionFromRow);
      const target = tasks.find((row) => row.id === "target")!;
      const prediction = predictTasks(tasks, sessions).get(target.id)!;
      return { target, prediction };
    }
    assert.equal((await readPrediction()).prediction.minutes, 25);
    await db.query("update time_sessions set ended_at='2026-01-01T01:00:00Z' where id=$1", [ids[2]]);
    assert.equal((await readPrediction()).prediction.minutes, 40);
    await db.exec("update tasks set deleted_at=now() where id='1'");
    assert.equal((await readPrediction()).prediction.minutes, 40);
    await db.exec("update tasks set estimated_minutes=7 where id='target'");
    const manual = await readPrediction();
    assert.equal(effectiveEstimate(manual.target, manual.prediction), 7);
    assert.equal(manual.prediction.minutes, 40);
    await db.exec("update tasks set status='incomplete',completed_at=null where id='2'");
    assert.equal((await readPrediction()).prediction.minutes, null);
    await db.exec("update tasks set status='completed' where id='2'");
    assert.equal((await readPrediction()).prediction.sampleSize, 3);
    await db.query("update time_sessions set voided_at=now() where id=$1", [ids[2]]);
    assert.equal((await readPrediction()).prediction.minutes, null);
    assert.equal((await readPrediction()).target.estimatedMinutes, 7);
  } finally {
    await db.close();
  }
});
