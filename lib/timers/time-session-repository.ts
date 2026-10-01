import type {
  TimeSession,
  SessionCorrection,
} from "../../types/time-session.ts";
export interface TimeSessionRepository {
  list(): Promise<TimeSession[]>;
  serverTime(): Promise<number>;
  taskTitle(taskId: string): Promise<string>;
  start(
    taskId: string,
    requestId: string,
    expectedActive: string | null,
  ): Promise<void>;
  stop(sessionId: string): Promise<void>;
  update(session: TimeSession, correction: SessionCorrection): Promise<void>;
  remove(session: TimeSession): Promise<void>;
}
