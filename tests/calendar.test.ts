import test from "node:test";
import assert from "node:assert/strict";
import { validateCalendarEvent, validateClassPattern } from "../lib/calendar/event-rules.ts";
import { expandWeeklyClasses } from "../lib/calendar/weekly-recurrence.ts";
import { dailyAvailability, eventOccurrences, positionOccurrences, rankAvailability } from "../lib/calendar/calendar-rules.ts";
import type { RecurringClassPattern } from "../types/recurring-class-pattern.ts";
import type { CalendarEvent } from "../types/calendar-event.ts";
import type { CalendarOccurrence } from "../types/calendar-occurrence.ts";

const pattern: RecurringClassPattern = { id: "series", title: "QA class", courseId: null, weekdays: [1, 3], startTime: "09:00", endTime: "10:00", startDate: null, endDate: null, archivedAt: null, createdAt: "", updatedAt: "" };
const event: CalendarEvent = { id: "event", title: "QA event", date: "2026-10-05", startTime: "09:00", endTime: "10:00", taskId: null, courseId: null, archivedAt: null, createdAt: "", updatedAt: "" };

test("calendar validation rejects invalid dates/times/weekday sets and normalizes valid titles", () => {
  assert.equal(validateCalendarEvent({ ...event, title: " QA event " }).title, "QA event");
  for (const date of ["2026-02-30", "infinity", "2026-1-01"]) assert.throws(() => validateCalendarEvent({ ...event, date }));
  for (const endTime of ["09:00", "08:00", "24:00", "10:00:01", "10:00:00", "bad"]) assert.throws(() => validateCalendarEvent({ ...event, endTime }));
  for (const weekdays of [[], [1, 1], [7], [-1], [1.5], [null]]) assert.throws(() => validateClassPattern({ ...pattern, weekdays: weekdays as unknown as RecurringClassPattern["weekdays"] }));
  assert.throws(() => validateClassPattern({ ...pattern, startDate: "2026-10-10", endDate: "2026-10-09" }));
  assert.throws(() => validateClassPattern({ ...pattern, endDate: "infinity" }));
  assert.deepEqual(validateClassPattern({ ...pattern, weekdays: [3, 1] }).weekdays, [1, 3]);
});

test("weekly expansion handles weekdays, inclusive/open bounds, year and DST boundaries with stable derived IDs", () => {
  const rows = expandWeeklyClasses([pattern], "2026-10-05", "2026-10-11");
  assert.deepEqual(rows.map(row => row.date), ["2026-10-05", "2026-10-07"]);
  assert.deepEqual(expandWeeklyClasses([pattern, pattern], "2026-10-05", "2026-10-11"), rows);
  assert.deepEqual(expandWeeklyClasses([{ ...pattern, startDate: "2026-10-07", endDate: "2026-10-07" }], "2026-10-05", "2026-10-11").map(row => row.date), ["2026-10-07"]);
  assert.equal(expandWeeklyClasses([{ ...pattern, startDate: "2026-10-12" }], "2026-10-05", "2026-10-11").length, 0);
  assert.equal(expandWeeklyClasses([{ ...pattern, endDate: "2026-10-04" }], "2026-10-05", "2026-10-11").length, 0);
  assert.equal(expandWeeklyClasses([{ ...pattern, archivedAt: "2026-10-01" }], "2026-10-05", "2026-10-11").length, 0);
  assert.deepEqual(expandWeeklyClasses([{ ...pattern, weekdays: [0, 3, 4] }], "2025-12-29", "2026-01-04").map(row => row.date), ["2025-12-31", "2026-01-01", "2026-01-04"]);
  for (const [start, end, sunday] of [["2026-03-02", "2026-03-08", "2026-03-08"], ["2026-10-26", "2026-11-01", "2026-11-01"]]) {
    const expanded = expandWeeklyClasses([{ ...pattern, weekdays: [0] }], start, end);
    assert.equal(expanded[0].date, sunday); assert.equal(expanded[0].startTime, "09:00");
  }
  assert.equal(expandWeeklyClasses([{ ...pattern, weekdays: [4] }], "2024-02-26", "2024-03-03")[0].date, "2024-02-29");
  assert.throws(() => expandWeeklyClasses([{ ...pattern, weekdays: [1, 1] }], "2026-10-05", "2026-10-11"));
  assert.equal(pattern.startDate, null); // No mutation of persisted patterns.
  assert.equal(expandWeeklyClasses([{ ...pattern, weekdays: [5] }], "9999-12-31", "9999-12-31")[0].date, "9999-12-31");
});

test("availability unions event/class overlaps, clips the window, and ranks equal days deterministically", () => {
  const occurrences = [...eventOccurrences([{ ...event, startTime: "07:00", endTime: "09:30" }, { ...event, id: "outside", startTime: "22:30", endTime: "23:30" }], "2026-10-05", "2026-10-11"), ...expandWeeklyClasses([pattern], "2026-10-05", "2026-10-11")];
  const days = dailyAvailability(["2026-10-05", "2026-10-06", "2026-10-07"], occurrences);
  assert.deepEqual(days.map(day => day.freeMinutes), [720, 840, 780]);
  assert.deepEqual(rankAvailability(days).map(day => day.date), ["2026-10-06", "2026-10-07", "2026-10-05"]);
  assert.equal(dailyAvailability(["2026-10-05"], occurrences, "09:15", "09:45")[0].freeMinutes, 0);
  assert.equal(dailyAvailability(["2026-10-05"], occurrences, "10:00", "11:00")[0].freeMinutes, 60);
  assert.deepEqual(rankAvailability(dailyAvailability(["2026-10-07", "2026-10-06"], [])).map(day => day.date), ["2026-10-06", "2026-10-07"]);
  assert.equal(eventOccurrences([{ ...event, archivedAt: "2026-10-01" }], "2026-10-05", "2026-10-11").length, 0);
  assert.throws(() => dailyAvailability([], [], "22:00", "08:00"));
});

test("overlap layout gives each simultaneous block a visible lane and reuses lanes after a cluster", () => {
  const block = (id: string, startTime: string, endTime: string): CalendarOccurrence => ({ id, kind: "event", eventId: id, title: id, date: event.date, taskId: null, courseId: null, startTime, endTime });
  const items = positionOccurrences([block("a", "09:00", "10:00"), block("b", "09:30", "10:30"), block("c", "11:00", "11:01")]);
  assert.deepEqual(items.map(row => [row.lane, row.lanes]), [[0, 2], [1, 2], [0, 1]]);
  assert.ok(items[2].height > 0); assert.equal(items[2].occurrence.endTime, "11:01");
});
