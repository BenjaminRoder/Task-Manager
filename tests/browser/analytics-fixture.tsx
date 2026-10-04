"use client";
// Local synthetic data only. This fixture is never mounted by production routes.
import { useMemo, useState } from "react";
import { AnalyticsBoard } from "@/components/analytics/analytics-board";
import { RepositoryContext } from "@/lib/supabase/repository-context";
import { TimerProvider } from "@/lib/timers/timer-provider";
import { localDate } from "@/lib/tasks/task-rules";
import type { AnalyticsData } from "@/lib/analytics/analytics";

const unavailable = async () => { throw new Error("Read-only analytics fixture"); };
function fixture(empty: boolean): AnalyticsData {
  if (empty) return {tasks:[],sessions:[],categories:[],courses:[],books:[],readingSessions:[],estimates:[]};
  const today=localDate(), timestamp=today+"T12:00:00";
  return {
    tasks:[{id:"t",title:"Accounting homework",categoryId:"c",courseId:"course",priority:"medium",dueDate:null,scheduledDate:today,estimatedMinutes:999,status:"completed",completedAt:timestamp,createdAt:timestamp,deletedAt:null}],
    sessions:[{id:"s",userId:"fixture",taskId:"t",startedAt:today+"T10:00:00",endedAt:today+"T11:00:00",durationSeconds:3600,voidedAt:null,createdAt:timestamp,updatedAt:timestamp}],
    categories:[{id:"c",name:"School",color:"#23624c",archivedAt:null}],
    courses:[{id:"course",name:"Accounting",code:null,archivedAt:null,createdAt:timestamp,updatedAt:timestamp}],
    books:[{id:"b",title:"A very long book title for checking responsive reading progress cards on a narrow mobile viewport",author:null,totalPages:200,currentPage:40,status:"reading",startedDate:today,completedDate:null,weeklyPageGoal:50,archivedAt:null,createdAt:timestamp,updatedAt:timestamp}],
    readingSessions:["reading","task_timer"].map((source,index)=>({id:"r"+index,bookId:"b",date:today,startPage:index*20,endPage:(index+1)*20,pagesRead:20,minutes:15,timeSource:source as "reading"|"task_timer",voidedAt:null,createdAt:timestamp,updatedAt:timestamp})),
    estimates:[{id:"e",taskId:"t",completedAt:timestamp,manualMinutes:45,predictedMinutes:30,effectiveMinutes:45,effectiveSource:"manual",predictionSource:"global",sampleSize:3}],
  };
}
function FixtureBoard({empty,failed}:{empty:boolean;failed:boolean}){
  const data=useMemo(()=>fixture(empty),[empty]);
  const repositories=useMemo(()=>({
    tasks:{list:async()=>[...data.tasks],create:unavailable,update:unavailable,setStatus:unavailable,remove:unavailable},
    categories:{list:async()=>[...data.categories],create:unavailable,update:unavailable,setArchived:unavailable},
    courses:{list:async()=>[...data.courses],create:unavailable,update:unavailable,setArchived:unavailable},
    taskTypes:{list:async()=>[],create:unavailable,update:unavailable,setArchived:unavailable},
    topics:{list:async()=>[],create:unavailable,update:unavailable,setArchived:unavailable},
    reading:{listBooks:async()=>[...data.books],listSessions:async()=>[...data.readingSessions],createBook:unavailable,updateBook:unavailable,setArchived:unavailable,logSession:unavailable,correctSession:unavailable,removeSession:unavailable},
    analytics:{listEstimates:async()=>{if(failed || localStorage.getItem("analytics-fixture-fail")==="true")throw new Error("Fixture load failure. Reload analytics to retry.");return [...data.estimates];}},
  }),[data,failed]);
  const timers=useMemo(()=>({list:async()=>[...data.sessions],serverTime:async()=>Date.now(),taskTitle:async()=>"Accounting homework",start:unavailable,stop:unavailable,update:unavailable,remove:unavailable}),[data]);
  return <RepositoryContext.Provider value={repositories}><TimerProvider repository={timers}><AnalyticsBoard/></TimerProvider></RepositoryContext.Provider>;
}
export default function AnalyticsFixture(){
  const [mode,setMode]=useState("populated");
  return <><p>Local Analytics fixture — no hosted data.</p><div className="row-actions"><button onClick={()=>setMode("empty")}>Empty fixture</button><button onClick={()=>setMode("populated")}>Populated fixture</button><button onClick={()=>setMode("failed")}>Failed fixture</button></div><FixtureBoard key={mode} empty={mode==="empty"} failed={mode==="failed"}/></>;
}
