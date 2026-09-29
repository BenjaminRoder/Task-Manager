"use client";

import { useRef, useState } from "react";
import type { SortMode, Task } from "@/types/task";
import { useTasks } from "@/lib/tasks/use-tasks";
import {
  formatDuration,
  remainingMinutes,
  sortTasks,
  tasksForToday,
} from "@/lib/tasks/task-rules";
import { TaskForm } from "./task-form";
import { TaskRow } from "./task-row";

const sortDescriptions: Record<SortMode, string> = {
  momentum: "Shortest tasks first. Your priorities stay the same.",
  priority: "Your highest priorities first. Estimates stay the same.",
  deadline: "Nearest deadlines first. Tasks without a deadline come last.",
};

export function TaskBoard({ view }: { view: "today" | "all" }) {
  const { tasks, ready, busy, error, today, refresh, mutate } = useTasks();
  const [sort, setSort] = useState<SortMode>("momentum");
  const [editing, setEditing] = useState<Task | null>(null);
  const [notice, setNotice] = useState("");
  const formContainer = useRef<HTMLDivElement>(null);
  const visible =
    view === "today" && today ? tasksForToday(tasks, today) : tasks;
  const incomplete = sortTasks(
    visible.filter((task) => task.status === "incomplete"),
    sort,
  );
  const completed = visible.filter((task) => task.status === "completed");
  const categories = [...new Set(tasks.map((task) => task.category))].sort();

  function edit(task: Task) {
    setEditing(task);
    formContainer.current?.scrollIntoView({ block: "center" });
    window.requestAnimationFrame(() =>
      formContainer.current?.querySelector("input")?.focus(),
    );
  }

  function row(task: Task) {
    return (
      <TaskRow
        key={task.id}
        task={task}
        today={today!}
        busy={busy || !ready}
        onEdit={() => edit(task)}
        onToggle={async () => {
          if (
            await mutate((repository) =>
              repository.setStatus(
                task.id,
                task.status === "completed" ? "incomplete" : "completed",
              ),
            )
          ) {
            setNotice(
              task.status === "completed"
                ? "Task reopened."
                : "Task completed. Nice work.",
            );
            if (editing?.id === task.id) setEditing(null);
          }
        }}
        onDelete={async () => {
          const saved = await mutate((repository) =>
            repository.remove(task.id),
          );
          if (saved) {
            setNotice("Task removed.");
            if (editing?.id === task.id) setEditing(null);
          }
          return saved;
        }}
      />
    );
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <h1>{view === "today" ? "Today" : "Tasks"}</h1>
          <p>
            {view === "today"
              ? "A little focus. A little progress."
              : "Everything on your list, in one place."}
          </p>
        </div>
        {today ? (
          <time dateTime={today}>
            {new Date(`${today}T12:00:00`).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </time>
        ) : null}
      </header>
      {error ? (
        <div role="alert" className="error-banner">
          <p>{error}</p>
          <button
            className="secondary-button"
            onClick={() => void refresh()}
            disabled={busy}
          >
            Retry loading tasks
          </button>
        </div>
      ) : null}
      {!ready && !error ? (
        <p className="loading-state" role="status">
          Loading your tasks…
        </p>
      ) : null}
      {ready && today ? (
        <>
          <div className="workload">
            <span>
              {incomplete.length} {incomplete.length === 1 ? "task" : "tasks"}{" "}
              remaining
            </span>
            <strong>
              {formatDuration(remainingMinutes(incomplete))} planned
            </strong>
          </div>
          <div ref={formContainer}>
            <TaskForm
              key={editing?.id ?? `new-${today}`}
              task={editing ?? undefined}
              today={today}
              categories={categories}
              disabled={busy}
              onCancel={editing ? () => setEditing(null) : undefined}
              onSave={async (input) => {
                const saved = await mutate((repository) =>
                  editing
                    ? repository.update(editing.id, input)
                    : repository.create(input),
                );
                if (saved) {
                  setNotice(
                    input.scheduledDate > today &&
                      (!input.dueDate || input.dueDate > today) &&
                      view === "today"
                      ? "Task saved for a future day. You can find it in Tasks."
                      : editing
                        ? "Changes saved."
                        : "Task added.",
                  );
                  setEditing(null);
                }
                return saved;
              }}
            />
          </div>
          <div className="notice" role="status" aria-live="polite">
            {busy ? "Saving…" : notice}
          </div>
          <section aria-labelledby="tasks-heading">
            <div className="list-toolbar">
              <h2 id="tasks-heading">
                {view === "today" ? "Your tasks" : "All tasks"}
              </h2>
              <label className="sort-control">
                Sort
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortMode)}
                  aria-describedby="sort-description"
                >
                  <option value="momentum">Momentum</option>
                  <option value="priority">Priority</option>
                  <option value="deadline">Deadline</option>
                </select>
              </label>
            </div>
            <p className="sort-description" id="sort-description">
              {sortDescriptions[sort]}
            </p>
            {incomplete.length ? (
              <div className="task-list">{incomplete.map(row)}</div>
            ) : (
              <div className="empty-state">
                <h3>
                  {completed.length
                    ? "A little room to breathe."
                    : "Start with one small task."}
                </h3>
                <p>
                  {completed.length
                    ? "You've finished everything on this list."
                    : "Add something above to make room for what matters."}
                </p>
              </div>
            )}
          </section>
          {completed.length ? (
            <section
              className="completed-section"
              aria-labelledby="completed-heading"
            >
              <h2 id="completed-heading">
                Completed{view === "today" ? " today" : ""}{" "}
                <span>{completed.length}</span>
              </h2>
              <div className="task-list">{completed.map(row)}</div>
            </section>
          ) : null}
          {view === "today" && incomplete.length ? (
            <p className="list-footnote">
              Includes unfinished tasks planned for earlier days and tasks due
              today or overdue.
            </p>
          ) : null}
        </>
      ) : null}
    </>
  );
}
