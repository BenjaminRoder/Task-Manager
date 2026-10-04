"use client";
import { useRef, useState } from "react";
import type { Book, ReadingSession } from "@/types/reading";
import { useReading } from "@/lib/reading/use-reading";
import { completedBooksThisYear, readingMetrics } from "@/lib/reading/reading-rules";
import { formatDate } from "@/lib/tasks/task-rules";
import { BookForm, statusLabels } from "./book-form";
import { ReadingSessionForm } from "./session-form";
export function ReadingBoard(){
  const {books,sessions,today,ready,busy,error,refresh,mutate}=useReading();
  const [showArchived,setShowArchived]=useState(false);
  const [editing,setEditing]=useState<Book|null>(null);const [correctingSession,setCorrectingSession]=useState<ReadingSession|null>(null);const [notice,setNotice]=useState("");
  const formContainer=useRef<HTMLDetailsElement>(null);
  function editBook(book:Book){setEditing(book);window.requestAnimationFrame(()=>{formContainer.current?.scrollIntoView({block:"center"});formContainer.current?.querySelector("input")?.focus();});}
  async function changed(operation:Parameters<typeof mutate>[0],message:string){const saved=await mutate(operation);if(saved)setNotice(message);return saved;}
  function card(book:Book){
    const metrics=readingMetrics(book,sessions,today!);const history=sessions.filter(s=>s.bookId===book.id).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id));
    const correcting=correctingSession?.bookId===book.id?correctingSession:undefined;
    return <article key={book.id} className={book.archivedAt?"reading-card is-archived":"reading-card"} aria-label={book.title}>
      <header><div><h3>{book.title}</h3>{book.author?<p>{book.author}</p>:null}</div><span>{book.archivedAt?"Archived · ":""}{statusLabels[book.status]}</span></header>
      <p className="reading-progress"><strong>{book.currentPage} / {book.totalPages} pages</strong><span>{Math.round(metrics.percentComplete)}% complete</span></p>
      <progress value={book.currentPage} max={book.totalPages} aria-label={book.title+" reading progress"}/>
      <div className="reading-metrics">
        <p>Today: <strong>{metrics.pagesToday} pages</strong></p>
        <p>This week: <strong>{metrics.pagesThisWeek}{book.weeklyPageGoal?" / "+book.weeklyPageGoal:""} pages</strong></p>
        <p>{metrics.goalRemaining===null?"No weekly target":metrics.goalRemaining+" pages to weekly goal · "+Math.round(metrics.goalPercent!)+"%"}</p>
        <p>Recent pace: <strong>{metrics.averagePagesPerDay===null?"No history":metrics.averagePagesPerDay.toFixed(1)+" pages/calendar day"}</strong></p>
        <p>{metrics.projectedFinish?"Projected finish: "+formatDate(metrics.projectedFinish):book.status==="completed"?"Completed "+formatDate(book.completedDate!):book.archivedAt || book.status!=="reading"?"Start or restore reading to see a projection.":metrics.remainingPages===0?"Final page reached. Mark completed when ready.":"Projection needs 3 reading dates over at least 7 days."}</p>
      </div>
      <div className="row-actions"><button disabled={busy} onClick={()=>editBook(book)} aria-label={"Edit book "+book.title}>Edit book</button>
        {!book.archivedAt && (book.status==="want_to_read" || book.status==="paused")?<button disabled={busy} onClick={()=>void changed(r=>r.updateBook(book,{...book,status:"reading",startedDate:book.startedDate??today!,completedDate:null}),"Book started.")}>Start reading</button>:null}
        {!book.archivedAt && book.status==="reading"?<button disabled={busy} onClick={()=>void changed(r=>r.updateBook(book,{...book,status:"completed",currentPage:book.totalPages,completedDate:today!}),"Book completed. Existing sessions were preserved.")}>Mark completed</button>:null}
        <button disabled={busy} aria-label={(book.archivedAt?"Restore book ":"Archive book ")+book.title} onClick={()=>void changed(r=>r.setArchived(book,!book.archivedAt),book.archivedAt?"Book restored.":"Book archived; reading history retained.")}>{book.archivedAt?"Restore":"Archive"}</button>
      </div>
      {book.status==="reading" && !book.archivedAt && book.currentPage<book.totalPages?<details className="reading-log"><summary>Log reading</summary>
        <ReadingSessionForm key={book.id+"-"+book.currentPage} book={book} today={today!} disabled={busy} onSave={(input,id)=>changed(r=>r.logSession(input,id),"Reading logged.")}/></details>:null}
      <details className="reading-history"><summary>Reading history ({history.filter(s=>!s.voidedAt).length})</summary>
        <p className="category-help">Corrections update progress and quotas. Manual page adjustments never rewrite this history.</p>
        {correcting?<ReadingSessionForm key={correcting.id} book={book} session={correcting} today={today!} disabled={busy} onCancel={()=>setCorrectingSession(null)}
          onSave={async(input)=>{const saved=await changed(r=>r.correctSession(correcting,input),"Session corrected.");if(saved)setCorrectingSession(null);return saved;}}/>:null}
        <ul className="reading-session-list">{history.map((session:ReadingSession)=><li key={session.id}><p>{formatDate(session.date)} · {session.startPage} → {session.endPage} · {session.endPage-session.startPage} pages{session.minutes!==null?" · "+session.minutes+" min":""}{session.timeSource==="task_timer"?" (task timer; excluded from reading-time totals)":""}{session.voidedAt?" · Removed":""}</p>
          {!session.voidedAt?<div className="row-actions"><button disabled={busy} onClick={()=>setCorrectingSession(session)}>Correct session</button><button disabled={busy} onClick={()=>void changed(r=>r.removeSession(session),"Session removed from totals; history retained.")}>Remove session</button></div>:null}</li>)}</ul>
        {!history.length?<p>No reading sessions yet.</p>:null}
      </details>
    </article>;
  }
  return <><header className="page-heading"><div><h1>Reading</h1><p>Steady progress, one page at a time.</p></div></header>
    {error?<div role="alert" className="error-banner"><p>{error}</p><button disabled={busy} className="secondary-button" onClick={()=>{setEditing(null);setCorrectingSession(null);void refresh();}}>Reload reading</button></div>:null}
    {!ready && !error?<p role="status">Loading your reading…</p>:null}
    {ready && today?<><div className="workload"><span>{books.filter(b=>b.status==="reading"&&!b.archivedAt).length} currently reading</span><strong>{completedBooksThisYear(books,today)} books completed in {today.slice(0,4)}</strong></div>
      <details ref={formContainer} className="reading-add" open={!!editing || books.length===0}><summary>{editing?"Edit book":"Add a book"}</summary>
      <BookForm key={editing?.id??"new"} book={editing??undefined} today={today} disabled={busy} onCancel={editing?()=>setEditing(null):undefined}
        onSave={async(input)=>{const saved=await changed(r=>editing?r.updateBook(editing,input):r.createBook(input),editing?"Book updated.":"Book added.");if(saved)setEditing(null);return saved;}}/>
      </details>
      <p className="notice" role="status">{busy?"Saving…":notice}</p>
      <p className="category-help">Pace uses up to 28 recent calendar days, including days without reading. Projections are estimates, not deadlines.</p>
      <button type="button" className="secondary-button" aria-pressed={showArchived} onClick={()=>setShowArchived(!showArchived)}>{showArchived ? "Hide archived" : "Show archived"}</button>
      {(["reading","want_to_read","paused","completed","archived"] as const).map(group=>{const rows=books.filter(book=>group==="archived"?showArchived&&!!book.archivedAt:!book.archivedAt&&book.status===group);
        return rows.length?<section key={group} className="reading-section"><h2>{group==="archived"?"Archived books":statusLabels[group]}</h2>{rows.map(card)}</section>:null;})}
      {!books.length?<div className="empty-state"><h2>Your next chapter starts here.</h2><p>Add a book, set a weekly goal, and log pages as you read.</p></div>:null}
    </>:null}</>;
}
