"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CategoryManager } from "@/components/categories/category-manager";
import { useTasks } from "@/lib/tasks/use-tasks";
import {
  addCalendarDays,
  buildWeek,
  startOfWeek,
} from "@/lib/tasks/week-rules";
import { formatDate, formatDuration } from "@/lib/tasks/task-rules";
import { TaskForm } from "./task-form";
import { TaskRow } from "./task-row";
import { WeekCalendar } from "./week-calendar";

export function WeekBoard() {
  const { tasks, categories, ready, busy, error, today, refresh, mutate } =
    useTasks();
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const editor = useRef<HTMLDivElement>(null);
  const weekStart = selectedWeek ?? (today ? startOfWeek(today) : null);
  const days = weekStart ? buildWeek(tasks, weekStart) : [];
  const editing = tasks.find((task) => task.id === editingId);
  const totalCount = days.reduce((sum, day) => sum + day.incompleteCount, 0);
  const totalMinutes = days.reduce((sum, day) => sum + day.estimatedMinutes, 0);

  function navigate(offset: number | null) {
    if (!weekStart) return;
    setSelectedWeek(
      offset === null ? null : addCalendarDays(weekStart, offset),
    );
    setEditingId(null);
    setNotice("");
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <h1>Week</h1>
          <p>A little perspective on what&apos;s due.</p>
        </div>
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
          Loading your week…
        </p>
      ) : null}
      {ready && today && weekStart ? (
        <>
          <div className="week-toolbar">
            <h2 aria-live="polite">
              {formatDate(weekStart)} –{" "}
              {formatDate(addCalendarDays(weekStart, 6))}
            </h2>
            <div
              className="week-navigation"
              role="group"
              aria-label="Week navigation"
            >
              <button className="secondary-button" onClick={() => navigate(-7)}>
                Previous week
              </button>
              <button
                className="secondary-button"
                onClick={() => navigate(null)}
              >
                Current week
              </button>
              <button className="secondary-button" onClick={() => navigate(7)}>
                Next week
              </button>
            </div>
          </div>
          <div className="workload">
            <span>
              {totalCount} {totalCount === 1 ? "task" : "tasks"} remaining this
              week
            </span>
            <strong>{formatDuration(totalMinutes)} due</strong>
          </div>
          <CategoryManager
            categories={categories}
            disabled={busy}
            onCreate={(input) =>
              mutate((_tasks, repository) => repository.create(input))
            }
            onUpdate={(id, input) =>
              mutate((_tasks, repository) => repository.update(id, input))
            }
            onArchive={(id, archived) =>
              mutate((_tasks, repository) =>
                repository.setArchived(id, archived),
              )
            }
          />
          <div ref={editor}>
            {editing ? (
              <section className="week-editor" aria-label="Edit calendar task">
                <TaskForm
                  key={editing.id}
                  task={editing}
                  today={today}
                  categories={categories}
                  disabled={busy}
                  onCancel={() => setEditingId(null)}
                  onSave={async (input) => {
                    const saved = await mutate((repository) =>
                      repository.update(editing.id, input),
                    );
                    if (saved) {
                      setNotice("Changes saved across Today, Tasks, and Week.");
                      setEditingId(null);
                    }
                    return saved;
                  }}
                />
                <TaskRow
                  task={editing}
                  category={categories.find(
                    (category) => category.id === editing.categoryId,
                  )!}
                  today={today}
                  busy={busy}
                  onEdit={() => editor.current?.querySelector("input")?.focus()}
                  onToggle={async () => {
                    if (
                      await mutate((repository) =>
                        repository.setStatus(
                          editing.id,
                          editing.status === "completed"
                            ? "incomplete"
                            : "completed",
                        ),
                      )
                    )
                      setNotice(
                        editing.status === "completed"
                          ? "Task reopened."
                          : "Task completed. Workload updated.",
                      );
                  }}
                  onDelete={async () => {
                    const saved = await mutate((repository) =>
                      repository.remove(editing.id),
                    );
                    if (saved) {
                      setEditingId(null);
                      setNotice("Task removed.");
                    }
                    return saved;
                  }}
                />
              </section>
            ) : null}
          </div>
          <div className="notice" role="status">
            {busy ? "Saving…" : notice}
          </div>
          <WeekCalendar
            days={days}
            today={today}
            categories={categories}
            disabled={busy}
            onEdit={(task) => {
              setEditingId(task.id);
              window.requestAnimationFrame(() => {
                editor.current?.scrollIntoView({ block: "start" });
                editor.current?.querySelector("input")?.focus();
              });
            }}
          />
          <p className="list-footnote">
            Organized by due date, Monday through Sunday. Totals include
            incomplete tasks only; completed tasks stay visible. Tasks without a
            due date are in <Link href="/tasks">Tasks</Link>.
          </p>
        </>
      ) : null}
    </>
  );
}
