import { bookStatuses, type Book, type BookInput, type ReadingSession, type ReadingSessionInput } from "../../types/reading.ts";
import { isDate } from "../tasks/task-rules.ts";
import { addCalendarDays, startOfWeek } from "../tasks/week-rules.ts";
function integer(value: number, min: number, max: number, label: string) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(label + " must be a whole number between " + min + " and " + max + ".");
}
export function validateBook(input: BookInput): BookInput {
  const title = input.title.trim(); const author = input.author?.trim() || null;
  if (!title || title.length > 160) throw new Error("Enter a book title between 1 and 160 characters.");
  if (author && author.length > 120) throw new Error("Author must be at most 120 characters.");
  integer(input.totalPages,1,100000,"Total pages"); integer(input.currentPage,0,input.totalPages,"Current page");
  if (input.weeklyPageGoal !== null) integer(input.weeklyPageGoal,1,100000,"Weekly page goal");
  if (!bookStatuses.includes(input.status)) throw new Error("Choose a valid book status.");
  for (const date of [input.startedDate,input.completedDate]) if (date !== null && !isDate(date)) throw new Error("Choose valid reading dates.");
  if (input.status !== "want_to_read" && !input.startedDate) throw new Error("Set a started date for this book.");
  if ((input.status === "completed") !== (input.completedDate !== null)) throw new Error("Only completed books need a completed date.");
  if (input.status === "completed" && input.currentPage !== input.totalPages) throw new Error("A completed book must be at its final page.");
  if (input.completedDate && input.startedDate && input.completedDate < input.startedDate) throw new Error("Completion cannot precede the started date.");
  return { ...input, title, author };
}
export function validateReadingSession(input: ReadingSessionInput): ReadingSessionInput {
  if (typeof input.bookId !== "string" || !input.bookId.trim() || input.bookId.length > 200) throw new Error("Choose a valid book.");
  if (!isDate(input.date)) throw new Error("Choose a valid reading date.");
  integer(input.startPage,0,99999,"Starting page"); integer(input.endPage,input.startPage+1,100000,"Ending page");
  if (input.minutes !== null) integer(input.minutes,1,1440,"Reading minutes");
  if (!["reading","task_timer"].includes(input.timeSource)) throw new Error("Choose how reading time was recorded.");
  return { ...input };
}
export function readingMetrics(book: Book, sessions: readonly ReadingSession[], today: string) {
  if (!isDate(today)) throw new Error("Invalid current calendar date");
  const rows = sessions.filter(s=>s.bookId === book.id && !s.voidedAt && isDate(s.date) && s.date <= today && s.endPage > s.startPage);
  const weekStart = startOfWeek(today), weekEnd = addCalendarDays(weekStart,6);
  const pages = (items: readonly ReadingSession[]) => items.reduce((sum,s)=>sum+s.endPage-s.startPage,0);
  const pagesToday=pages(rows.filter(s=>s.date===today));
  const pagesThisWeek=pages(rows.filter(s=>s.date>=weekStart && s.date<=weekEnd));
  // Recent 28 calendar days; include nonreading days to avoid an optimistic projection.
  const recent=rows.filter(s=>s.date>=addCalendarDays(today,-27));
  const readingDays=new Set(recent.map(s=>s.date));
  const earliest=[...readingDays].sort()[0];
  const calendarDays=earliest ? Math.round((Date.parse(today+"T12:00:00Z")-Date.parse(earliest+"T12:00:00Z"))/86400000)+1 : 0;
  const pace=calendarDays ? pages(recent)/calendarDays : null;
  const remainingPages=book.totalPages-book.currentPage;
  const projectionDays=pace && readingDays.size>=3 && calendarDays>=7 ? Math.ceil(remainingPages/pace) : null;
  const projectedFinish=book.status === "reading" && !book.archivedAt && remainingPages>0 && projectionDays !== null && projectionDays<=36500 ? addCalendarDays(today,projectionDays) : null;
  return { percentComplete:100*book.currentPage/book.totalPages, pagesToday, pagesThisWeek, remainingPages,
    goalRemaining:book.weeklyPageGoal===null ? null : Math.max(0,book.weeklyPageGoal-pagesThisWeek),
    goalPercent:book.weeklyPageGoal===null ? null : 100*pagesThisWeek/book.weeklyPageGoal,
    averagePagesPerDay:pace, readingDays:readingDays.size, projectedFinish };
}
export function completedBooksThisYear(books: readonly Book[], today: string): number {
  if (!isDate(today)) throw new Error("Invalid current calendar date");
  return books.filter(b=>b.status === "completed" && b.completedDate && isDate(b.completedDate) && b.completedDate.slice(0,4)===today.slice(0,4) && b.completedDate<=today).length;
}
export function readingTimeTotals(sessions: readonly ReadingSession[]) {
  let readingMinutes=0, overlappingMinutes=0;
  for (const session of sessions) if (!session.voidedAt && session.minutes !== null) {
    if (session.timeSource === "reading") readingMinutes+=session.minutes;
    else overlappingMinutes+=session.minutes;
  }
  return { readingMinutes, overlappingMinutes };
}
