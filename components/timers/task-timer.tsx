"use client";
import Link from "next/link";
import { useState } from "react";
import { useTimer } from "@/lib/timers/timer-provider";
import {
  elapsedSeconds,
  timerClock,
  totalSeconds,
  formatActual,
} from "@/lib/timers/timer-rules";
import type { Task } from "@/types/task";
import { TimeHistory } from "./time-history";
export function ActualTime({ taskId }: { taskId: string }) {
  const timer = useTimer();
  return (
    <span className="actual-time">
      Actual:{" "}
      {timer.ready
        ? formatActual(totalSeconds(timer.sessions, taskId, timer.now))
        : "unavailable"}
      {timer.active?.taskId === taskId ? " · running" : ""}
    </span>
  );
}
export function TaskTimer({
  task,
  disabled = false,
}: {
  task: Task;
  disabled?: boolean;
}) {
  const timer = useTimer();
  const [history, setHistory] = useState(false);
  const active = timer.active?.taskId === task.id ? timer.active : null;
  return (
    <div className="task-timing">
      <div className="timer-controls">
        <ActualTime taskId={task.id} />
        {active ? (
          <>
            <span className="timer-clock">
              {timerClock(elapsedSeconds(active, timer.now))}
            </span>
            <button
              type="button"
              className="secondary-button"
              disabled={disabled || timer.busy || !timer.ready}
              onClick={() => void timer.stop(active.id)}
            >
              Stop timer
            </button>
          </>
        ) : task.status === "incomplete" && !task.deletedAt ? (
          <button
            type="button"
            className="secondary-button"
            disabled={disabled || timer.busy || !timer.ready}
            onClick={() => void timer.start(task.id)}
            aria-label={`Start timer for ${task.title}`}
          >
            Start timer
          </button>
        ) : null}
        <button
          type="button"
          className="secondary-button"
          aria-expanded={history}
          onClick={() => setHistory(!history)}
        >
          Time history
        </button>
      </div>
      {history && <TimeHistory taskId={task.id} />}
    </div>
  );
}
export function ActiveTimerBar() {
  const timer = useTimer();
  const [history, setHistory] = useState(false);
  return (
    <section className="active-timer-area" aria-label="Task timer">
      {timer.error && (
        <div className="error-banner" role="alert">
          <p>{timer.error} A saved timer continues until stopped.</p>
          <button
            className="secondary-button"
            disabled={timer.busy}
            onClick={() => void timer.refresh()}
          >
            Refresh timing data
          </button>
        </div>
      )}
      {!timer.ready && !timer.error && (
        <p role="status">Loading timing history…</p>
      )}
      {timer.active && (
        <div className="active-timer-bar">
          <span>
            Currently timing: <strong>{timer.activeTitle || "Task"}</strong>
          </span>
          <span className="timer-clock" aria-label="Elapsed time">
            {timerClock(elapsedSeconds(timer.active, timer.now))}
          </span>
          <button
            className="secondary-button"
            disabled={timer.busy || !timer.ready}
            onClick={() => void timer.stop(timer.active!.id)}
          >
            Stop timer
          </button>
          <button
            className="secondary-button"
            onClick={() => setHistory(!history)}
            aria-expanded={history}
          >
            Inspect time
          </button>
          <Link href={`/tasks#task-${encodeURIComponent(timer.active.taskId)}`}>
            View task
          </Link>
        </div>
      )}
      {history && timer.active && (
        <TimeHistory key={timer.active.taskId} taskId={timer.active.taskId} />
      )}
    </section>
  );
}
