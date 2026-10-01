import type {
  TimeSession,
  SessionCorrection,
} from "../../types/time-session.ts";
export function elapsedSeconds(session: TimeSession, now: number): number {
  if (session.voidedAt) return 0;
  return session.endedAt === null
    ? Math.max(0, (now - Date.parse(session.startedAt)) / 1000)
    : (session.durationSeconds ??
        Math.max(
          0,
          (Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 1000,
        ));
}
export function totalSeconds(
  sessions: TimeSession[],
  taskId: string,
  now: number,
) {
  return sessions.reduce(
    (total, session) =>
      total + (session.taskId === taskId ? elapsedSeconds(session, now) : 0),
    0,
  );
}
export function timerClock(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return [Math.floor(value / 3600), Math.floor(value / 60) % 60, value % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}
export function formatActual(seconds: number) {
  const value = Math.floor(Math.max(0, seconds));
  if (value < 60) return `${value} sec`;
  if (value < 3600) return `${Math.floor(value / 60)} min`;
  return `${Math.floor(value / 3600)}h ${String(Math.floor(value / 60) % 60).padStart(2, "0")}m`;
}
export function validateCorrection(
  value: SessionCorrection,
  now = Date.now(),
): SessionCorrection {
  const start = Date.parse(value.startedAt),
    end = Date.parse(value.endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    throw new Error("End time must be after start time.");
  if (start > now || end > now)
    throw new Error("Recorded times cannot be in the future.");
  return {
    startedAt: new Date(start).toISOString(),
    endedAt: new Date(end).toISOString(),
  };
}
export function localDateTime(timestamp: string) {
  const date = new Date(timestamp);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 23);
}
