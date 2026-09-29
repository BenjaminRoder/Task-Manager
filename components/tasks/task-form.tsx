"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import {
  priorities,
  type Task,
  type TaskInput,
  type Priority,
} from "@/types/task";
import { validateTask } from "@/lib/tasks/task-rules";

interface TaskFormProps {
  task?: Task;
  today: string;
  categories: string[];
  disabled: boolean;
  onSave: (input: TaskInput) => Promise<boolean>;
  onCancel?: () => void;
}

export function TaskForm({
  task,
  today,
  categories,
  disabled,
  onSave,
  onCancel,
}: TaskFormProps) {
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const [validation, setValidation] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const input = validateTask({
        title: String(data.get("title") ?? ""),
        category: String(data.get("category") ?? ""),
        priority: String(data.get("priority")) as Priority,
        estimatedMinutes: Number(data.get("estimatedMinutes")),
        dueDate: String(data.get("dueDate") ?? "") || null,
        scheduledDate: String(data.get("scheduledDate") ?? ""),
      });
      setValidation(null);
      if (await onSave(input)) {
        if (!task) form.reset();
        titleRef.current?.focus();
      }
    } catch (problem) {
      setValidation(
        problem instanceof Error ? problem.message : "Check your task details.",
      );
    }
  }

  return (
    <form
      onSubmit={submit}
      className="task-form"
      aria-label={task ? `Edit ${task.title}` : "Add a task"}
    >
      <fieldset disabled={disabled}>
        {task ? <h3 className="edit-heading">Edit task</h3> : null}
        <div className="quick-add">
          <label className="sr-only" htmlFor={`${id}-title`}>
            Task title
          </label>
          <input
            ref={titleRef}
            id={`${id}-title`}
            name="title"
            placeholder="What needs to get done?"
            defaultValue={task?.title ?? ""}
            required
            maxLength={160}
            autoComplete="off"
          />
          <button className="primary-button" type="submit">
            {task ? "Save changes" : "Add task"}
          </button>
          {onCancel ? (
            <button
              type="button"
              className="secondary-button"
              onClick={onCancel}
            >
              Cancel
            </button>
          ) : null}
        </div>
        <div className="form-details">
          <label htmlFor={`${id}-category`}>
            Category
            <input
              id={`${id}-category`}
              name="category"
              list={`${id}-categories`}
              defaultValue={task?.category ?? "Personal"}
              maxLength={60}
              required
            />
            <datalist id={`${id}-categories`}>
              {categories.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </label>
          <label htmlFor={`${id}-priority`}>
            Priority
            <select
              id={`${id}-priority`}
              name="priority"
              defaultValue={task?.priority ?? "medium"}
            >
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority[0].toUpperCase() + priority.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={`${id}-estimate`}>
            Estimate (min)
            <input
              id={`${id}-estimate`}
              name="estimatedMinutes"
              type="number"
              min="1"
              max="1440"
              step="1"
              defaultValue={task?.estimatedMinutes ?? 25}
              required
            />
          </label>
          <label htmlFor={`${id}-due`}>
            Due date (optional)
            <input
              id={`${id}-due`}
              name="dueDate"
              type="date"
              defaultValue={task?.dueDate ?? ""}
            />
          </label>
          <label htmlFor={`${id}-planned`}>
            Planned for
            <input
              id={`${id}-planned`}
              name="scheduledDate"
              type="date"
              defaultValue={task?.scheduledDate ?? today}
              required
            />
          </label>
        </div>
      </fieldset>
      {validation ? (
        <p className="form-error" role="alert">
          {validation}
        </p>
      ) : null}
    </form>
  );
}
