import test from "node:test";
import assert from "node:assert/strict";
import { validateTopic, validateTopicIds } from "../lib/classification/topic-rules.ts";
import { taskFromRow, type TaskRow } from "../lib/supabase/repositories.ts";
import { predictTasks } from "../lib/estimation/duration-estimation.ts";
import { sortTasks, remainingMinutes, validateTask } from "../lib/tasks/task-rules.ts";
import { buildWeek } from "../lib/tasks/week-rules.ts";
import { validateStoredData } from "../lib/storage/local-store.ts";
import type { Task } from "../types/task.ts";
import type { TimeSession } from "../types/time-session.ts";

test("topic validation trims names and normalizes multiple IDs without accepting invalid values", () => {
  assert.deepEqual(validateTopic({name:" Chapter 8 "}), {name:"Chapter 8"});
  assert.throws(() => validateTopic({name:" "})); assert.throws(() => validateTopic({name:"x".repeat(61)}));
  assert.deepEqual(validateTopicIds([" one ","two","one"]), ["one","two"]);
  assert.deepEqual(validateTopicIds([]), []);
  for (const ids of [[""],["x".repeat(201)],[null],"one"]) assert.throws(() => validateTopicIds(ids as string[]));
});

test("task reads normalize missing topics and reconstruct every persisted association", () => {
  const row: TaskRow={id:"task",title:"Study",category_id:null,priority:"medium",scheduled_date:"2026-10-03",due_date:null,estimated_minutes:null,status:"incomplete",created_at:"2026-01-01",completed_at:null,deleted_at:null};
  assert.deepEqual(taskFromRow(row).topicIds, []);
  const read = taskFromRow({...row, task_topics:[{topic_id:"one"},{topic_id:"two"}]});
  assert.deepEqual(read.topicIds, ["one","two"]);
  assert.deepEqual(validateTask(read).topicIds, ["one","two"]);
  assert.throws(() => validateStoredData({version:2,categories:[],tasks:[read]}), /./);
  assert.equal(validateStoredData({version:2,categories:[],tasks:[taskFromRow(row)]}).tasks.length, 1);
});

test("topics cannot alter predictions, manual precedence, Momentum, Today/Week workload or timer eligibility", () => {
  const base: Task={id:"target",title:"Study",categoryId:"school",courseId:"acct",taskTypeId:"hw",priority:"medium",scheduledDate:"2026-10-03",dueDate:"2026-10-03",estimatedMinutes:null,status:"incomplete",createdAt:"2026-01-01",completedAt:null,deletedAt:null};
  const history: Task[]=[1,2,3].map(i=>({...base,id:"h"+i,status:"completed",completedAt:"2026-01-0"+i}));
  const sessions: TimeSession[]=history.map((task,i)=>({id:task.id,taskId:task.id,userId:"owner",startedAt:"2026-01-01T00:00:00Z",endedAt:"2026-01-01T01:00:00Z",durationSeconds:(i+1)*600,voidedAt:null,createdAt:"2026-01-01",updatedAt:"2026-01-01"}));
  const tasks=[base,{...base,id:"manual",estimatedMinutes:10},...history];
  const tagged=tasks.map((task,i)=>({...task,topicIds:["topic-"+i,"shared"]}));
  const predictions=predictTasks(tasks,sessions); const taggedPredictions=predictTasks(tagged,sessions);
  assert.deepEqual(taggedPredictions,predictions);
  assert.equal(predictions.get("target")?.source,"course_task_type");
  assert.equal(predictions.get("target")?.minutes,25);
  assert.deepEqual(sortTasks(tagged,"momentum",taggedPredictions).map(t=>t.id),sortTasks(tasks,"momentum",predictions).map(t=>t.id));
  assert.equal(remainingMinutes(tagged,taggedPredictions),remainingMinutes(tasks,predictions));
  assert.deepEqual(buildWeek(tagged,"2026-09-28",taggedPredictions).map(d=>d.estimatedMinutes),buildWeek(tasks,"2026-09-28",predictions).map(d=>d.estimatedMinutes));
  const active=[...sessions,{...sessions[0],id:"active",endedAt:null,durationSeconds:null}];
  assert.deepEqual(predictTasks(tagged,active),predictTasks(tasks,active));
  assert.equal(predictTasks(tagged,active).get("target")?.source,"fallback");
});
