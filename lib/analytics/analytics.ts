import type { Task } from "../../types/task.ts";
import type { TimeSession } from "../../types/time-session.ts";
import type { Book, ReadingSession } from "../../types/reading.ts";
import type { Category } from "../../types/category.ts";
import type { Course } from "../../types/course.ts";
import type { CompletionEstimate } from "../../types/analytics.ts";
import { isDate } from "../tasks/task-rules.ts";
import { addCalendarDays, startOfWeek } from "../tasks/week-rules.ts";
import { readingMetrics, readingTimeTotals } from "../reading/reading-rules.ts";

export interface AnalyticsData {
  tasks: readonly Task[]; sessions: readonly TimeSession[];
  books: readonly Book[]; readingSessions: readonly ReadingSession[];
  categories: readonly Category[]; courses: readonly Course[];
  estimates: readonly CompletionEstimate[];
}
export interface Period { start: string; end: string }
export interface Breakdown { id: string; label: string; value: number }
export function analyticsPeriod(date: string, mode: "week" | "month"): Period {
  if (!isDate(date)) throw new Error("Choose a valid calendar date.");
  if (mode === "week") { const start = startOfWeek(date); return { start, end: addCalendarDays(start, 6) }; }
  const start = date.slice(0, 7) + "-01";
  const next = new Date(start + "T12:00:00Z"); next.setUTCMonth(next.getUTCMonth() + 1);
  return { start, end: addCalendarDays(next.toISOString().slice(0, 10), -1) };
}
function inPeriod(date: string, period: Period) { return date >= period.start && date <= period.end; }
function instantKey(timestamp: string): string {
  // PostgreSQL retains microseconds; Date.parse alone could match an earlier
  // completion if a task is reopened/recompleted within the same millisecond.
  const fraction = /\.(\d+)/.exec(timestamp)?.[1] ?? "";
  return `${Date.parse(timestamp)}:${fraction.padEnd(6, "0").slice(3, 6)}`;
}
export function calendarDate(timestamp: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(timestamp));
  return ["year", "month", "day"].map(type => parts.find(p => p.type === type)!.value).join("-");
}
export function eligibleSession(session: TimeSession): boolean {
  return !session.voidedAt && session.endedAt !== null && Number.isFinite(Date.parse(session.startedAt)) &&
    Number.isFinite(Date.parse(session.endedAt)) && Date.parse(session.endedAt) > Date.parse(session.startedAt) &&
    session.durationSeconds !== null && Number.isFinite(session.durationSeconds) && session.durationSeconds > 0;
}
function errorSummary(rows: { actualMinutes: number; estimate: number | null }[]) {
  const samples = rows.filter((row): row is {actualMinutes: number; estimate: number} => row.estimate !== null && row.actualMinutes > 0);
  if (!samples.length) return { count: 0, biasMinutes: null, meanAbsoluteMinutes: null, meanAbsolutePercent: null };
  return { count: samples.length,
    biasMinutes: samples.reduce((sum, row) => sum + row.actualMinutes - row.estimate, 0) / samples.length,
    meanAbsoluteMinutes: samples.reduce((sum, row) => sum + Math.abs(row.actualMinutes - row.estimate), 0) / samples.length,
    meanAbsolutePercent: samples.reduce((sum, row) => sum + 100 * Math.abs(row.actualMinutes - row.estimate) / row.actualMinutes, 0) / samples.length };
}
export function buildAnalytics(data: AnalyticsData, period: Period, today: string, timeZone: string) {
  if (!isDate(period.start) || !isDate(period.end) || period.end < period.start || !isDate(today)) throw new Error("Invalid analytics period.");
  const taskMap = new Map(data.tasks.map(task => [task.id, task]));
  const eligible = data.sessions.filter(eligibleSession);
  // A stopped session belongs to its local START date, including overnight work.
  // This preserves its recorded duration without manufacturing split sessions.
  const timed = eligible.map(session => ({ session, date: calendarDate(session.startedAt, timeZone) }));
  const reading = data.readingSessions.filter(s => !s.voidedAt && isDate(s.date) && s.date <= today && s.endPage > s.startPage);
  function timeFor(range: Period) {
    const timerSeconds = timed.filter(s => s.date <= today && inPeriod(s.date, range)).reduce((sum, row) => sum + row.session.durationSeconds!, 0);
    const totals = readingTimeTotals(reading.filter(s => inPeriod(s.date, range)));
    return { timerSeconds, readingSeconds: totals.readingMinutes * 60,
      overlappingSeconds: totals.overlappingMinutes * 60, focusedSeconds: timerSeconds + totals.readingMinutes * 60 };
  }
  const byCategory = new Map<string, number>(), byCourse = new Map<string, number>(), byDay = new Map<string, number>();
  let studySeconds = 0, nonStudySeconds = 0;
  for (let date = period.start; date <= period.end; date = addCalendarDays(date, 1)) byDay.set(date, 0);
  const add = (map: Map<string, number>, key: string, value: number) => map.set(key, (map.get(key) ?? 0) + value);
  for (const {session, date} of timed) {
    if (date > today || !inPeriod(date, period)) continue;
    const task = taskMap.get(session.taskId);
    // Current course relationships classify historical task timers too.
    // Course metadata/archive state and separate reading logs play no role.
    if (task?.courseId != null) studySeconds += session.durationSeconds!;
    else nonStudySeconds += session.durationSeconds!;
    add(byCategory, task?.categoryId ?? "", session.durationSeconds!);
    add(byCourse, task?.courseId ?? "", session.durationSeconds!);
    add(byDay, date, session.durationSeconds!);
  }
  const pagesByWeek = new Map<string, number>();
  for (let date = startOfWeek(period.start); date <= period.end; date = addCalendarDays(date, 7)) pagesByWeek.set(date, 0);
  for (const session of reading.filter(s => inPeriod(s.date, period))) {
    add(pagesByWeek, startOfWeek(session.date), session.endPage - session.startPage);
    if (session.timeSource === "reading") add(byDay, session.date, (session.minutes ?? 0) * 60);
  }
  const actuals = new Map<string, number>();
  for (const session of eligible) add(actuals, session.taskId, session.durationSeconds! / 60);
  const comparisons = data.tasks.filter(task => task.status === "completed" && task.completedAt && Number.isFinite(Date.parse(task.completedAt)) &&
    calendarDate(task.completedAt, timeZone) <= today && inPeriod(calendarDate(task.completedAt, timeZone), period))
    .map(task => {
      const snapshot = data.estimates.find(row => row.taskId === task.id && instantKey(row.completedAt) === instantKey(task.completedAt!));
      return { taskId: task.id, title: task.title, actualMinutes: actuals.get(task.id) ?? 0, snapshot: snapshot ?? null };
    });
  const observed = comparisons.filter(row => row.actualMinutes > 0);
  const breakdown = (map: Map<string, number>, labels: readonly {id: string; name: string}[], missing: string): Breakdown[] =>
    [...map].map(([id, value]) => ({id, value, label: labels.find(row => row.id === id)?.name ?? (id ? "Retained classification" : missing)}))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  return { ...timeFor(period), week: timeFor(analyticsPeriod(today, "week")), month: timeFor(analyticsPeriod(today, "month")),
    studySeconds, nonStudySeconds,
    completedCount: comparisons.length, timedCompletedCount: observed.length,
    averageTaskMinutes: observed.length ? observed.reduce((sum, row) => sum + row.actualMinutes, 0) / observed.length : null,
    byCategory: breakdown(byCategory, data.categories, "No category"), byCourse: breakdown(byCourse, data.courses, "No course"),
    byDay: [...byDay].map(([id, value]) => ({ id, label: id, value })),
    pagesByWeek: [...pagesByWeek].map(([id, value]) => ({ id, label: id, value })), comparisons,
    estimateError: errorSummary(comparisons.map(row => ({actualMinutes: row.actualMinutes, estimate: row.snapshot?.effectiveMinutes ?? null}))),
    predictionError: errorSummary(comparisons.map(row => ({actualMinutes: row.actualMinutes, estimate: row.snapshot?.predictedMinutes ?? null}))),
    readingProgress: data.books.map(book => ({book, ...readingMetrics(book, data.readingSessions, today)})),
  };
}
