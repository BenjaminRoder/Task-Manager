"use client";
import { useId, useState, type FormEvent } from "react";
import type { CalendarEvent, CalendarEventInput } from "@/types/calendar-event";
import type { RecurringClassPattern, RecurringClassPatternInput, CalendarWeekday } from "@/types/recurring-class-pattern";
import type { Course } from "@/types/course";
import type { Task } from "@/types/task";
import { validateCalendarEvent, validateClassPattern } from "@/lib/calendar/event-rules";

type Props = { date: string; courses: Course[]; tasks: Task[]; disabled: boolean; onCancel: () => void } & (
  | { kind: "event"; record?: CalendarEvent; onSave: (input: CalendarEventInput) => Promise<boolean> }
  | { kind: "class"; record?: RecurringClassPattern; onSave: (input: RecurringClassPatternInput) => Promise<boolean> }
);
const weekdays: [CalendarWeekday, string][] = [[1, "Monday"], [2, "Tuesday"], [3, "Wednesday"], [4, "Thursday"], [5, "Friday"], [6, "Saturday"], [0, "Sunday"]];

export function CalendarForm(props: Props) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const { record, courses, tasks } = props;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (props.disabled) return;
    const data = new FormData(event.currentTarget);
    const text = (key: string) => String(data.get(key) ?? "");
    const common = { title: text("title"), courseId: text("courseId") || null, startTime: text("startTime"), endTime: text("endTime") };
    try {
      setError(null);
      if (props.kind === "event") await props.onSave(validateCalendarEvent({ ...common, date: text("date"), taskId: text("taskId") || null }));
      else await props.onSave(validateClassPattern({ ...common, weekdays: data.getAll("weekdays").map(Number) as RecurringClassPatternInput["weekdays"],
        startDate: text("startDate") || null, endDate: text("endDate") || null }));
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Check calendar details."); }
  }
  return <form className="calendar-form" onSubmit={submit} aria-label={props.kind === "event" ? "Event editor" : "Class series editor"}>
    <h3>{record ? "Edit" : "New"} {props.kind === "event" ? "event" : "weekly class series"}</h3>
    {props.kind === "class" ? <p>Changes apply to the whole series. Dates are inclusive.</p> : null}
    <fieldset disabled={props.disabled}>
      <div className="calendar-form-fields">
        <label htmlFor={id + "title"}>Title<input id={id + "title"} name="title" required maxLength={160} defaultValue={record?.title ?? ""} /></label>
        {props.kind === "event" ? <label>Date<input name="date" type="date" required defaultValue={props.record?.date ?? props.date} /></label> : null}
        <label>Start time<input name="startTime" type="time" step="60" required defaultValue={record?.startTime ?? "09:00"} /></label>
        <label>End time<input name="endTime" type="time" step="60" required defaultValue={record?.endTime ?? "10:00"} /></label>
        <label>Course<select name="courseId" defaultValue={record?.courseId ?? ""}>
          <option value="">Unassigned</option>
          {courses.filter(course => !course.archivedAt || course.id === record?.courseId).map(course => <option key={course.id} value={course.id}>{course.name}{course.archivedAt ? " (archived)" : ""}</option>)}
        </select></label>
        {props.kind === "event" ? <label>Linked task<select name="taskId" defaultValue={props.record?.taskId ?? ""}>
          <option value="">None</option>
          {props.record?.taskId && !tasks.some(task => task.id === props.record?.taskId) ? <option value={props.record.taskId}>Retained task (removed)</option> : null}
          {tasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}
        </select></label> : null}
        {props.kind === "class" ? <>
          <label>Starts on (optional)<input name="startDate" type="date" defaultValue={props.record?.startDate ?? ""} /></label>
          <label>Ends on (optional)<input name="endDate" type="date" defaultValue={props.record?.endDate ?? ""} /></label>
        </> : null}
      </div>
      {props.kind === "class" ? <fieldset className="calendar-weekdays"><legend>Repeat weekly on</legend>
        {weekdays.map(([day, name]) => <label key={day}><input type="checkbox" name="weekdays" value={day} defaultChecked={props.record?.weekdays.includes(day) ?? false} />{name}</label>)}
      </fieldset> : null}
      <div className="row-actions"><button type="submit" className="primary-button">Save {props.kind === "event" ? "event" : "class series"}</button>
        <button type="button" onClick={props.onCancel}>Cancel</button></div>
    </fieldset>
    {error ? <p role="alert">{error}</p> : null}
  </form>;
}
