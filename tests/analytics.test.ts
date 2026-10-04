import test from "node:test";
import assert from "node:assert/strict";
import { analyticsPeriod, buildAnalytics, calendarDate, type AnalyticsData } from "../lib/analytics/analytics.ts";
import type { Task } from "../types/task.ts";
import type { TimeSession } from "../types/time-session.ts";
import type { ReadingSession } from "../types/reading.ts";
export const task: Task = {id:"t",title:"Homework",categoryId:"school",courseId:"course",priority:"medium",estimatedMinutes:999,
  dueDate:null,scheduledDate:"2026-10-04",status:"completed",completedAt:"2026-10-04T16:00:00Z",createdAt:"2026-09-01",deletedAt:null};
const session: TimeSession = {id:"s",userId:"owner",taskId:"t",startedAt:"2026-10-04T14:00:00Z",endedAt:"2026-10-04T15:00:00Z",durationSeconds:3600,voidedAt:null,createdAt:"",updatedAt:""};
const reading: ReadingSession = {id:"r",bookId:"book",date:"2026-10-04",startPage:0,endPage:20,pagesRead:20,minutes:30,timeSource:"reading",voidedAt:null,createdAt:"",updatedAt:""};
const empty: AnalyticsData = {tasks:[],sessions:[],books:[],readingSessions:[],categories:[],courses:[],estimates:[]};
const period=analyticsPeriod("2026-10-04","week");
function analyze(data: Partial<AnalyticsData> = {}, range=period) {return buildAnalytics({...empty,...data},range,"2026-10-04","America/New_York");}
test("Monday-Sunday and month boundaries cross years, leap years, and DST by calendar date",()=>{
  assert.deepEqual(period,{start:"2026-09-28",end:"2026-10-04"});
  assert.deepEqual(analyticsPeriod("2026-01-01","week"),{start:"2025-12-29",end:"2026-01-04"});
  assert.deepEqual(analyticsPeriod("2024-02-29","month"),{start:"2024-02-01",end:"2024-02-29"});
  assert.deepEqual(analyticsPeriod("2026-12-31","month"),{start:"2026-12-01",end:"2026-12-31"});
  assert.equal(calendarDate("2026-10-05T03:59:59Z","America/New_York"),"2026-10-04");
  assert.equal(calendarDate("2026-10-05T04:00:00Z","America/New_York"),"2026-10-05");
  assert.equal(calendarDate("2026-03-08T07:30:00Z","America/New_York"),"2026-03-08");
  assert.throws(()=>analyticsPeriod("2026-02-30","month"));
});
test("only stopped positive nonvoid sessions count, including retained deleted tasks",()=>{
  const result=analyze({tasks:[{...task,deletedAt:"2026-10-04"}],sessions:[session,
    {...session,id:"active",endedAt:null},{...session,id:"void",voidedAt:"2026-10-04"},
    {...session,id:"zero",durationSeconds:0},{...session,id:"bad",durationSeconds:NaN},
    {...session,id:"reverse",endedAt:session.startedAt},{...session,id:"invalid",startedAt:"invalid"}]});
  assert.equal(result.focusedSeconds,3600);assert.equal(result.completedCount,1);assert.equal(result.averageTaskMinutes,60);
  assert.equal(result.studySeconds,3600);assert.equal(result.nonStudySeconds,0);
});
test("course assignment alone classifies the full eligible task duration as study",()=>{
  const result=analyze({tasks:[{...task,categoryId:null,taskTypeId:null}],sessions:[session]});
  assert.equal(result.studySeconds,3600);assert.equal(result.nonStudySeconds,0);
  assert.equal(result.studySeconds+result.nonStudySeconds,result.timerSeconds);
});
test("tasks without a course classify as non-study regardless of names or other classifications",()=>{
  for(const courseId of [null,undefined]) {
    const result=analyze({tasks:[{...task,courseId,title:"Study Accounting",taskTypeId:"homework"}],sessions:[session],
      categories:[{id:"school",name:"School",color:"#123456",archivedAt:null}]});
    assert.equal(result.studySeconds,0);assert.equal(result.nonStudySeconds,3600);
    assert.equal(result.studySeconds+result.nonStudySeconds,result.timerSeconds);
  }
});
test("reading and declared task-timer overlap contribute nothing to either task classification bucket",()=>{
  const result=analyze({readingSessions:[reading,{...reading,id:"overlap",timeSource:"task_timer"}]});
  assert.equal(result.studySeconds,0);assert.equal(result.nonStudySeconds,0);
  assert.equal(result.readingSeconds,1800);assert.equal(result.overlappingSeconds,1800);
  assert.equal(result.focusedSeconds,1800);
});
test("mixed task timers and reading produce independent exact-second totals",()=>{
  const result=analyze({tasks:[task,{...task,id:"other",courseId:null}],
    sessions:[session,{...session,id:"other",taskId:"other",durationSeconds:125}],readingSessions:[reading]});
  assert.equal(result.studySeconds,3600);assert.equal(result.nonStudySeconds,125);
  assert.equal(result.readingSeconds,1800);assert.equal(result.timerSeconds,3725);assert.equal(result.focusedSeconds,5525);
});
test("archived courses still classify retained historical tasks as study without requiring course metadata",()=>{
  const historical={...task,deletedAt:"2026-10-04"};
  const courses=[{id:"course",name:"Renamed course",code:null,archivedAt:"2026-10-01",createdAt:"",updatedAt:""}];
  for(const metadata of [courses,[]]) {
    const result=analyze({tasks:[historical],sessions:[session],courses:metadata});
    assert.equal(result.studySeconds,3600);assert.equal(result.nonStudySeconds,0);
  }
});
test("study and non-study totals retain period, future-date and session eligibility filtering",()=>{
  const excluded=[{...session,id:"old",startedAt:"2026-09-27T14:00:00Z",endedAt:"2026-09-27T15:00:00Z"},
    {...session,id:"future",startedAt:"2026-10-05T14:00:00Z",endedAt:"2026-10-05T15:00:00Z"},
    {...session,id:"active",endedAt:null},{...session,id:"void",voidedAt:"2026-10-04"},
    {...session,id:"zero",durationSeconds:0}];
  for(const courseId of ["course",null]) {
    const result=analyze({tasks:[{...task,courseId}],sessions:[session,...excluded]});
    assert.equal(result.studySeconds,courseId===null?0:3600);
    assert.equal(result.nonStudySeconds,courseId===null?3600:0);
  }
});
test("period filtering precedes reading combination; overlap is contextual and pages remain counted",()=>{
  const result=analyze({sessions:[session],readingSessions:[reading,{...reading,id:"overlap",timeSource:"task_timer"},
    {...reading,id:"prior",date:"2026-09-27"},{...reading,id:"future",date:"2026-10-05"},
    {...reading,id:"void",voidedAt:"2026-10-04"}]});
  assert.equal(result.focusedSeconds,5400);assert.equal(result.readingSeconds,1800);assert.equal(result.overlappingSeconds,1800);
  assert.deepEqual(result.pagesByWeek,[{id:"2026-09-28",label:"2026-09-28",value:40}]);
  assert.equal(result.month.focusedSeconds,5400);
});
test("category/course/day grouping uses IDs, archives, unassigned buckets and local start date",()=>{
  const result=analyze({tasks:[task,{...task,id:"other",categoryId:null,courseId:null}],categories:[{id:"school",name:"Renamed",color:"#123456",archivedAt:"2026-10-04"}],
    courses:[{id:"course",name:"Accounting",code:null,archivedAt:null,createdAt:"",updatedAt:""}],
    sessions:[session,{...session,id:"other",taskId:"other",startedAt:"2026-10-05T03:30:00Z",endedAt:"2026-10-05T04:30:00Z"}],readingSessions:[reading]});
  assert.equal(result.byCategory.find(row=>row.label==="Renamed")?.value,3600);
  assert.equal(result.byCategory.find(row=>row.label==="No category")?.value,3600);
  assert.equal(result.byCourse.find(row=>row.label==="Accounting")?.value,3600);
  assert.equal(result.byCourse.find(row=>row.label==="No course")?.value,3600);
  assert.equal(result.byDay.find(row=>row.id==="2026-10-04")?.value,9000);
});
test("snapshot errors ignore mutable estimates, separate prediction, and exclude zero actuals and legacy history",()=>{
  const snapshot={id:"e",taskId:"t",completedAt:task.completedAt!,manualMinutes:45,predictedMinutes:30,effectiveMinutes:45,effectiveSource:"manual" as const,predictionSource:"global" as const,sampleSize:3};
  const result=analyze({tasks:[task,{...task,id:"untimed"},{...task,id:"legacy"}],sessions:[session],estimates:[snapshot]});
  assert.equal(result.completedCount,3);assert.equal(result.timedCompletedCount,1);assert.equal(result.averageTaskMinutes,60);
  assert.deepEqual(result.predictionError,{count:1,biasMinutes:30,meanAbsoluteMinutes:30,meanAbsolutePercent:50});
  assert.equal(result.estimateError.meanAbsoluteMinutes,15);assert.equal(result.estimateError.meanAbsolutePercent,25);
  assert.equal(result.comparisons[1].snapshot,null);
  assert.equal(analyze({tasks:[{...task,status:"incomplete",completedAt:null}],sessions:[session],estimates:[snapshot]}).completedCount,0);
  assert.equal(analyze({tasks:[task],sessions:[{...session,voidedAt:"now"}],estimates:[snapshot]}).predictionError.count,0);
});
test("completion actual duration uses lifetime sessions while focused totals use only period",()=>{
  const result=analyze({tasks:[task],sessions:[session,{...session,id:"old",startedAt:"2026-09-01T14:00:00Z",endedAt:"2026-09-01T15:00:00Z"}]});
  assert.equal(result.focusedSeconds,3600);assert.equal(result.averageTaskMinutes,120);
});
test("recompletion snapshots match PostgreSQL microseconds rather than an earlier event in the same millisecond",()=>{
  const snapshot={id:"old",taskId:"t",completedAt:"2026-10-04T16:00:00.000001Z",manualMinutes:45,predictedMinutes:null,effectiveMinutes:45,effectiveSource:"manual" as const,predictionSource:"fallback" as const,sampleSize:0};
  const result=analyze({tasks:[{...task,completedAt:"2026-10-04T12:00:00.000002-04:00"}],sessions:[session],estimates:[snapshot,{...snapshot,id:"new",completedAt:"2026-10-04T16:00:00.000002Z",manualMinutes:30,effectiveMinutes:30}]});
  assert.equal(result.comparisons[0].snapshot?.id,"new");
});
test("pages week edges are filtered to the selected month; progress is current and empty errors stay null",()=>{
  const result=analyze({readingSessions:[reading,{...reading,id:"september",date:"2026-09-30"}],books:[{id:"book",title:"Book",author:null,totalPages:100,currentPage:40,status:"reading",startedDate:"2026-09-01",completedDate:null,weeklyPageGoal:50,archivedAt:null,createdAt:"",updatedAt:""}]},analyticsPeriod("2026-10-04","month"));
  assert.equal(result.pagesByWeek[0].value,20);assert.equal(result.readingProgress[0].percentComplete,40);
  const zero=analyze();assert.equal(zero.focusedSeconds,0);assert.equal(zero.averageTaskMinutes,null);assert.equal(zero.predictionError.meanAbsolutePercent,null);assert.equal(zero.byDay.length,7);
});
