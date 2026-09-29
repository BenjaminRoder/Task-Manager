"use client";

import { useState } from "react";
import type { Task } from "@/types/task";
import { formatDate, formatDuration } from "@/lib/tasks/task-rules";

interface TaskRowProps {
  task: Task;
  today: string;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => Promise<boolean>;
}

export function TaskRow({
  task,
  today,
  busy,
  onToggle,
  onEdit,
  onDelete,
}: TaskRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const complete = task.status === "completed";
  const overdue = !complete && task.dueDate !== null && task.dueDate < today;
  return (
    <article
      className={`task-row${complete ? " is-complete" : ""}`}
      aria-label={task.title}
    >
      <div className="task-row-main">
        <input
          className="complete-checkbox"
          type="checkbox"
          checked={complete}
          disabled={busy}
          onChange={onToggle}
          aria-label={`${complete ? "Reopen" : "Complete"} ${task.title}`}
        />
        <div className="task-copy">
          <h3>{task.title}</h3>
          <div className="task-meta">
            <span>{task.category}</span>
            <span className={`priority priority-${task.priority}`}>
              {task.priority}
            </span>
            {task.dueDate ? (
              <span className={overdue ? "overdue" : undefined}>
                {overdue ? "Overdue · " : "Due "}
                {formatDate(task.dueDate)}
              </span>
            ) : null}
            {task.scheduledDate > today ? (
              <span>Planned {formatDate(task.scheduledDate)}</span>
            ) : null}
            {complete ? <span>Completed</span> : null}
          </div>
        </div>
        <span className="task-duration">
          {formatDuration(task.estimatedMinutes)}
        </span>
        <div className="row-actions">
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            aria-label={`Edit ${task.title}`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            aria-label={`Delete ${task.title}`}
          >
            Delete
          </button>
        </div>
      </div>
      {confirmDelete ? (
        <div
          className="delete-confirmation"
          role="group"
          aria-label={`Confirm deletion of ${task.title}`}
        >
          <p>Remove this task from your lists?</p>
          <button
            className="danger-button"
            type="button"
            disabled={busy}
            onClick={async () => {
              if (await onDelete()) setConfirmDelete(false);
            }}
          >
            Delete task
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={busy}
            onClick={() => setConfirmDelete(false)}
          >
            Keep task
          </button>
        </div>
      ) : null}
    </article>
  );
}
