import type { CalendarEventInput } from "../../types/calendar-event.ts";

// Type-only module shell. Validation and normalization are not implemented.
export type ValidateCalendarEvent = (input: CalendarEventInput) => CalendarEventInput;
