import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarEvent, CalendarEventInput } from "../../types/calendar-event.ts";
import type { RecurringClassPattern, RecurringClassPatternInput } from "../../types/recurring-class-pattern.ts";
import type { EventRepository } from "../calendar/event-repository.ts";
import type { RecurringClassRepository } from "../calendar/recurring-class-repository.ts";
import { validateCalendarEvent, validateClassPattern } from "../calendar/event-rules.ts";

interface CommonRow { id: string; title: string; course_id: string | null; start_time: string; end_time: string; archived_at: string | null; created_at: string; updated_at: string; }
export interface CalendarEventRow extends CommonRow { event_date: string; task_id: string | null; }
export interface ClassPatternRow extends CommonRow { weekdays: RecurringClassPattern["weekdays"]; start_date: string | null; end_date: string | null; }
function common(row: CommonRow) {
  return { id: row.id, title: row.title, courseId: row.course_id, startTime: row.start_time.slice(0, 5), endTime: row.end_time.slice(0, 5),
    archivedAt: row.archived_at, createdAt: row.created_at, updatedAt: row.updated_at };
}
export function eventFromRow(row: CalendarEventRow): CalendarEvent { return { ...common(row), date: row.event_date, taskId: row.task_id }; }
export function classFromRow(row: ClassPatternRow): RecurringClassPattern { return { ...common(row), weekdays: row.weekdays, startDate: row.start_date, endDate: row.end_date }; }
export function eventFields(input: CalendarEventInput) {
  const v = validateCalendarEvent(input);
  return { title: v.title, event_date: v.date, start_time: v.startTime, end_time: v.endTime, task_id: v.taskId, course_id: v.courseId };
}
export function classFields(input: RecurringClassPatternInput) {
  const v = validateClassPattern(input);
  return { title: v.title, weekdays: [...v.weekdays], start_time: v.startTime, end_time: v.endTime, start_date: v.startDate, end_date: v.endDate, course_id: v.courseId };
}
export function createCalendarRepositories(client: SupabaseClient, userId: string): { events: EventRepository; classes: RecurringClassRepository } {
  type Table = "calendar_events" | "recurring_class_patterns";
  function check(error: { message: string } | null) {
    if (error) throw new Error("Calendar data could not be saved or loaded: " + error.message + ". Reload and check your connection. If the schema is unavailable, the calendar migrations need a separately authorized application.");
  }
  async function authorize() {
    const { data, error } = await client.auth.getUser();
    if (error || data.user?.id !== userId) throw new Error("Your session changed or expired. Sign in again before changing the calendar.");
  }
  async function list<T>(table: Table): Promise<T[]> {
    await authorize(); const rows: T[] = [];
    for (let start = 0; ; start += 500) {
      const { data, error } = await client.from(table).select("*").eq("user_id", userId).order("id").range(start, start + 499).returns<T[]>();
      check(error); rows.push(...(data ?? [])); if (!data || data.length < 500) return rows;
    }
  }
  async function create(table: Table, fields: object) {
    await authorize(); const { error } = await client.from(table).insert({ ...fields, user_id: userId }); check(error);
  }
  async function update(table: Table, id: string, fields: object) {
    await authorize(); const { error } = await client.from(table).update(fields).eq("user_id", userId).eq("id", id).select("id").single(); check(error);
  }
  return {
    events: {
      async list() { return (await list<CalendarEventRow>("calendar_events")).map(eventFromRow); },
      async create(input) { await create("calendar_events", eventFields(input)); },
      async update(id, input) { await update("calendar_events", id, eventFields(input)); },
      async setArchived(id, archived) { await update("calendar_events", id, { archived_at: archived ? new Date().toISOString() : null }); },
    },
    classes: {
      async list() { return (await list<ClassPatternRow>("recurring_class_patterns")).map(classFromRow); },
      async create(input) { await create("recurring_class_patterns", classFields(input)); },
      async update(id, input) { await update("recurring_class_patterns", id, classFields(input)); },
      async setArchived(id, archived) { await update("recurring_class_patterns", id, { archived_at: archived ? new Date().toISOString() : null }); },
    },
  };
}
