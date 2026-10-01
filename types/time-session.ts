export interface TimeSession {
  id: string;
  userId: string;
  taskId: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface SessionCorrection {
  startedAt: string;
  endedAt: string;
}
