import type { ReactNode } from "react";
import type { Course } from "@/types/course";
import type { DayAvailability } from "@/lib/calendar/calendar-rules";
import { rankAvailability } from "@/lib/calendar/calendar-rules";
import { formatDate, formatDuration } from "@/lib/tasks/task-rules";

export function CalendarSidebar({ courses, availability, children }: { courses: Course[]; availability: DayAvailability[] | null; children: ReactNode }) {
  return <aside className="calendar-sidebar" aria-label="Week planning sidebar">
    <section><h3>Recorded availability</h3><p>Free within your planning window after recorded blocks. Unscheduled tasks, sleep and unentered commitments are not deducted.</p>
      {availability ? <ol className="calendar-availability">{rankAvailability(availability).map(day => <li key={day.date} data-date={day.date}>
        <span>{formatDate(day.date)}</span><strong>{formatDuration(day.freeMinutes)} free</strong>
      </li>)}</ol> : <p>Availability is unavailable until calendar data loads.</p>}
    </section>
    <section><h3>Courses</h3>{courses.length ? <ul>{courses.map(course => <li key={course.id}>{course.code ? `${course.code} · ` : ""}{course.name}{course.archivedAt ? " (archived)" : ""}</li>)}</ul> : <p>No courses yet. Use Manage courses above.</p>}</section>
    <section><h3>Quick task</h3><p>Tasks stay in the due-date strip; creating a task does not reserve calendar time.</p>{children}</section>
  </aside>;
}
