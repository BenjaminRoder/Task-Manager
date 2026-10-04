import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const alice="11111111-1111-4111-8111-111111111111",bob="22222222-2222-4222-8222-222222222222";
const fields={title:"Book",author:null,total_pages:100,current_page:10,status:"reading",started_date:"2026-09-01",completed_date:null,weekly_page_goal:50};
async function database(){
  const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;
    create table auth.users(id uuid primary key);insert into auth.users values('${alice}'),('${bob}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  for(const migration of ["202609290001_milestone2.sql","202609300001_time_sessions.sql","202610030001_optional_manual_estimate.sql","202610030002_task_classification.sql","202610030003_task_topics.sql","202610030004_reading.sql"])await db.exec(await readFile(new URL("../supabase/migrations/"+migration,import.meta.url),"utf8"));
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${alice}'`);return db;
}
async function create(db:PGlite){await db.query("select save_reading_book(null,$1::jsonb,null,$2::uuid)",[JSON.stringify(fields),alice]);return (await db.query<{id:string;updated_at:Date;current_page:number}>("select * from books_with_progress")).rows[0];}
async function log(db:PGlite,id:string,start=10,end=30,requestId=crypto.randomUUID()){
  await db.query("select log_reading_session($1::uuid,$2::jsonb,$3::uuid)",[requestId,JSON.stringify({book_id:id,session_date:"2026-10-03",start_page:start,end_page:end,minutes:15,time_source:"reading"}),alice]);return requestId;
}
async function progress(db:PGlite){return (await db.query<{current_page:number}>("select current_page from books_with_progress")).rows[0].current_page;}

test("reading migrations support book lifecycle, derived progress, durable history, correction and removal",async()=>{
 const db=await database();try{
  const book=await create(db);assert.equal(book.current_page,10);
  const id=await log(db,book.id);assert.equal(await progress(db),30);
  assert.equal((await db.query<{pages_read:number}>("select pages_read from reading_sessions")).rows[0].pages_read,20);
  await db.query("update reading_sessions set end_page=35 where id=$1",[id]);assert.equal(await progress(db),35);
  const updated=(await db.query<{updated_at:Date}>("select updated_at from books")).rows[0].updated_at;
  await db.query("select save_reading_book($1,$2::jsonb,$3::timestamptz,$4::uuid)",[book.id,JSON.stringify({...fields,current_page:50,title:"Renamed",author:"Author",weekly_page_goal:null}),updated.toISOString(),alice]);
  assert.equal((await db.query<{end_page:number}>("select end_page from reading_sessions")).rows[0].end_page,35);assert.equal(await progress(db),50);
  await db.exec("update reading_sessions set end_page=40");assert.equal(await progress(db),55);
  await db.exec("update books set status='paused';update books set archived_at=now()");await assert.rejects(log(db,book.id,55,60));
  await db.exec("update books set archived_at=null,status='reading';update books set progress_offset=70,status='completed',completed_date='2026-10-03'");assert.equal(await progress(db),100);
  await db.exec("update reading_sessions set end_page=35");
  assert.equal((await db.query<{status:string}>("select status from books")).rows[0].status,"reading");
  assert.equal((await db.query<{completed_date:string|null}>("select completed_date from books")).rows[0].completed_date,null);
  await db.exec("update books set archived_at=now();update reading_sessions set voided_at=now()");assert.equal(await progress(db),70);
  assert.equal((await db.query("select * from reading_sessions")).rows.length,1);
  await db.exec("update books set progress_offset=0,total_pages=20");assert.equal(await progress(db),0);
  await assert.rejects(db.exec("delete from books"));await assert.rejects(db.exec("delete from reading_sessions"));await assert.rejects(db.exec("update reading_sessions set end_page=33"));
 }finally{await db.close();}
});

test("reading RLS and invoker progress view prevent cross-user access, spoofing and anonymous reads",async()=>{
 const db=await database();try{
  const book=await create(db);await log(db,book.id);await db.exec(`set request.jwt.claim.sub='${bob}'`);
  for(const table of ["books","books_with_progress","reading_sessions"])assert.equal((await db.query("select * from "+table)).rows.length,0);
  await assert.rejects(db.exec(`insert into books(user_id,title,total_pages)values('${alice}','Spoof',100)`));
  await assert.rejects(db.query("insert into reading_sessions(user_id,book_id,session_date,start_page,end_page)values($1,$2,'2026-10-03',30,35)",[alice,book.id]));
  await assert.rejects(db.query("insert into reading_sessions(book_id,session_date,start_page,end_page)values($1,'2026-10-03',10,30)",[book.id]));
  await assert.rejects(db.query("select save_reading_book(null,$1::jsonb,null,$2::uuid)",[JSON.stringify(fields),alice]));
  await db.exec("update books set title='Stolen';update reading_sessions set minutes=100");await db.exec(`set request.jwt.claim.sub='${alice}'`);
  assert.equal((await db.query<{title:string}>("select title from books")).rows[0].title,"Book");
  assert.equal((await db.query<{minutes:number}>("select minutes from reading_sessions")).rows[0].minutes,15);
  await db.exec("reset role;set role anon");for(const table of ["books","books_with_progress","reading_sessions"])await assert.rejects(db.exec("select * from "+table));
  await assert.rejects(db.query("select save_reading_book(null,$1::jsonb,null,$2::uuid)",[JSON.stringify(fields),alice]));
 }finally{await db.close();}
});

test("reading validation, retry IDs, stale revisions, concurrent progress and immutable ledger identity",async()=>{
 const db=await database();try{
  const book=await create(db);const id=await log(db,book.id);
  await log(db,book.id,10,30,id);assert.equal((await db.query("select * from reading_sessions")).rows.length,1);
  await assert.rejects(log(db,book.id,10,35,id),/different details/);await assert.rejects(log(db,book.id,10,35),/progress changed/);
  await assert.rejects(log(db,book.id,30,101),/total pages/);await assert.rejects(log(db,book.id,30,30));
  await assert.rejects(db.query("select save_reading_book($1,$2::jsonb,$3::timestamptz,$4::uuid)",[book.id,JSON.stringify(fields),book.updated_at.toISOString(),alice]),/Book changed/);
  for(const sql of ["update books set progress_offset=-100","update books set total_pages=20","update books set status='completed',completed_date='2026-10-03'","update books set id='changed'","update reading_sessions set book_id='other'","update reading_sessions set end_page=200","update reading_sessions set start_page=-1","update reading_sessions set minutes=0","update reading_sessions set time_source='other'"])await assert.rejects(db.exec(sql));
  const before=(await db.query<{updated_at:Date}>("select updated_at from reading_sessions")).rows[0].updated_at.toISOString();
  assert.equal((await db.query("update reading_sessions set minutes=30,time_source='task_timer' where id=$1 and updated_at=$2 returning id",[id,before])).rows.length,1);
  assert.equal((await db.query("update reading_sessions set minutes=90 where id=$1 and updated_at=$2 returning id",[id,before])).rows.length,0);
  await db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${alice}'`);assert.equal(await progress(db),30);
  assert.equal((await db.query<{time_source:string}>("select time_source from reading_sessions")).rows[0].time_source,"task_timer");
 }finally{await db.close();}
});
