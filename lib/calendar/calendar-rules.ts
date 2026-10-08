import type { CalendarEvent } from "../../types/calendar-event.ts";
import type { CalendarOccurrence } from "../../types/calendar-occurrence.ts";
import { validateInterval } from "./event-rules.ts";

export function timeMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
export function eventOccurrences(events: readonly CalendarEvent[], start: string, end: string): CalendarOccurrence[] {
  return events.filter(event => !event.archivedAt && event.date >= start && event.date <= end)
    .map(event => ({ id: JSON.stringify(["event", event.id]), kind: "event", eventId: event.id, taskId: event.taskId,
      title: event.title, date: event.date, startTime: event.startTime, endTime: event.endTime, courseId: event.courseId }));
}
export interface DayAvailability { date: string; occupiedMinutes: number; freeMinutes: number; }
export function dailyAvailability(dates: readonly string[], occurrences: readonly CalendarOccurrence[], startTime = "08:00", endTime = "22:00"): DayAvailability[] {
  validateInterval(startTime, endTime);
  const start = timeMinutes(startTime), end = timeMinutes(endTime);
  return dates.map(date => {
    const intervals = occurrences.filter(item => item.date === date).map(item => [
      Math.max(start, timeMinutes(item.startTime)), Math.min(end, timeMinutes(item.endTime)),
    ]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let occupiedMinutes = 0, coveredUntil = start;
    for (const [a, b] of intervals) {
      occupiedMinutes += Math.max(0, b - Math.max(a, coveredUntil));
      coveredUntil = Math.max(coveredUntil, b);
    }
    return { date, occupiedMinutes, freeMinutes: end - start - occupiedMinutes };
  });
}
export function rankAvailability(days: readonly DayAvailability[]): DayAvailability[] {
  return [...days].sort((a, b) => b.freeMinutes - a.freeMinutes || a.date.localeCompare(b.date));
}

export interface PositionedOccurrence { occurrence: CalendarOccurrence; lane: number; lanes: number; top: number; height: number; }
// Display lanes account for a minimum readable 60-minute visual height only.
// The actual interval remains unchanged for labels and availability.
export function positionOccurrences(occurrences: readonly CalendarOccurrence[]): PositionedOccurrence[] {
  const sorted = [...occurrences].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id));
  const output: PositionedOccurrence[] = [];
  let cluster: PositionedOccurrence[] = [], ends: number[] = [], clusterEnd = -1;
  function finish() { for (const item of cluster) item.lanes = ends.length; cluster = []; ends = []; }
  for (const occurrence of sorted) {
    const start = timeMinutes(occurrence.startTime);
    const end = Math.max(timeMinutes(occurrence.endTime), start + 60);
    if (start >= clusterEnd) finish();
    let lane = ends.findIndex(value => value <= start);
    if (lane < 0) lane = ends.length;
    ends[lane] = end;
    clusterEnd = Math.max(...ends);
    const item = { occurrence, lane, lanes: 1, top: start / 1440 * 100, height: (end - start) / 1440 * 100 };
    cluster.push(item); output.push(item);
  }
  finish();
  return output;
}
