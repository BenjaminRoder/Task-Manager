// Derived display data only: never persisted, edited, or archived independently.
// Class occurrence identity must be stable for a pattern ID + local date.
export type CalendarOccurrence = Readonly<{
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  courseId: string | null;
}> & (
  | Readonly<{ kind: "event"; eventId: string; taskId: string | null }>
  | Readonly<{ kind: "class"; patternId: string }>
);
