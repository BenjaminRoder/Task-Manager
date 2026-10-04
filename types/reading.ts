export const bookStatuses = ["want_to_read", "reading", "paused", "completed"] as const;
export type BookStatus = (typeof bookStatuses)[number];
export interface BookInput {
  title: string; author: string | null; totalPages: number; currentPage: number;
  status: BookStatus; startedDate: string | null; completedDate: string | null; weeklyPageGoal: number | null;
}
export interface Book extends BookInput { id: string; archivedAt: string | null; createdAt: string; updatedAt: string }
export interface ReadingSessionInput {
  bookId: string; date: string; startPage: number; endPage: number; minutes: number | null;
  // Overlapping minutes are descriptive only, excluded from additive reading time.
  timeSource: "reading" | "task_timer";
}
export interface ReadingSession extends ReadingSessionInput {
  id: string; pagesRead: number; voidedAt: string | null; createdAt: string; updatedAt: string;
}
