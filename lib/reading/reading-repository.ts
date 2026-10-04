import type { Book, BookInput, ReadingSession, ReadingSessionInput } from "../../types/reading.ts";
export interface ReadingRepository {
  listBooks(): Promise<Book[]>;
  listSessions(): Promise<ReadingSession[]>;
  createBook(input: BookInput): Promise<void>;
  updateBook(book: Book, input: BookInput): Promise<void>;
  setArchived(book: Book, archived: boolean): Promise<void>;
  logSession(input: ReadingSessionInput, requestId: string): Promise<void>;
  correctSession(session: ReadingSession, input: ReadingSessionInput): Promise<void>;
  removeSession(session: ReadingSession): Promise<void>;
}
