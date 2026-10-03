"use client";

import { TaskTimer } from "@/components/timers/task-timer";
import { useState } from "react";
import type { Task } from "@/types/task";
import type { Category } from "@/types/category";
import { CategoryBadge } from "@/components/categories/category-badge";
import { formatDate } from "@/lib/tasks/task-rules";
import { EstimateDetails } from "./estimate-details";
import type { DurationPrediction } from "@/lib/estimation/duration-estimation";

interface TaskRowProps {
  task: Task;
  prediction?: DurationPrediction;
  category: Category;
  today: string;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => Promise<boolean>;
}

export function TaskRow({
  task,
  prediction,
  category,
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
      id={`task-${task.id}`}
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
            <CategoryBadge category={category} />
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
        <EstimateDetails task={task} prediction={prediction} />
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
      <TaskTimer task={task} disabled={busy} />
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
