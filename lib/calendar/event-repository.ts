import type { CalendarEvent, CalendarEventInput } from "../../types/calendar-event.ts";

// Future adapters must pin ownership to Auth and enforce owned links in the DB.
// list includes archives for restore; setArchived never physically deletes rows.
export interface EventRepository {
  list(): Promise<CalendarEvent[]>;
  create(input: CalendarEventInput): Promise<void>;
  update(id: string, input: CalendarEventInput): Promise<void>;
  setArchived(id: string, archived: boolean): Promise<void>;
}
