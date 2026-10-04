"use client";
import { useId, useState, type FormEvent } from "react";
import { bookStatuses, type Book, type BookInput, type BookStatus } from "@/types/reading";
import { validateBook } from "@/lib/reading/reading-rules";
export const statusLabels:Record<BookStatus,string>={want_to_read:"Want to Read",reading:"Reading",paused:"Paused",completed:"Completed"};
export function BookForm({book,today,disabled,onSave,onCancel}:{book?:Book;today:string;disabled:boolean;onSave(input:BookInput):Promise<boolean>;onCancel?:()=>void}){
  const id=useId();const [status,setStatus]=useState<BookStatus>(book?.status??"want_to_read");const [error,setError]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(disabled)return;const form=event.currentTarget;const data=new FormData(form);
    try{const input=validateBook({title:String(data.get("title")??""),author:String(data.get("author")??"")||null,
      totalPages:Number(data.get("totalPages")),currentPage:Number(data.get("currentPage")),status,
      startedDate:status==="want_to_read"?null:String(data.get("startedDate")??"")||null,
      completedDate:status==="completed"?String(data.get("completedDate")??"")||null:null,
      weeklyPageGoal:String(data.get("weeklyPageGoal")??"").trim()?Number(data.get("weeklyPageGoal")):null});
      setError("");if(await onSave(input)){if(!book){form.reset();setStatus("want_to_read");}}}
    catch(problem){setError(problem instanceof Error?problem.message:"Check book details.");}
  }
  return <form className="task-form reading-form" aria-label={book?"Edit book "+book.title:"Add a book"} onSubmit={submit}>
    <fieldset disabled={disabled}><h2>{book?"Edit book":"Add a book"}</h2><div className="reading-fields">
      <label htmlFor={id+"-title"}>Book title<input id={id+"-title"} name="title" required maxLength={160} defaultValue={book?.title??""}/></label>
      <label htmlFor={id+"-pages"}>Total pages<input id={id+"-pages"} name="totalPages" type="number" min={1} max={100000} required defaultValue={book?.totalPages??""}/></label>
      <label htmlFor={id+"-author"}>Author (optional)<input id={id+"-author"} name="author" maxLength={120} defaultValue={book?.author??""}/></label>
      <label htmlFor={id+"-current"}>Current page<input id={id+"-current"} name="currentPage" type="number" min={0} max={100000} required defaultValue={book?.currentPage??0}/></label>
      <label htmlFor={id+"-status"}>Status<select id={id+"-status"} value={status} onChange={event=>setStatus(event.target.value as BookStatus)}>{bookStatuses.map(value=><option key={value} value={value}>{statusLabels[value]}</option>)}</select></label>
      <label htmlFor={id+"-goal"}>Weekly page goal (optional)<input id={id+"-goal"} name="weeklyPageGoal" type="number" min={1} max={100000} defaultValue={book?.weeklyPageGoal??""}/></label>
      {status!=="want_to_read"?<label htmlFor={id+"-started"}>Started date<input id={id+"-started"} name="startedDate" type="date" required defaultValue={book?.startedDate??today}/></label>:null}
      {status==="completed"?<label htmlFor={id+"-finished"}>Completed date<input id={id+"-finished"} name="completedDate" type="date" required defaultValue={book?.completedDate??today}/></label>:null}
    </div><p className="category-help">Changing current page preserves every reading session. Weekly goals run Monday–Sunday.</p>
    <div className="row-actions"><button className="primary-button" type="submit">{book?"Save book":"Add book"}</button>{onCancel?<button type="button" className="secondary-button" onClick={onCancel}>Cancel book edit</button>:null}</div></fieldset>
    {error?<p role="alert" className="form-error">{error}</p>:null}
  </form>;
}
