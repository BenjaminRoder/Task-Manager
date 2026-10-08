import type { CalendarOccurrence } from "../../types/calendar-occurrence.ts";
import type { RecurringClassPattern } from "../../types/recurring-class-pattern.ts";

import { addCalendarDays } from "../tasks/week-rules.ts";
import { isDate } from "../tasks/task-rules.ts";
import { validateClassPattern } from "./event-rules.ts";

export function expandWeeklyClasses(
  patterns: readonly RecurringClassPattern[],
  startDate: string,
  endDate: string,
): Extract<CalendarOccurrence, { kind: "class" }>[] {
  if (!isDate(startDate) || !isDate(endDate) || endDate < startDate)
    throw new Error("Choose a valid visible calendar range.");
  const occurrences = new Map<string, Extract<CalendarOccurrence, { kind: "class" }>>();
  for (const pattern of patterns) {
    if (pattern.archivedAt) continue;
    validateClassPattern(pattern);
    const first = pattern.startDate && pattern.startDate > startDate ? pattern.startDate : startDate;
    const last = pattern.endDate && pattern.endDate < endDate ? pattern.endDate : endDate;
    for (let date = first; date <= last;) {
      const weekday = new Date(date + "T12:00:00Z").getUTCDay();
      if (pattern.weekdays.some(day => day === weekday)) {
        const id = JSON.stringify(["class", pattern.id, date]);
        occurrences.set(id, { id, kind: "class", patternId: pattern.id, title: pattern.title,
          date, startTime: pattern.startTime, endTime: pattern.endTime, courseId: pattern.courseId });
      }
      if (date === last) break;
      date = addCalendarDays(date, 1);
    }
  }
  return [...occurrences.values()].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id));
}
