"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRepositories } from "../supabase/repository-context";
import { localDate } from "../tasks/task-rules";
import type { Book, ReadingSession } from "@/types/reading";
import type { ReadingRepository } from "./reading-repository";
export function useReading() {
  const {reading:repository}=useRepositories();
  const [data,setData]=useState<{books:Book[];sessions:ReadingSession[]}>({books:[],sessions:[]});
  const [today,setToday]=useState<string|null>(null);const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const saving=useRef(false);const revision=useRef(0);
  const load=useCallback(async()=>{const [books,sessions]=await Promise.all([repository.listBooks(),repository.listSessions()]);return {books,sessions};},[repository]);
  const refresh=useCallback(async()=>{
    if(saving.current)return;const version=++revision.current;
    try{const saved=await load();if(version!==revision.current)return;setData(saved);setToday(localDate());setReady(true);setError("");}
    catch(problem){if(version!==revision.current)return;setReady(false);setError(problem instanceof Error?problem.message:"Reading could not load. Retry.");}
  },[load]);
  useEffect(()=>{
    let active=true;const version=++revision.current;
    const cancelPending=()=>{active=false;++revision.current;};
    load().then(saved=>{if(active && version===revision.current){setData(saved);setToday(localDate());setReady(true);setError("");}})
      .catch((problem:unknown)=>{if(active && version===revision.current)setError(problem instanceof Error?problem.message:"Reading could not load. Retry.");});
    const onFocus=()=>void refresh();const clock=window.setInterval(()=>setToday(localDate()),30000);
    window.addEventListener("focus",onFocus);
    return()=>{cancelPending();window.clearInterval(clock);window.removeEventListener("focus",onFocus);};
  },[load,refresh]);
  async function mutate(operation:(repository:ReadingRepository)=>Promise<void>):Promise<boolean>{
    if(saving.current || !ready)return false;saving.current=true;++revision.current;setBusy(true);setError("");
    try{await operation(repository);try{setData(await load());}catch{setReady(false);setError("Saved, but updated reading data could not load. Reload before another change.");}return true;}
    catch(problem){setReady(false);setError(problem instanceof Error?problem.message:"Could not save reading. Reload before retrying.");return false;}
    finally{saving.current=false;setBusy(false);}
  }
  return {...data,today,ready,busy,error,refresh,mutate};
}
