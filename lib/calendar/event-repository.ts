import type { CalendarEvent, CalendarEventInput } from "../../types/calendar-event.ts";

// Adapters pin ownership to Auth; the database also enforces owned links.
// list includes archives for restore; setArchived never physically deletes rows.
export interface EventRepository {
  list(): Promise<CalendarEvent[]>;
  create(input: CalendarEventInput): Promise<void>;
  update(id: string, input: CalendarEventInput): Promise<void>;
  setArchived(id: string, archived: boolean): Promise<void>;
}
