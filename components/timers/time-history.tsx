"use client";
import { useState, type FormEvent } from "react";
import { useTimer } from "@/lib/timers/timer-provider";
import {
  elapsedSeconds,
  localDateTime,
  timerClock,
  validateCorrection,
} from "@/lib/timers/timer-rules";
import type { TimeSession } from "@/types/time-session";
function SessionEntry({ session }: { session: TimeSession }) {
  const timer = useTimer();
  const [editing, setEditing] = useState(false),
    [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const start = String(data.get("start")),
        end = String(data.get("end"));
      const correction = validateCorrection(
        {
          startedAt:
            start === localDateTime(session.startedAt)
              ? session.startedAt
              : new Date(start).toISOString(),
          endedAt:
            end === localDateTime(session.endedAt!)
              ? session.endedAt!
              : new Date(end).toISOString(),
        },
        timer.now,
      );
      if (await timer.correct(session, correction)) {
        setEditing(false);
        setError("");
      }
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Check the recorded times.",
      );
    }
  }
  return (
    <li className="session-entry">
      <div>
        <time dateTime={session.startedAt}>
          {new Date(session.startedAt).toLocaleString()}
        </time>{" "}
        –{" "}
        {session.endedAt ? (
          <time dateTime={session.endedAt}>
            {new Date(session.endedAt).toLocaleString()}
          </time>
        ) : (
          "Running"
        )}
        <strong> · {timerClock(elapsedSeconds(session, timer.now))}</strong>
      </div>
      {session.endedAt ? (
        <div className="timer-controls">
          <button
            className="secondary-button"
            disabled={timer.busy || !timer.ready}
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Cancel correction" : "Correct times"}
          </button>
          <button
            className="secondary-button"
            disabled={timer.busy || !timer.ready}
            onClick={() => {
              if (
                window.confirm(
                  "Remove this erroneous session from actual time? The record will be retained for recovery.",
                )
              )
                void timer.remove(session);
            }}
          >
            Remove session
          </button>
        </div>
      ) : (
        <p>Stop the timer before correcting this session.</p>
      )}
      {editing && (
        <form className="session-correction" onSubmit={save}>
          <label>
            Start (local time)
            <input
              name="start"
              type="datetime-local"
              step="0.001"
              defaultValue={localDateTime(session.startedAt)}
              required
            />
          </label>
          <label>
            End (local time)
            <input
              name="end"
              type="datetime-local"
              step="0.001"
              defaultValue={localDateTime(session.endedAt!)}
              required
            />
          </label>
          <button
            className="primary-button"
            disabled={timer.busy || !timer.ready}
          >
            Save correction
          </button>
          <p>
            Times use your device timezone. Check dates for sessions crossing
            midnight.
          </p>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </li>
  );
}
export function TimeHistory({ taskId }: { taskId: string }) {
  const timer = useTimer();
  const sessions = timer.sessions
    .filter((session) => session.taskId === taskId && !session.voidedAt)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return (
    <section className="time-history" aria-label="Task time history">
      <h3>Time history</h3>
      {sessions.length ? (
        <ul>
          {sessions.map((session) => (
            <SessionEntry
              key={`${session.id}-${session.updatedAt}`}
              session={session}
            />
          ))}
        </ul>
      ) : (
        <p>No recorded sessions yet.</p>
      )}
      <p>
        Removing a session excludes it from actual time; completed and deleted
        tasks retain their timing records.
      </p>
    </section>
  );
}
