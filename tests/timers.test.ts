import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  elapsedSeconds,
  totalSeconds,
  timerClock,
  formatActual,
  validateCorrection,
} from "../lib/timers/timer-rules.ts";
import type { TimeSession } from "../types/time-session.ts";
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222";
const session: TimeSession = {
  id: "s",
  userId: alice,
  taskId: "task",
  startedAt: "2026-01-01T23:59:00Z",
  endedAt: "2026-01-02T00:01:00Z",
  durationSeconds: 120,
  voidedAt: null,
  createdAt: "2026-01-01T23:59:00Z",
  updatedAt: "2026-01-02T00:01:00Z",
};
test("elapsed time uses timestamps, includes active periods and freezes ended/removed sessions", () => {
  const now = Date.parse("2026-01-02T00:05:00Z");
  assert.equal(elapsedSeconds(session, now), 120);
  const active = {
    ...session,
    id: "active",
    startedAt: "2026-01-02T00:02:00Z",
    endedAt: null,
    durationSeconds: null,
  };
  assert.equal(elapsedSeconds(active, now), 180);
  assert.equal(totalSeconds([session, active], "task", now), 300);
  assert.equal(
    totalSeconds(
      [{ ...session, voidedAt: session.updatedAt }, active],
      "task",
      now,
    ),
    180,
  );
  assert.equal(elapsedSeconds(active, 0), 0);
  assert.equal(
    totalSeconds(
      [{ ...session, endedAt: "2026-01-02T00:02:00Z", durationSeconds: 180 }],
      "task",
      now,
    ),
    180,
  );
  assert.equal(timerClock(7384.999), "02:03:04");
  assert.equal(formatActual(45), "45 sec");
  assert.equal(formatActual(7384), "2h 03m");
});
test("corrections reject invalid and future ranges and normalize timezone boundaries", () => {
  assert.throws(
    () =>
      validateCorrection({
        startedAt: session.startedAt,
        endedAt: session.startedAt,
      }),
    /after/,
  );
  assert.throws(
    () => validateCorrection({ startedAt: "bad", endedAt: session.endedAt! }),
    /after/,
  );
  assert.throws(
    () =>
      validateCorrection({ startedAt: "2099-01-01", endedAt: "2099-01-02" }),
    /future/,
  );
  const times = validateCorrection({
    startedAt: "2025-11-02T01:30:00-04:00",
    endedAt: "2025-11-02T01:30:00-05:00",
  });
  assert.equal(
    Date.parse(times.endedAt) - Date.parse(times.startedAt),
    3600000,
  );
});
test("PostgreSQL timers: lifecycle, retries, switch consent, corrections, completion, deletion and RLS", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key); insert into auth.users values('${alice}'),('${bob}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
    for (const file of [
      "202609290001_milestone2.sql",
      "202609300001_time_sessions.sql",
      "202610030001_optional_manual_estimate.sql",
      "202610030002_task_classification.sql",
      "202610030003_task_topics.sql",
    ])
      await db.exec(
        await readFile(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${alice}';
      insert into categories(id,name,color) values('cat','Work','#123456');
      insert into tasks(id,title,category_id,priority,scheduled_date,estimated_minutes) values('a','Task A','cat','high','2026-09-30',30),('b','Task B','cat','low','2026-09-30',15);`);
    await db.exec("update tasks set estimated_minutes = null where id = 'a'");
    assert.equal((await db.query<{ estimated_minutes: number | null }>("select estimated_minutes from tasks where id = 'a'")).rows[0].estimated_minutes, null);
    assert.equal((await db.query<{ estimated_minutes: number }>("select estimated_minutes from tasks where id = 'b'")).rows[0].estimated_minutes, 15);
    await assert.rejects(db.exec("update tasks set estimated_minutes = 0 where id = 'a'"));
    await assert.rejects(db.exec("update tasks set estimated_minutes = 1441 where id = 'a'"));
    const start = async (
      task: string,
      id = crypto.randomUUID(),
      expected: string | null = null,
      user = alice,
    ) => {
      await db.query("select start_task_timer($1,$2,$3,$4)", [
        task,
        id,
        expected,
        user,
      ]);
      return id;
    };
    const rows = async () =>
      (
        await db.query<{
          id: string;
          task_id: string;
          ended_at: string | null;
          duration_seconds: string | null;
          started_at: string;
          voided_at: string | null;
        }>("select * from time_sessions order by started_at")
      ).rows;
    const first = await start("a");
    assert.equal((await rows())[0].ended_at, null);
    assert.equal((await rows()).length, 1); // Reload reconstructs the same persisted session.
    await start("a", first);
    await start("a");
    assert.equal((await rows()).length, 1);
    await assert.rejects(start("b"), /active timer changed/);
    await assert.rejects(
      db.exec("insert into time_sessions(task_id) values('b')"),
      /unique/,
    );
    await db.exec(
      "update tasks set title='Renamed',estimated_minutes=40 where id='a'",
    );
    assert.equal((await rows())[0].ended_at, null);
    const second = await start("b", crypto.randomUUID(), first);
    let saved = await rows();
    assert.ok(saved[0].ended_at);
    assert.equal(saved[1].ended_at, null);
    await assert.rejects(
      start("a", crypto.randomUUID(), first),
      /active timer changed/,
    );
    await db.query("select stop_task_timer($1,$2)", [first, alice]);
    assert.equal((await rows())[1].ended_at, null);
    await db.query("select stop_task_timer($1,$2)", [second, alice]);
    const stopped = (await rows())[1].ended_at;
    await db.query("select stop_task_timer($1,$2)", [second, alice]);
    assert.deepEqual((await rows())[1].ended_at, stopped);
    await db.query(
      "update time_sessions set started_at='2026-01-01T23:59:00Z',ended_at='2026-01-02T00:02:00Z' where id=$1",
      [first],
    );
    const corrected = (await rows()).find((s) => s.id === first)!;
    assert.equal(Number(corrected.duration_seconds), 180);
    await assert.rejects(
      db.query("update time_sessions set ended_at=started_at where id=$1", [
        first,
      ]),
      /check constraint/,
    );
    await assert.rejects(
      db.query("update time_sessions set ended_at=null where id=$1", [first]),
      /new session/,
    );
    await assert.rejects(
      db.query("update time_sessions set ended_at=clock_timestamp()+interval '1 day' where id=$1", [first]),
      /future/,
    );
    await assert.rejects(
      db.query("update time_sessions set started_at='-infinity' where id=$1", [first]),
      /check constraint/,
    );
    assert.equal(Number((await rows()).find((s) => s.id === first)!.duration_seconds), 180);
    await db.query("update time_sessions set voided_at=now() where id=$1", [
      first,
    ]);
    assert.ok((await rows()).find((s) => s.id === first)!.voided_at);
    await assert.rejects(
      db.query("update time_sessions set task_id='b' where id=$1", [first]),
    );
    const third = await start("a");
    await db.exec(
      "update tasks set status='completed',completed_at=now() where id='a'",
    );
    saved = await rows();
    const ended = saved.find((s) => s.id === third)!;
    assert.ok(ended.ended_at);
    const task = (
      await db.query<{ completed_at: string }>(
        "select completed_at from tasks where id='a'",
      )
    ).rows[0];
    assert.deepEqual(task.completed_at, ended.ended_at);
    await assert.rejects(start("a"), /unavailable or completed/);
    await db.exec(
      "update tasks set status='incomplete',completed_at=null where id='a'",
    );
    assert.equal((await rows()).filter((s) => !s.ended_at).length, 0);
    const fourth = await start("a");
    await db.exec("update tasks set deleted_at=now() where id='a'");
    assert.ok((await rows()).find((s) => s.id === fourth)!.ended_at);
    await assert.rejects(start("a"), /unavailable or completed/);
    await assert.rejects(
      db.exec("delete from time_sessions"),
      /permission denied/,
    );
    await start("a", fourth); // Lost-response retry does not restart an ended session.
    assert.equal((await rows()).length, 4);
    await db.exec(`set request.jwt.claim.sub='${bob}';`);
    assert.equal((await rows()).length, 0);
    await assert.rejects(
      start("b", crypto.randomUUID(), null, bob),
      /unavailable or completed/,
    );
    await assert.rejects(
      db.exec("insert into time_sessions(task_id) values('b')"),
    );
    await assert.rejects(
      db.exec(
        `insert into time_sessions(user_id,task_id) values('${alice}','b')`,
      ),
    );
    await assert.rejects(
      start("b", crypto.randomUUID(), null, alice),
      /session changed/,
    );
    assert.equal(
      (await db.query("update time_sessions set ended_at=now() returning id"))
        .rows.length,
      0,
    );
    await db.exec("reset role; set role anon; set request.jwt.claim.sub='';");
    await assert.rejects(
      db.exec("select * from time_sessions"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select stop_task_timer($1,$2)", [second, alice]),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
