import type { CalendarOccurrence } from "../../types/calendar-occurrence.ts";
import type { RecurringClassPattern } from "../../types/recurring-class-pattern.ts";

// Type-only pure expansion contract; no implementation or stored occurrences.
// Future logic intersects inclusive local-date bounds, skips archived patterns,
// and uses calendar-day arithmetic. No exceptions or per-occurrence overrides.
export type ExpandWeeklyClasses = (
  patterns: readonly RecurringClassPattern[],
  startDate: string,
  endDate: string,
) => readonly Extract<CalendarOccurrence, { kind: "class" }>[];
