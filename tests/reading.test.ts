import test from "node:test";
import assert from "node:assert/strict";
import { validateBook, validateReadingSession, readingMetrics, completedBooksThisYear, readingTimeTotals } from "../lib/reading/reading-rules.ts";
import type { Book, ReadingSession } from "../types/reading.ts";
const book:Book={id:"book",title:" Book ",author:null,totalPages:300,currentPage:100,status:"reading",startedDate:"2026-09-01",completedDate:null,weeklyPageGoal:100,archivedAt:null,createdAt:"2026-01-01",updatedAt:"2026-01-01"};
function session(date:string,pages=20,patch:Partial<ReadingSession>={}):ReadingSession{return {id:date,bookId:"book",date,startPage:0,endPage:pages,pagesRead:pages,minutes:null,timeSource:"reading",voidedAt:null,createdAt:date,updatedAt:date,...patch};}

test("book creation/edit validation trims optional author and checks pages, goals, statuses and dates",()=>{
  assert.equal(validateBook(book).title,"Book");assert.equal(validateBook({...book,author:"  "}).author,null);
  for(const patch of [{title:" "},{totalPages:0},{currentPage:301},{currentPage:-1},{totalPages:1.5},{weeklyPageGoal:0},{startedDate:null},{completedDate:"2026-10-03"},{startedDate:"2026-02-30"}]) assert.throws(()=>validateBook({...book,...patch}));
  assert.doesNotThrow(()=>validateBook({...book,status:"want_to_read",startedDate:null}));
  assert.doesNotThrow(()=>validateBook({...book,status:"paused"}));
  assert.doesNotThrow(()=>validateBook({...book,status:"completed",currentPage:300,completedDate:"2026-10-03"}));
  assert.throws(()=>validateBook({...book,status:"completed",currentPage:299,completedDate:"2026-10-03"}));
  assert.throws(()=>validateBook({...book,status:"completed",currentPage:300,completedDate:"2026-08-31"}));
});

test("session input derives pages from range and validates dates, optional minutes and overlap source",()=>{
  assert.doesNotThrow(()=>validateReadingSession(session("2026-10-03")));
  for(const patch of [{startPage:-1},{endPage:0},{endPage:1.5},{minutes:0},{minutes:Infinity},{date:"2026-02-30"},{bookId:""},{timeSource:"other"}]) assert.throws(()=>validateReadingSession({...session("2026-10-03"),...patch} as ReadingSession));
});

test("reading progress and Monday-Sunday quotas derive from ranges, excluding removed/foreign/future sessions",()=>{
  const sessions=[session("2026-09-27",99),session("2026-09-28",30),session("2026-10-03",20),session("2026-10-03",10),session("2026-10-04",99),session("2026-10-03",999,{voidedAt:"removed"}),session("2026-10-03",999,{bookId:"other"})];
  const result=readingMetrics(book,sessions,"2026-10-03");
  assert.equal(result.pagesToday,30);assert.equal(result.pagesThisWeek,60);assert.equal(result.goalRemaining,40);assert.equal(result.goalPercent,60);
  assert.equal(result.remainingPages,200);assert.equal(result.percentComplete,100/3);
  assert.equal(readingMetrics({...book,weeklyPageGoal:null},sessions,"2026-10-03").goalPercent,null);
  assert.equal(readingMetrics({...book,weeklyPageGoal:10},sessions,"2026-10-03").goalRemaining,0);
  assert.equal(readingMetrics({...book,weeklyPageGoal:10},sessions,"2026-10-03").goalPercent,600);
});

test("week date boundaries include Sunday, leap day and year rollover without UTC/DST elapsed-day assumptions",()=>{
  assert.equal(readingMetrics(book,[session("2026-09-28"),session("2026-10-04")],"2026-10-04").pagesThisWeek,40);
  assert.equal(readingMetrics(book,[session("2026-10-04"),session("2026-10-05")],"2026-10-05").pagesThisWeek,20);
  assert.equal(readingMetrics(book,[session("2023-12-31"),session("2024-01-01")],"2024-01-01").pagesThisWeek,20);
  assert.equal(readingMetrics(book,[session("2024-02-29")],"2024-03-03").pagesThisWeek,20);
  assert.equal(readingMetrics(book,[session("2026-03-08"),session("2026-03-09")],"2026-03-09").pagesToday,20);
});

test("recent calendar-day pace includes nonreading days, groups repeated dates and projects conservatively",()=>{
  const rows=[session("2026-09-27",20),session("2026-09-30",20),session("2026-10-03",20),session("2026-10-03",10),session("2026-08-01",1000)];
  const result=readingMetrics(book,rows,"2026-10-03");
  assert.equal(result.averagePagesPerDay,10);assert.equal(result.readingDays,3);assert.equal(result.projectedFinish,"2026-10-23");
  assert.deepEqual(result,readingMetrics(book,[...rows].reverse(),"2026-10-03"));
  assert.equal(readingMetrics({...book,archivedAt:"archived"},rows,"2026-10-03").projectedFinish,null);
  assert.equal(readingMetrics({...book,currentPage:300,status:"completed",completedDate:"2026-10-03"},rows,"2026-10-03").projectedFinish,null);
});

test("insufficient reading history never presents a finish forecast",()=>{
  for(const rows of [[],[session("2026-10-03")],[session("2026-09-27"),session("2026-10-03")],[session("2026-10-01"),session("2026-10-02"),session("2026-10-03")]]) assert.equal(readingMetrics(book,rows,"2026-10-03").projectedFinish,null);
  assert.equal(readingMetrics(book,[],"2026-10-03").averagePagesPerDay,null);
});

test("session corrections affect quotas and pace; current-page edits never change ledger metrics",()=>{
  const rows=[session("2026-09-27"),session("2026-09-30"),session("2026-10-03")];
  assert.equal(readingMetrics(book,rows,"2026-10-03").pagesThisWeek,40);
  assert.equal(readingMetrics(book,rows.map(s=>s.date==="2026-10-03"?{...s,endPage:30}:s),"2026-10-03").pagesThisWeek,50);
  assert.equal(readingMetrics({...book,currentPage:250},rows,"2026-10-03").pagesThisWeek,40);
});

test("completed books/year includes archived retained books and excludes other years, future and reopened books",()=>{
  const complete={...book,status:"completed" as const,currentPage:300,completedDate:"2026-10-03"};
  assert.equal(completedBooksThisYear([complete,{...complete,id:"archived",archivedAt:"archived"},{...complete,completedDate:"2025-10-03"},{...complete,completedDate:"2026-12-01"},{...complete,status:"reading",completedDate:null}],"2026-10-03"),2);
});

test("reading-time totals exclude declared task-timer overlap and removed sessions, retaining overlap metadata",()=>{
  const rows=[session("2026-10-03",20,{minutes:15}),session("2026-10-03",20,{minutes:30,timeSource:"task_timer"}),session("2026-10-03",20,{minutes:50,voidedAt:"removed"}),session("2026-10-03")];
  assert.deepEqual(readingTimeTotals(rows),{readingMinutes:15,overlappingMinutes:30});
});
