"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { TimeSession, SessionCorrection } from "@/types/time-session";
import type { TimeSessionRepository } from "./time-session-repository";
interface TimerState {
  sessions: TimeSession[];
  active: TimeSession | null;
  activeTitle: string;
  now: number;
  ready: boolean;
  busy: boolean;
  error: string;
  refresh(): Promise<void>;
  start(taskId: string): Promise<boolean>;
  stop(sessionId: string): Promise<boolean>;
  correct(
    session: TimeSession,
    correction: SessionCorrection,
  ): Promise<boolean>;
  remove(session: TimeSession): Promise<boolean>;
}
const TimerContext = createContext<TimerState | null>(null);
export function useTimer() {
  const value = useContext(TimerContext);
  if (!value) throw new Error("Timing requires an authenticated workspace.");
  return value;
}
export function TimerProvider({
  repository,
  children,
}: {
  repository: TimeSessionRepository;
  children: ReactNode;
}) {
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [activeTitle, setActiveTitle] = useState("");
  const [now, setNow] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false),
    generation = useRef(0),
    mounted = useRef(false);
  const clock = useRef({ server: 0, local: 0 });
  const pendingStart = useRef<{ taskId: string; id: string } | null>(null);
  const load = useCallback(async () => {
    const version = ++generation.current;
    const readClock = async () => {
      const began = performance.now();
      const server = await repository.serverTime();
      return { server, local: (began + performance.now()) / 2 };
    };
    const [rows, sample] = await Promise.all([repository.list(), readClock()]);
    const running = rows.find((row) => !row.endedAt && !row.voidedAt);
    const title = running ? await repository.taskTitle(running.taskId) : "";
    if (!mounted.current || version !== generation.current) return;
    clock.current = sample;
    setSessions(rows);
    setActiveTitle(title);
    setNow(sample.server + performance.now() - sample.local);
    setReady(true);
  }, [repository]);
  const refresh = useCallback(async () => {
    if (saving.current) return;
    const version = generation.current + 1;
    try {
      await load();
      if (mounted.current && version === generation.current) setError("");
    } catch (problem) {
      if (mounted.current && version === generation.current) {
        setReady(false);
        setError(
          problem instanceof Error
            ? problem.message
            : "Timing data could not load. A saved timer may still be running.",
        );
      }
    }
  }, [load]);
  useEffect(() => {
    mounted.current = true;
    const requests = generation;
    const version = generation.current + 1;
    load().catch((problem) => {
      if (mounted.current && version === generation.current) {
        setReady(false);
        setError(
          problem instanceof Error
            ? problem.message
            : "Timing data could not load.",
        );
      }
    });
    const display = window.setInterval(() => {
      if (clock.current.server)
        setNow(clock.current.server + performance.now() - clock.current.local);
    }, 1000);
    const poll = window.setInterval(() => void refresh(), 30000);
    const update = () => void refresh();
    window.addEventListener("focus", update);
    window.addEventListener("tasks-changed", update);
    return () => {
      mounted.current = false;
      ++requests.current;
      clearInterval(display);
      clearInterval(poll);
      window.removeEventListener("focus", update);
      window.removeEventListener("tasks-changed", update);
    };
  }, [refresh, load]);
  async function mutate(action: () => Promise<void>) {
    if (saving.current || !ready) return false;
    saving.current = true;
    ++generation.current;
    setBusy(true);
    setError("");
    try {
      await action();
      try {
        await load();
      } catch {
        if (mounted.current) {
          setReady(false);
          setError(
            "Timer change saved, but the updated history could not load. Refresh timing data.",
          );
        }
      }
      return true;
    } catch (problem) {
      if (mounted.current) {
        setReady(false);
        setError(
          problem instanceof Error
            ? problem.message
            : "Timer change failed. Refresh timing data before retrying.",
        );
      }
      return false;
    } finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <TimerContext.Provider
      value={{
        sessions,
        active: sessions.find((row) => !row.endedAt && !row.voidedAt) ?? null,
        activeTitle,
        now,
        ready,
        busy,
        error,
        refresh,
        start: (taskId) =>
          mutate(async () => {
            const rows = await repository.list();
            const active = rows.find((row) => !row.endedAt && !row.voidedAt);
            if (active?.taskId === taskId) return;
            if (active) {
              const title = await repository.taskTitle(active.taskId);
              if (
                !window.confirm(
                  `${title} is currently running. Stop it and start this task?`,
                )
              )
                return;
            }
            // Keep the request ID after an uncertain network result; retry never creates
            // another session. Clear it only after a confirmed RPC response.
            if (pendingStart.current?.taskId !== taskId)
              pendingStart.current = { taskId, id: crypto.randomUUID() };
            await repository.start(
              taskId,
              pendingStart.current.id,
              active?.id ?? null,
            );
            pendingStart.current = null;
          }),
        stop: (id) => mutate(() => repository.stop(id)),
        correct: (session, correction) =>
          mutate(() => repository.update(session, correction)),
        remove: (session) => mutate(() => repository.remove(session)),
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}
