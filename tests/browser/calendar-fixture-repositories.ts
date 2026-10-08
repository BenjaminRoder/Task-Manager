// Explicit browser fixture storage. Never imported by production code.
import type { CalendarEvent, CalendarEventInput } from "@/types/calendar-event";
import type { RecurringClassPattern, RecurringClassPatternInput } from "@/types/recurring-class-pattern";
import { validateCalendarEvent, validateClassPattern } from "@/lib/calendar/event-rules";
import type { EventRepository } from "@/lib/calendar/event-repository";
import type { RecurringClassRepository } from "@/lib/calendar/recurring-class-repository";
const key = "task-manager.calendar.ui.fixture.v1";
function read(): { events: CalendarEvent[]; classes: RecurringClassPattern[] } {
  if (localStorage.getItem("calendar-fixture-fail") === "true") throw new Error("QA calendar load failure. Retry loading calendar.");
  return JSON.parse(localStorage.getItem(key) ?? '{"events":[],"classes":[]}');
}
function write(data: ReturnType<typeof read>) { localStorage.setItem(key, JSON.stringify(data)); }
function change(kind: "events" | "classes", id: string, fields: object) {
  const data = read(); const row = data[kind].find(item => item.id === id);
  if (!row) throw new Error("Fixture record not found");
  Object.assign(row, fields, { updatedAt: new Date().toISOString() }); write(data);
}
export function calendarFixtureRepositories(): { events: EventRepository; classes: RecurringClassRepository } {
  return {
    events: {
      async list() { return read().events; },
      async create(input: CalendarEventInput) { const data = read(), now = new Date().toISOString(); data.events.push({ ...validateCalendarEvent(input), id: crypto.randomUUID(), archivedAt: null, createdAt: now, updatedAt: now }); write(data); },
      async update(id, input) { change("events", id, validateCalendarEvent(input)); },
      async setArchived(id, archived) { change("events", id, { archivedAt: archived ? new Date().toISOString() : null }); },
    },
    classes: {
      async list() { return read().classes; },
      async create(input: RecurringClassPatternInput) { const data = read(), now = new Date().toISOString(); data.classes.push({ ...validateClassPattern(input), id: crypto.randomUUID(), archivedAt: null, createdAt: now, updatedAt: now }); write(data); },
      async update(id, input) { change("classes", id, validateClassPattern(input)); },
      async setArchived(id, archived) { change("classes", id, { archivedAt: archived ? new Date().toISOString() : null }); },
    },
  };
}
const unavailable = async (): Promise<never> => { throw new Error("Calendar is outside this fixture's scope"); };
export const unusedCalendarRepositories = {
  events: { list: unavailable, create: unavailable, update: unavailable, setArchived: unavailable },
  classes: { list: unavailable, create: unavailable, update: unavailable, setArchived: unavailable },
};
