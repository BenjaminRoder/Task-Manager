"use client";
import { unusedCalendarRepositories } from "@/tests/browser/calendar-fixture-repositories";
// Explicit synthetic browser fixture. Production Reading always uses Supabase.
import { useMemo } from "react";
import { ReadingBoard } from "@/components/reading/reading-board";
import { RepositoryContext } from "@/lib/supabase/repository-context";
import type { ReadingRepository } from "@/lib/reading/reading-repository";
import type { Book, BookInput, ReadingSession } from "@/types/reading";
import { validateBook, validateReadingSession } from "@/lib/reading/reading-rules";
const key="task-manager.reading.ui.fixture.v1";
type Data={books:(Book & {offset:number})[];sessions:ReadingSession[]};
function read():Data{return JSON.parse(localStorage.getItem(key)??'{"books":[],"sessions":[]}') as Data;}
function write(data:Data){localStorage.setItem(key,JSON.stringify(data));}
function updateProgress(data:Data,bookId:string){const book=data.books.find(b=>b.id===bookId)!;book.currentPage=book.offset+data.sessions.filter(s=>s.bookId===bookId&&!s.voidedAt).reduce((sum,s)=>sum+s.endPage-s.startPage,0);if(book.status==="completed"&&book.currentPage!==book.totalPages){book.status="reading";book.completedDate=null;}book.updatedAt=new Date().toISOString();}
const unavailable=async()=>{throw new Error("Outside Reading fixture scope");};
export default function ReadingFixture(){
 const reading:ReadingRepository=useMemo(()=>({
  async listBooks(){return read().books;},async listSessions(){return read().sessions;},
  async createBook(input){const data=read(),now=new Date().toISOString();data.books.push({...validateBook(input),id:crypto.randomUUID(),offset:input.currentPage,archivedAt:null,createdAt:now,updatedAt:now});write(data);},
  async updateBook(book,input:BookInput){const data=read();const stored=data.books.find(b=>b.id===book.id)!;const pages=data.sessions.filter(s=>s.bookId===book.id&&!s.voidedAt).reduce((sum,s)=>sum+s.endPage-s.startPage,0);Object.assign(stored,validateBook(input),{offset:input.currentPage-pages,updatedAt:new Date().toISOString()});write(data);},
  async setArchived(book,archived){const data=read();data.books.find(b=>b.id===book.id)!.archivedAt=archived?new Date().toISOString():null;write(data);},
  async logSession(input,id){const data=read();if(data.sessions.some(s=>s.id===id))return;const now=new Date().toISOString();data.sessions.push({...validateReadingSession(input),id,pagesRead:input.endPage-input.startPage,voidedAt:null,createdAt:now,updatedAt:now});updateProgress(data,input.bookId);write(data);},
  async correctSession(session,input){const data=read();Object.assign(data.sessions.find(s=>s.id===session.id)!,validateReadingSession(input),{pagesRead:input.endPage-input.startPage});updateProgress(data,session.bookId);write(data);},
  async removeSession(session){const data=read();data.sessions.find(s=>s.id===session.id)!.voidedAt=new Date().toISOString();updateProgress(data,session.bookId);write(data);},
 }),[]);
 const repositories=useMemo(()=>({analytics:{listEstimates:async()=>[]},reading,tasks:{list:async()=>[],create:unavailable,update:unavailable,setStatus:unavailable,remove:unavailable},categories:{list:async()=>[],create:unavailable,update:unavailable,setArchived:unavailable},courses:{list:async()=>[],create:unavailable,update:unavailable,setArchived:unavailable},taskTypes:{list:async()=>[],create:unavailable,update:unavailable,setArchived:unavailable},topics:{list:async()=>[],create:unavailable,update:unavailable,setArchived:unavailable}}),[reading]);
 return <RepositoryContext.Provider value={{ ...repositories, ...unusedCalendarRepositories }}><p>Local Reading UI fixture — no hosted verification.</p><ReadingBoard/></RepositoryContext.Provider>;
}
