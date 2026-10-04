import type { SupabaseClient } from "@supabase/supabase-js";
import type { Book, BookInput, ReadingSession, ReadingSessionInput } from "../../types/reading.ts";
import type { ReadingRepository } from "../reading/reading-repository.ts";
import { validateBook, validateReadingSession } from "../reading/reading-rules.ts";
export interface BookRow {
  id:string; title:string; author:string|null; total_pages:number; current_page:number;
  status:Book["status"]; started_date:string|null; completed_date:string|null; weekly_page_goal:number|null;
  archived_at:string|null; created_at:string; updated_at:string;
}
export interface ReadingSessionRow {
  id:string; book_id:string; session_date:string; start_page:number; end_page:number; pages_read:number;
  minutes:number|null; time_source:ReadingSession["timeSource"]; voided_at:string|null; created_at:string; updated_at:string;
}
export function bookFromRow(row:BookRow):Book {
  return {id:row.id,title:row.title,author:row.author,totalPages:row.total_pages,currentPage:row.current_page,
    status:row.status,startedDate:row.started_date,completedDate:row.completed_date,weeklyPageGoal:row.weekly_page_goal,
    archivedAt:row.archived_at,createdAt:row.created_at,updatedAt:row.updated_at};
}
export function readingSessionFromRow(row:ReadingSessionRow):ReadingSession {
  return {id:row.id,bookId:row.book_id,date:row.session_date,startPage:row.start_page,endPage:row.end_page,
    pagesRead:row.pages_read,minutes:row.minutes,timeSource:row.time_source,voidedAt:row.voided_at,createdAt:row.created_at,updatedAt:row.updated_at};
}
export function bookFields(input:BookInput) {
  const v=validateBook(input);return {title:v.title,author:v.author,total_pages:v.totalPages,current_page:v.currentPage,
    status:v.status,started_date:v.startedDate,completed_date:v.completedDate,weekly_page_goal:v.weeklyPageGoal};
}
export function readingSessionFields(input:ReadingSessionInput) {
  const v=validateReadingSession(input);return {book_id:v.bookId,session_date:v.date,start_page:v.startPage,end_page:v.endPage,minutes:v.minutes,time_source:v.timeSource};
}
function check(error:{message:string}|null) { if(error) throw new Error("Reading data could not be saved or loaded: "+error.message+". Reload and check your connection before retrying."); }
export function createReadingRepository(client:SupabaseClient,userId:string):ReadingRepository {
  async function authorize() {
    const {data,error}=await client.auth.getUser();
    if(error || data.user?.id!==userId) throw new Error("Your session changed or expired. Sign in again.");
  }
  async function list<T>(table:"books_with_progress"|"reading_sessions"):Promise<T[]> {
    await authorize();const rows:T[]=[];
    for(let start=0;;start+=500) {
      const {data,error}=await client.from(table).select("*").eq("user_id",userId).order("id").range(start,start+499).returns<T[]>();
      check(error);rows.push(...(data??[]));if(!data || data.length<500) return rows;
    }
  }
  async function save(book:Book|null,input:BookInput) {
    const fields=bookFields(input);await authorize();
    const {error}=await client.rpc("save_reading_book",{p_id:book?.id??null,p_fields:fields,p_updated_at:book?.updatedAt??null,expected_user_id:userId});check(error);
  }
  async function changeSession(session:ReadingSession,fields:Record<string,unknown>) {
    await authorize();const {error}=await client.from("reading_sessions").update(fields).eq("user_id",userId)
      .eq("id",session.id).eq("updated_at",session.updatedAt).is("voided_at",null).select("id").single();check(error);
  }
  return {
    async listBooks(){return (await list<BookRow>("books_with_progress")).map(bookFromRow);},
    async listSessions(){return (await list<ReadingSessionRow>("reading_sessions")).map(readingSessionFromRow);},
    async createBook(input){await save(null,input);},
    async updateBook(book,input){await save(book,input);},
    async setArchived(book,archived){
      await authorize();const {error}=await client.from("books").update({archived_at:archived?new Date().toISOString():null})
        .eq("user_id",userId).eq("id",book.id).eq("updated_at",book.updatedAt).select("id").single();check(error);
    },
    async logSession(input,requestId){const fields=readingSessionFields(input);await authorize();
      const {error}=await client.rpc("log_reading_session",{p_id:requestId,p_fields:fields,expected_user_id:userId});check(error);},
    async correctSession(session,input){
      if(input.bookId!==session.bookId) throw new Error("A reading session cannot move to another book.");
      const {book_id,...fields}=readingSessionFields(input);void book_id;await changeSession(session,fields);
    },
    async removeSession(session){await changeSession(session,{voided_at:new Date().toISOString()});},
  };
}
