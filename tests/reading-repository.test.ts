import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createReadingRepository } from "../lib/supabase/reading-repository.ts";
import type { BookInput } from "../types/reading.ts";
const owner="11111111-1111-4111-8111-111111111111";
const bookRow={id:"book",title:"Book",author:null,total_pages:100,current_page:20,status:"reading",started_date:"2026-09-01",completed_date:null,weekly_page_goal:50,archived_at:null,created_at:"2026-09-01",updated_at:"2026-10-03T12:00:00Z"};
const sessionRow={id:"session",book_id:"book",session_date:"2026-10-03",start_page:0,end_page:20,pages_read:20,minutes:15,time_source:"task_timer",voided_at:null,created_at:"2026-10-03",updated_at:"2026-10-03T12:00:00Z"};
function fixture(paged=false){
 const requests:{url:URL;method:string;body:Record<string,unknown>|null}[]=[];let account=owner,fail=false;
 const client=createClient("https://fixture.supabase.co","fixture-public-key",{accessToken:async()=>"fixture-token",global:{fetch:async(input,init)=>{
  const url=new URL(String(input));const method=init?.method??"GET";const body=init?.body?JSON.parse(String(init.body)) as Record<string,unknown>:null;
  requests.push({url,method,body});if(fail)return new Response(JSON.stringify({message:"Reading fixture failure"}),{status:503});
  const row=url.pathname.endsWith("/books_with_progress")?bookRow:sessionRow;
  const response=method==="PATCH"?{id:row.id}:method==="POST"?null:paged&&url.searchParams.get("offset")==="0"?Array.from({length:500},()=>row):[row];
  return new Response(JSON.stringify(response),{status:200,headers:{"Content-Type":"application/json"}});
 }}});
 Object.defineProperty(client,"auth",{value:{getUser:async()=>({data:{user:{id:account}},error:null})}});
 return {repository:createReadingRepository(client,owner),requests,fail:()=>{fail=true;},switch:()=>{account="other";}};
}
const input:BookInput={title:" Book ",author:null,totalPages:100,currentPage:20,status:"reading",startedDate:"2026-09-01",completedDate:null,weeklyPageGoal:50};
test("Reading adapter scopes paginated retained books/sessions and reconstructs refresh progress and overlap",async()=>{
 const f=fixture(true);const books=await f.repository.listBooks(),sessions=await f.repository.listSessions();assert.equal(books.length,501);assert.equal(sessions.length,501);
 assert.equal(books[0].currentPage,20);assert.equal(sessions[0].pagesRead,20);assert.equal(sessions[0].timeSource,"task_timer");
 assert.equal(f.requests.length,4);for(const r of f.requests){assert.equal(r.url.searchParams.get("user_id"),"eq."+owner);assert.equal(r.url.searchParams.get("limit"),"500");assert.equal(r.url.searchParams.has("archived_at"),false);assert.equal(r.url.searchParams.has("voided_at"),false);}
 assert.deepEqual((await f.repository.listBooks())[0],books[0]);
});
test("Reading adapter creates/edits atomically, uses stable log IDs and pins optimistic revisions",async()=>{
 const f=fixture();const [book]=await f.repository.listBooks();const [session]=await f.repository.listSessions();
 await f.repository.createBook(input);await f.repository.updateBook(book,input);await f.repository.setArchived(book,true);await f.repository.setArchived(book,false);
 await f.repository.logSession(session,"request-id");await f.repository.correctSession(session,{...session,endPage:25,minutes:null});await f.repository.removeSession(session);
 assert.equal(f.requests[2].body?.expected_user_id,owner);assert.equal((f.requests[2].body?.p_fields as Record<string,unknown>).title,"Book");
 assert.equal(f.requests[3].body?.p_updated_at,book.updatedAt);assert.equal(f.requests[6].body?.p_id,"request-id");
 for(const r of f.requests.filter(r=>r.method==="PATCH")){assert.equal(r.url.searchParams.get("updated_at"),"eq."+book.updatedAt);assert.equal(r.url.searchParams.get("user_id"),"eq."+owner);}
 assert.ok(f.requests[8].body?.voided_at);assert.equal(f.requests.some(r=>r.method==="DELETE"),false);
 await assert.rejects(f.repository.correctSession(session,{...session,bookId:"other"}),/cannot move/);
});
test("Reading adapter rejects switched accounts, bad inputs and cloud failures with actionable errors",async()=>{
 const f=fixture();const [book]=await f.repository.listBooks();const [session]=await f.repository.listSessions();f.switch();const before=f.requests.length;
 for(const operation of [()=>f.repository.listBooks(),()=>f.repository.listSessions(),()=>f.repository.createBook(input),()=>f.repository.updateBook(book,input),()=>f.repository.setArchived(book,true),()=>f.repository.logSession(session,"id"),()=>f.repository.correctSession(session,session),()=>f.repository.removeSession(session)])await assert.rejects(operation(),/session changed/);
 assert.equal(f.requests.length,before);const failed=fixture();failed.fail();await assert.rejects(failed.repository.listBooks(),/Reading fixture failure/);await assert.rejects(failed.repository.createBook(input),/Reload/);
 await assert.rejects(failed.repository.createBook({...input,currentPage:101}),/Current page/);
});
