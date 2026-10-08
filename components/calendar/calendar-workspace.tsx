"use client";
import { useEffect, useRef, useState } from "react";
import { useCalendar } from "@/lib/calendar/use-calendar";
import { dailyAvailability, eventOccurrences } from "@/lib/calendar/calendar-rules";
import { expandWeeklyClasses } from "@/lib/calendar/weekly-recurrence";
import { validateInterval } from "@/lib/calendar/event-rules";
import { addCalendarDays } from "@/lib/tasks/week-rules";
import type { CalendarOccurrence } from "@/types/calendar-occurrence";
import type { Task, TaskInput } from "@/types/task";
import type { Category } from "@/types/category";
import type { Course } from "@/types/course";
import type { TaskType } from "@/types/task-type";
import type { Topic } from "@/types/topic";
import { TaskForm } from "../tasks/task-form";
import { CalendarForm } from "./calendar-form";
import { CalendarGrid } from "./calendar-grid";
import { CalendarSidebar } from "./calendar-sidebar";

export function CalendarWorkspace({ weekStart, today, tasks, categories, courses, taskTypes, topics, taskBusy, onCreateTask }: {
  weekStart: string; today: string; tasks: Task[]; categories: Category[]; courses: Course[]; taskTypes: TaskType[]; topics: Topic[];
  taskBusy: boolean; onCreateTask: (input: TaskInput) => Promise<boolean>;
}) {
  const calendar = useCalendar();
  const [editing, setEditing] = useState<{ kind: "event" | "class"; id?: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [planning, setPlanning] = useState({ start: "08:00", end: "22:00" });
  const [windowError, setWindowError] = useState<string | null>(null);
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => { if (editing) editor.current?.querySelector<HTMLInputElement>("input")?.focus(); }, [editing]);
  const dates = Array.from({ length: 7 }, (_, index) => addCalendarDays(weekStart, index));
  const occurrences = calendar.ready ? [...eventOccurrences(calendar.events, weekStart, dates[6]), ...expandWeeklyClasses(calendar.classes, weekStart, dates[6])] : [];
  const availability = calendar.ready ? dailyAvailability(dates, occurrences, planning.start, planning.end) : null;
  const event = editing?.kind === "event" ? calendar.events.find(row => row.id === editing.id) : undefined;
  const pattern = editing?.kind === "class" ? calendar.classes.find(row => row.id === editing.id) : undefined;
  function editOccurrence(item: CalendarOccurrence) {
    setEditing(item.kind === "event" ? { kind: "event", id: item.eventId } : { kind: "class", id: item.patternId });
    editor.current?.scrollIntoView({ block: "center" });
  }
  async function save(operation: () => Promise<void>) {
    const saved = await calendar.mutate(operation);
    if (saved) { setNotice("Calendar saved."); setEditing(null); }
    return saved;
  }
  async function archive(kind: "event" | "class", id: string, archived: boolean) {
    const repository = kind === "event" ? calendar.eventRepository : calendar.classRepository;
    if (await calendar.mutate(() => repository.setArchived(id, archived))) {
      setNotice(archived ? "Archived. Restore it from retained records below." : "Restored to the calendar.");
      if (editing?.kind === kind && editing.id === id) setEditing(null);
    }
  }
  const disabled = calendar.busy || !calendar.ready;
  return <section className="calendar-workspace" aria-label="Events and weekly classes">
    <header className="calendar-toolbar"><div><h2>Calendar</h2><p>Events and weekly classes · local wall-clock times</p></div>
      <div className="row-actions"><button disabled={disabled} onClick={() => setEditing({ kind: "event" })}>New event</button>
        <button disabled={disabled} onClick={() => setEditing({ kind: "class" })}>New class series</button></div>
    </header>
    {calendar.error ? <div role="alert" className="error-banner"><p>{calendar.error}</p><button disabled={calendar.busy} onClick={() => void calendar.refresh()}>Retry loading calendar</button></div> : null}
    {!calendar.ready && !calendar.error ? <p role="status">Loading calendar…</p> : null}
    <div ref={editor}>
      {editing?.kind === "event" ? <CalendarForm key={"event:" + (editing.id ?? "new")} kind="event" record={event} date={weekStart} courses={courses} tasks={tasks}
        disabled={disabled} onCancel={() => setEditing(null)} onSave={input => save(() => event ? calendar.eventRepository.update(event.id, input) : calendar.eventRepository.create(input))} /> : null}
      {editing?.kind === "class" ? <CalendarForm key={"class:" + (editing.id ?? "new")} kind="class" record={pattern} date={weekStart} courses={courses} tasks={tasks}
        disabled={disabled} onCancel={() => setEditing(null)} onSave={input => save(() => pattern ? calendar.classRepository.update(pattern.id, input) : calendar.classRepository.create(input))} /> : null}
    </div>
    <p className="notice" role="status">{calendar.busy ? "Saving calendar…" : notice}</p>
    <form className="planning-window" aria-label="Planning window" onSubmit={event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      const start = String(data.get("start")), end = String(data.get("end"));
      try { validateInterval(start, end); setPlanning({ start, end }); setWindowError(null); }
      catch (problem) { setWindowError(problem instanceof Error ? problem.message : "Check your window."); }
    }}>
      <label>Planning starts<input name="start" type="time" step="60" required defaultValue={planning.start} /></label>
      <label>Planning ends<input name="end" type="time" step="60" required defaultValue={planning.end} /></label>
      <button type="submit">Apply window</button><p>Availability window: {planning.start}–{planning.end}. Due-task estimates are separate.</p>
      {windowError ? <p role="alert">{windowError}</p> : null}
    </form>
    <div className="calendar-layout">
      <div className="calendar-main">
        {calendar.ready ? <>
          {!occurrences.length ? <p className="empty-calendar">No recorded events or classes this week. Add an event or weekly series.</p> : null}
          <p className="list-footnote">Scroll for other hours or days. Short blocks have a minimum display height; labels show exact times. Select a block for its full details.</p>
          <CalendarGrid dates={dates} occurrences={occurrences} disabled={disabled} onEdit={editOccurrence} />
          <details className="calendar-records"><summary>Manage events and class series (including archived)</summary>
            <p>Editing a class changes its whole series. Archive retains the record; restore brings it back.</p>
            {!calendar.events.length && !calendar.classes.length ? <p>No saved calendar records.</p> : null}
            <ul>{calendar.events.map(row => <li key={"event:" + row.id}><span>{row.title} · {row.date}{row.archivedAt ? " (archived)" : ""}</span>
              <button disabled={disabled} aria-label={`Edit event ${row.title}`} onClick={() => setEditing({ kind: "event", id: row.id })}>Edit</button>
              <button disabled={disabled} aria-label={`${row.archivedAt ? "Restore" : "Archive"} event ${row.title}`} onClick={() => void archive("event", row.id, !row.archivedAt)}>{row.archivedAt ? "Restore" : "Archive"}</button></li>)}
              {calendar.classes.map(row => <li key={"class:" + row.id}><span>{row.title} · weekly series{row.archivedAt ? " (archived)" : ""}</span>
                <button disabled={disabled} aria-label={`Edit class series ${row.title}`} onClick={() => setEditing({ kind: "class", id: row.id })}>Edit series</button>
                <button disabled={disabled} aria-label={`${row.archivedAt ? "Restore" : "Archive"} class series ${row.title}`} onClick={() => void archive("class", row.id, !row.archivedAt)}>{row.archivedAt ? "Restore" : "Archive"}</button></li>)}</ul>
          </details>
        </> : null}
      </div>
      <CalendarSidebar courses={courses} availability={availability}>
        <TaskForm today={today} categories={categories} courses={courses} taskTypes={taskTypes} topics={topics} disabled={taskBusy}
          onSave={async input => { const saved = await onCreateTask(input); if (saved) setNotice("Task saved. Your selected week and organization are unchanged."); return saved; }} />
      </CalendarSidebar>
    </div>
  </section>;
}
