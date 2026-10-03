"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import {
  priorities,
  type Task,
  type TaskInput,
  type Priority,
} from "@/types/task";
import { validateTask } from "@/lib/tasks/task-rules";
import type { Category } from "@/types/category";
import { estimationRules } from "@/lib/estimation/duration-estimation";

interface TaskFormProps {
  task?: Task;
  today: string;
  categories: Category[];
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
  const availableCategories = categories.filter(
    (category) => !category.archivedAt || category.id === task?.categoryId,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const input = validateTask({
        title: String(data.get("title") ?? ""),
        categoryId: String(data.get("categoryId") ?? ""),
        priority: String(data.get("priority")) as Priority,
        estimatedMinutes: String(data.get("estimatedMinutes") ?? "").trim() === "" ? null : Number(data.get("estimatedMinutes")),
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
            <select
              id={`${id}-category`}
              name="categoryId"
              defaultValue={
                task?.categoryId ?? availableCategories[0]?.id ?? ""
              }
              required
            >
              <option value="" disabled>
                Choose a category
              </option>
              {availableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.archivedAt ? " (archived)" : ""}
                </option>
              ))}
            </select>
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
            Manual estimate (min, optional)
            <input
              id={`${id}-estimate`}
              name="estimatedMinutes"
              type="number"
              min="1"
              max="1440"
              step="1"
              defaultValue={task?.estimatedMinutes ?? ""}
              placeholder="Automatic"
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
      <p className="category-help">Leave the manual estimate blank to use history, or {estimationRules.defaultMinutes} min until enough history exists. A manual estimate overrides the prediction.</p>
      {!availableCategories.length ? (
        <p className="category-help">
          Create or restore a category using Manage categories above.
        </p>
      ) : null}
      {validation ? (
        <p className="form-error" role="alert">
          {validation}
        </p>
      ) : null}
    </form>
  );
}
