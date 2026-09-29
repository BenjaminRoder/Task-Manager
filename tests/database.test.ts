import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const dataset = {
  version: 2,
  categories: [
    {
      id: "legacy-cat",
      name: "Study",
      color: "#123456",
      archivedAt: "2026-01-02T00:00:00Z",
    },
  ],
  tasks: [
    {
      id: "legacy-task",
      title: "Historical task",
      categoryId: "legacy-cat",
      priority: "high",
      dueDate: "2026-01-01",
      scheduledDate: "2025-12-31",
      estimatedMinutes: 30,
      status: "completed",
      createdAt: "2025-12-01T00:00:00Z",
      completedAt: "2026-01-01T00:00:00Z",
      deletedAt: "2026-01-03T00:00:00Z",
    },
  ],
};

test("actual PostgreSQL migration: ownership, lifecycle, constraints, atomic import and retries", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      insert into auth.users values ('${alice}'), ('${bob}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;`);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202609290001_milestone2.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub = '${alice}';`,
    );
    await db.query("select public.import_local_data($1,$2::jsonb,auth.uid())", [
      "a".repeat(64),
      JSON.stringify(dataset),
    ]);
    const imported = (
      await db.query<{
        id: string;
        category_id: string;
        status: string;
        deleted_at: Date;
      }>("select * from tasks")
    ).rows[0];
    assert.equal(imported.id, "legacy-task");
    assert.equal(imported.category_id, "legacy-cat");
    assert.equal(imported.status, "completed");
    assert.ok(imported.deleted_at);
    assert.ok(
      (await db.query("select * from categories where archived_at is not null"))
        .rows.length,
    );
    await db.query("select public.import_local_data($1,$2::jsonb,auth.uid())", [
      "a".repeat(64),
      JSON.stringify(dataset),
    ]);
    assert.equal((await db.query("select * from tasks")).rows.length, 1);
    assert.equal(
      (await db.query("select * from local_imports")).rows.length,
      1,
    );

    const broken = structuredClone(dataset);
    broken.categories[0].id = "other-cat";
    broken.categories[0].name = "Other";
    broken.tasks[0].id = "bad-task";
    broken.tasks[0].categoryId = "missing";
    await assert.rejects(
      db.query("select public.import_local_data($1,$2::jsonb,auth.uid())", [
        "b".repeat(64),
        JSON.stringify(broken),
      ]),
    );
    assert.equal(
      (await db.query("select * from categories where id='other-cat'")).rows
        .length,
      0,
    );
    assert.equal(
      (await db.query("select * from local_imports")).rows.length,
      1,
    );
    await assert.rejects(
      db.query("select public.import_local_data($1,$2::jsonb,auth.uid())", [
        "c".repeat(64),
        JSON.stringify(dataset),
      ]),
    );
    assert.equal(
      (await db.query("select * from local_imports")).rows.length,
      1,
    );

    await assert.rejects(
      db.exec(
        "insert into tasks(id,title,category_id,priority,scheduled_date,estimated_minutes) values('new','New','legacy-cat','low','2026-01-01',10)",
      ),
    );
    await db.exec(
      "update tasks set title='Edited history' where id='legacy-task'; update categories set archived_at=null, name='Renamed',color='#abcdef' where id='legacy-cat';",
    );
    await db.exec(
      "insert into tasks(id,title,category_id,priority,scheduled_date,estimated_minutes) values('new','New','legacy-cat','low','2026-01-01',10)",
    );
    await db.exec(
      "update tasks set status='completed', completed_at=now() where id='new'; update tasks set status='incomplete',completed_at=null where id='new'; update tasks set deleted_at=now() where id='new';",
    );
    assert.equal(
      (await db.query("select * from tasks where deleted_at is null")).rows
        .length,
      0,
    );
    assert.equal((await db.query("select * from tasks")).rows.length, 2);
    await assert.rejects(db.exec("delete from tasks"));
    await assert.rejects(db.exec("delete from categories"));
    await assert.rejects(db.exec("update tasks set estimated_minutes=0"));
    await assert.rejects(
      db.exec("update tasks set status='completed',completed_at=null"),
    );
    await assert.rejects(
      db.exec("insert into categories(name,color) values('renamed','#111111')"),
    );
    await assert.rejects(db.exec("update categories set color='red'"));
    await assert.rejects(db.exec(`update tasks set user_id='${bob}'`));
    await assert.rejects(
      db.exec(
        `insert into categories(user_id,name,color) values('${bob}','Spoof','#111111')`,
      ),
    );

    await db.exec(`set request.jwt.claim.sub = '${bob}';`);
    assert.equal((await db.query("select * from tasks")).rows.length, 0);
    assert.equal((await db.query("select * from categories")).rows.length, 0);
    assert.equal(
      (await db.query("select * from local_imports")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("update tasks set title='Stolen' returning id")).rows
        .length,
      0,
    );
    await assert.rejects(
      db.exec(
        "insert into tasks(title,category_id,priority,scheduled_date,estimated_minutes) values('Cross owner','legacy-cat','low','2026-01-01',10)",
      ),
    );
    // Same IDs can be safely preserved in another account, independently.
    await db.query("select public.import_local_data($1,$2::jsonb,auth.uid())", [
      "a".repeat(64),
      JSON.stringify(dataset),
    ]);
    assert.equal((await db.query("select * from tasks")).rows.length, 1);
    await db.exec("reset role; set role anon; set request.jwt.claim.sub = '';");
    await assert.rejects(db.exec("select * from tasks"));
    await assert.rejects(
      db.query("select public.import_local_data($1,$2::jsonb,auth.uid())", [
        "d".repeat(64),
        JSON.stringify(dataset),
      ]),
    );
  } finally {
    await db.close();
  }
});
