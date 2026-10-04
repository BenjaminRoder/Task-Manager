"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import type { Book, ReadingSession, ReadingSessionInput } from "@/types/reading";
import { validateReadingSession } from "@/lib/reading/reading-rules";
export function ReadingSessionForm({book,session,today,disabled,onSave,onCancel}:{book:Book;session?:ReadingSession;today:string;disabled:boolean;
  onSave(input:ReadingSessionInput,requestId:string):Promise<boolean>;onCancel?:()=>void}){
  const id=useId();const [error,setError]=useState("");const request=useRef<{key:string;id:string}|null>(null);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(disabled)return;const form=event.currentTarget;const data=new FormData(form);
    try{const input=validateReadingSession({bookId:book.id,date:String(data.get("date")??""),startPage:Number(data.get("startPage")),endPage:Number(data.get("endPage")),
      minutes:String(data.get("minutes")??"").trim()?Number(data.get("minutes")):null,timeSource:data.has("overlap")?"task_timer":"reading"});
      if(input.endPage>book.totalPages)throw new Error("Ending page cannot exceed total pages.");
      const key=JSON.stringify(input);if(request.current?.key!==key)request.current={key,id:crypto.randomUUID()};
      setError("");if(await onSave(input,request.current.id)){request.current=null;if(!session)form.reset();}}
    catch(problem){setError(problem instanceof Error?problem.message:"Check the reading session.");}}
  return <form className="reading-form" onSubmit={submit} aria-label={session?"Correct reading session":"Log reading for "+book.title}>
    <fieldset disabled={disabled}><div className="reading-fields">
      <label htmlFor={id+"-date"}>Reading date<input id={id+"-date"} name="date" type="date" required defaultValue={session?.date??today}/></label>
      <label htmlFor={id+"-start"}>Starting page<input id={id+"-start"} name="startPage" type="number" min={0} required readOnly={!session} defaultValue={session?.startPage??book.currentPage}/></label>
      <label htmlFor={id+"-end"}>Ending page<input id={id+"-end"} name="endPage" type="number" min={1} max={book.totalPages} required defaultValue={session?.endPage??""}/></label>
      <label htmlFor={id+"-minutes"}>Minutes (optional)<input id={id+"-minutes"} name="minutes" type="number" min={1} max={1440} defaultValue={session?.minutes??""}/></label>
    </div><label className="reading-overlap"><input type="checkbox" name="overlap" defaultChecked={session?.timeSource==="task_timer"}/>Already tracked with a task timer</label>
    <p className="category-help">Record minutes here only when they were not timed as a task, or check the box to keep them out of additive reading time.</p>
    <div className="row-actions"><button className="primary-button" type="submit">{session?"Save session correction":"Log reading"}</button>{onCancel?<button type="button" className="secondary-button" onClick={onCancel}>Cancel correction</button>:null}</div></fieldset>
    {error?<p className="form-error" role="alert">{error}</p>:null}
  </form>;
}
