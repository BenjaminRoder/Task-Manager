import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { historicalObservations, predictDuration } from "../lib/estimation/duration-estimation.ts";
import { taskFromRow, type TaskRow } from "../lib/supabase/repositories.ts";
import { sessionFromRow, type SessionRow } from "../lib/supabase/time-session-repository.ts";
import { estimateFromRow, type EstimateRow } from "../lib/supabase/analytics-repository.ts";
import { analyticsPeriod, buildAnalytics, calendarDate } from "../lib/analytics/analytics.ts";
const alice="11111111-1111-4111-8111-111111111111",bob="22222222-2222-4222-8222-222222222222";
async function database(){
  const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;
    create table auth.users(id uuid primary key);insert into auth.users values('${alice}'),('${bob}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  const dir=new URL("../supabase/migrations/",import.meta.url);
  for(const file of (await readdir(dir)).sort().filter(file=>file.endsWith(".sql")&&!file.startsWith("20261004"))) await db.exec(await readFile(new URL(file,dir),"utf8"));
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${alice}';
    insert into tasks(id,title,priority,scheduled_date,estimated_minutes,status,completed_at) values('legacy','Legacy','medium','2026-10-01',10,'completed','2026-10-01');
    insert into books(id,title,total_pages,status,started_date) values('book','Retained book',100,'reading','2026-10-01');
    insert into reading_sessions(book_id,session_date,start_page,end_page,minutes) values('book','2026-10-01',0,10,15);`);
  await create(db,"preserved-session");await timed(db,"preserved-session",12);
  const tables=["tasks","time_sessions","books","reading_sessions"];
  const before=await Promise.all(tables.map(table=>db.query(`select to_jsonb(t) as value from ${table} t order by id`)));
  await db.exec("reset role");await db.exec(await readFile(new URL("202610040001_analytics.sql",dir),"utf8"));
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${alice}'`);
  for(const [index,table] of tables.entries())assert.deepEqual((await db.query(`select to_jsonb(t) as value from ${table} t order by id`)).rows,before[index].rows);
  assert.equal((await db.query("select * from completion_estimates")).rows.length,0);
  assert.equal((await db.query("select * from reading_sessions")).rows.length,1);
  return db;
}
async function create(db:PGlite,id:string,manual:number|null=null){await db.query("insert into tasks(id,title,priority,scheduled_date,estimated_minutes) values($1,$1,'medium','2026-10-01',$2)",[id,manual]);}
async function timed(db:PGlite,id:string,minutes:number){
  await db.query("insert into time_sessions(task_id) values($1)",[id]);
  await db.query("update time_sessions set ended_at=clock_timestamp() where task_id=$1 and ended_at is null",[id]);
  await db.query("update time_sessions set started_at='2026-09-01T12:00:00Z',ended_at='2026-09-01T12:00:00Z'::timestamptz+($2*interval '1 minute') where task_id=$1",[id,minutes]);
}
async function complete(db:PGlite,id:string){await db.query("update tasks set status='completed',completed_at=now() where id=$1",[id]);}
async function analytics(db:PGlite){
  const tasks=(await db.query<{row:TaskRow}>("select to_jsonb(t) as row from tasks t")).rows.map(x=>taskFromRow(x.row));
  const sessions=(await db.query<{row:SessionRow}>("select to_jsonb(t) as row from time_sessions t")).rows.map(x=>sessionFromRow(x.row));
  const estimates=(await db.query<{row:EstimateRow}>("select to_jsonb(t) as row from completion_estimates t")).rows.map(x=>estimateFromRow(x.row));
  const today=calendarDate(new Date().toISOString(),"UTC");
  return buildAnalytics({tasks,sessions,estimates,categories:[],courses:[],books:[],readingSessions:[]},analyticsPeriod(today,"month"),today,"UTC");
}
test("M6 migration preserves M5 records; snapshots freeze and recompletion creates a new retained snapshot",async()=>{
  const db=await database();try{
    for(const [i,min] of [10,20,40].entries()){await create(db,"history"+i);await timed(db,"history"+i,min);await complete(db,"history"+i);}
    await create(db,"target",45);await timed(db,"target",60);await complete(db,"target");
    const first=(await db.query<{id:string;predicted_minutes:string;manual_minutes:number;effective_minutes:string;effective_source:string}>("select * from completion_estimates where task_id='target'")).rows[0];
    assert.equal(Number(first.predicted_minutes),30);assert.equal(first.manual_minutes,45);assert.equal(Number(first.effective_minutes),45);assert.equal(first.effective_source,"manual");
    assert.equal((await analytics(db)).comparisons.find(row=>row.taskId==="target")?.actualMinutes,60);
    await db.exec("update time_sessions set ended_at=started_at+interval '90 minutes' where task_id='target'");
    assert.equal((await analytics(db)).comparisons.find(row=>row.taskId==="target")?.actualMinutes,90);
    await db.exec("update time_sessions set voided_at=now() where task_id='target'");
    assert.equal((await analytics(db)).comparisons.find(row=>row.taskId==="target")?.actualMinutes,0);
    await db.exec("update tasks set estimated_minutes=999,completed_at='2000-01-01' where id='target';update time_sessions set voided_at=now() where task_id='history2'");
    assert.ok((await analytics(db)).comparisons.find(row=>row.taskId==="target")?.snapshot);
    assert.deepEqual((await db.query("select * from completion_estimates where task_id='target'")).rows[0],first);
    await db.exec("update tasks set status='incomplete',completed_at=null where id='target'");await complete(db,"target");
    assert.equal((await db.query("select * from completion_estimates where task_id='target'")).rows.length,2);
    await db.exec("update tasks set deleted_at=now() where id='target'");
    assert.equal((await db.query("select * from completion_estimates where task_id='target'")).rows.length,2);
    await db.exec("update reading_sessions set end_page=15;update reading_sessions set voided_at=now()");
    assert.equal((await db.query<{current_page:number}>("select current_page from books_with_progress")).rows[0].current_page,0);
  }finally{await db.close();}
});
test("snapshot writes and deletes are denied; owner RLS and compound references hold",async()=>{
  const db=await database();try{
    for(let i=0;i<3;i++){await create(db,"alice-history"+i);await timed(db,"alice-history"+i,30);await complete(db,"alice-history"+i);}
    await create(db,"same");await complete(db,"same");
    for(const sql of ["delete from completion_estimates","update completion_estimates set effective_minutes=1","insert into completion_estimates(user_id,task_id) values('"+alice+"','same')","select capture_completion_estimate()"] )await assert.rejects(db.exec(sql));
    await db.exec(`set request.jwt.claim.sub='${bob}'`);assert.equal((await db.query("select * from completion_estimates")).rows.length,0);
    await assert.rejects(db.exec(`insert into tasks(user_id,id,title,priority,scheduled_date,estimated_minutes) values('${alice}','spoof','Spoof','medium','2026-10-01',null)`));
    await create(db,"same");await complete(db,"same");
    const own=(await db.query<{user_id:string;predicted_minutes:null}>("select * from completion_estimates")).rows;
    assert.equal(own.length,1);assert.equal(own[0].user_id,bob);assert.equal(own[0].predicted_minutes,null);
    await db.exec("reset role");await assert.rejects(db.exec(`insert into completion_estimates(user_id,task_id,completed_at,effective_minutes,effective_source,prediction_source,sample_size) values('${bob}','legacy',now(),25,'default','fallback',0)`));
    await db.exec("set role anon");await assert.rejects(db.exec("select * from completion_estimates"));
  }finally{await db.close();}
});
test("SQL snapshots match the established estimator hierarchy and stop active timers atomically",async()=>{
  const db=await database();try{
    await db.exec("insert into categories(id,name,color) values('c','Category','#123456');insert into courses(id,name) values('course','Course');insert into task_types(id,name) values('type','Type')");
    for(let i=0;i<23;i++){await create(db,"h"+i);await timed(db,"h"+i,(i+1)*5);await db.query("update tasks set category_id='c',course_id='course',task_type_id='type' where id=$1",["h"+i]);await complete(db,"h"+i);}
    for(const [index,fields] of ["category_id='c',course_id='course',task_type_id='type'","course_id='course'","category_id='c',task_type_id='type'","task_type_id='type'","category_id='c'","category_id=null"].entries()){
      const id="probe"+index;await create(db,id);await db.exec(`update tasks set ${fields} where id='${id}'`);
      // JSON serializes PostgreSQL timestamps as strings, matching PostgREST.
      const tasks=(await db.query<{row:TaskRow}>("select to_jsonb(t) as row from tasks t")).rows.map(x=>taskFromRow(x.row));
      const sessions=(await db.query<{row:SessionRow}>("select to_jsonb(s) as row from time_sessions s")).rows.map(x=>sessionFromRow(x.row));
      const prediction=predictDuration(tasks.find(t=>t.id===id)!,historicalObservations(tasks,sessions));
      await db.query("insert into time_sessions(task_id) values($1)",[id]);await complete(db,id);
      const snap=(await db.query<{predicted_minutes:string;prediction_source:string;sample_size:number}>("select * from completion_estimates where task_id=$1",[id])).rows[0];
      assert.equal(Number(snap.predicted_minutes),prediction.minutes);assert.equal(snap.prediction_source,prediction.source);assert.equal(snap.sample_size,prediction.sampleSize);
      assert.equal((await db.query("select * from time_sessions where ended_at is null")).rows.length,0);
      await db.query("update tasks set status='incomplete',completed_at=null where id=$1",[id]);
    }
  }finally{await db.close();}
});
