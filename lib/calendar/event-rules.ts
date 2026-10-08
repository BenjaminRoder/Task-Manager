import type { CalendarEventInput } from "../../types/calendar-event.ts";
import type { RecurringClassPatternInput } from "../../types/recurring-class-pattern.ts";
import { isDate, isTime } from "../tasks/task-rules.ts";

export function validateInterval(startTime: string, endTime: string) {
  if (!isTime(startTime) || !isTime(endTime) || endTime <= startTime)
    throw new Error("Choose minute-precision times with the end later than the start on the same day.");
}
function title(value: string): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 160)
    throw new Error("Enter a title between 1 and 160 characters.");
  return value.trim();
}
function link(value: string | null): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !value.trim() || value.length > 200)
    throw new Error("Choose a valid linked record, or leave it unassigned.");
  return value;
}
export function validateCalendarEvent(input: CalendarEventInput): CalendarEventInput {
  validateInterval(input.startTime, input.endTime);
  if (!isDate(input.date)) throw new Error("Choose a valid event date.");
  return { ...input, title: title(input.title), taskId: link(input.taskId), courseId: link(input.courseId) };
}
export function validateClassPattern(input: RecurringClassPatternInput): RecurringClassPatternInput {
  validateInterval(input.startTime, input.endTime);
  if (!Array.isArray(input.weekdays) || !input.weekdays.length || input.weekdays.length > 7 ||
    input.weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6) ||
    new Set(input.weekdays).size !== input.weekdays.length)
    throw new Error("Choose at least one unique weekday.");
  if ((input.startDate !== null && !isDate(input.startDate)) ||
    (input.endDate !== null && !isDate(input.endDate)) ||
    (input.startDate && input.endDate && input.startDate > input.endDate))
    throw new Error("Choose valid inclusive dates, with the end on or after the start.");
  return { ...input, title: title(input.title), courseId: link(input.courseId),
    weekdays: [...input.weekdays].sort((a, b) => a - b) as RecurringClassPatternInput["weekdays"] };
}
