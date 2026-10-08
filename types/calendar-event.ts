// Dates are YYYY-MM-DD and times are floating local HH:mm.
// App/database validation require a same-day interval with end strictly after start.
export interface CalendarEventInput {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  taskId: string | null;
  courseId: string | null;
}

export interface CalendarEvent extends CalendarEventInput {
  id: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
