// Matches Date.getDay()/getUTCDay(): Sunday = 0, Monday = 1, Saturday = 6.
export type CalendarWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Persisted weekly series only. Future validation must enforce unique weekdays,
// local HH:mm times with end > start, and ordered inclusive YYYY-MM-DD bounds.
export interface RecurringClassPatternInput {
  title: string;
  courseId: string | null;
  weekdays: readonly [CalendarWeekday, ...CalendarWeekday[]];
  startTime: string;
  endTime: string;
  startDate: string | null;
  endDate: string | null;
}

export interface RecurringClassPattern extends RecurringClassPatternInput {
  id: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
