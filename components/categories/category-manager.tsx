"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import type { Category, CategoryInput } from "@/types/category";
import {
  categoryColors,
  validateCategory,
} from "@/lib/categories/category-rules";
import { CategoryBadge } from "./category-badge";

interface CategoryManagerProps {
  categories: Category[];
  disabled: boolean;
  onCreate: (input: CategoryInput) => Promise<boolean>;
  onUpdate: (id: string, input: CategoryInput) => Promise<boolean>;
  onArchive: (id: string, archived: boolean) => Promise<boolean>;
}

export function CategoryManager({
  categories,
  disabled,
  onCreate,
  onUpdate,
  onArchive,
}: CategoryManagerProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(categoryColors[0].value);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);

  function reset() {
    setEditingId(null);
    setName("");
    setColor(categoryColors[0].value);
    setError(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    try {
      const input = validateCategory({ name, color });
      setError(null);
      const saved = editingId
        ? await onUpdate(editingId, input)
        : await onCreate(input);
      if (saved) {
        setNotice(
          editingId
            ? "Category updated everywhere it is used."
            : "Category created. You can now choose it for your tasks.",
        );
        reset();
        nameInput.current?.focus();
      }
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : "Check your category details.",
      );
    }
  }

  return (
    <div className="category-management">
      <button
        className="category-toggle"
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen(!open)}
      >
        {open ? "Close categories" : "Manage categories"}
      </button>
      {open ? (
        <section
          id={`${id}-panel`}
          className="category-panel"
          aria-labelledby={`${id}-heading`}
        >
          <h2 id={`${id}-heading`}>Your categories</h2>
          <p className="category-help">
            Choose a name and a color. Changes appear on every task in that
            category.
          </p>
          <form
            onSubmit={save}
            aria-label={editingId ? "Edit category" : "Create category"}
          >
            <fieldset disabled={disabled}>
              <div className="category-fields">
                <label htmlFor={`${id}-name`}>
                  Category name
                  <input
                    ref={nameInput}
                    id={`${id}-name`}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Club Work"
                    required
                    maxLength={60}
                  />
                </label>
                <label htmlFor={`${id}-color`}>
                  Color hex
                  <input
                    id={`${id}-color`}
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                    pattern="#[0-9a-fA-F]{6}"
                    maxLength={7}
                    required
                    spellCheck={false}
                  />
                </label>
                <label className="color-picker-label" htmlFor={`${id}-picker`}>
                  Pick color
                  <input
                    id={`${id}-picker`}
                    type="color"
                    value={
                      /^#[0-9a-f]{6}$/i.test(color)
                        ? color
                        : categoryColors[0].value
                    }
                    onChange={(event) => setColor(event.target.value)}
                  />
                </label>
                <button className="primary-button" type="submit">
                  {editingId ? "Save category" : "Create category"}
                </button>
                {editingId ? (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={reset}
                  >
                    Cancel category edit
                  </button>
                ) : null}
              </div>
              <div
                className="color-options"
                role="group"
                aria-label="Suggested category colors"
              >
                {categoryColors.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    aria-label={`Use ${choice.name.toLowerCase()} color`}
                    aria-pressed={color.toLowerCase() === choice.value}
                    style={{ backgroundColor: choice.value }}
                    onClick={() => setColor(choice.value)}
                  />
                ))}
                <span>Or pick any color.</span>
              </div>
            </fieldset>
          </form>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <p className="notice" role="status">
            {notice}
          </p>
          <button type="button" className="secondary-button" aria-pressed={showArchived}
            onClick={() => setShowArchived(!showArchived)}>Show archived</button>
          <ul className="category-list">
            {[...categories]
              .filter((category) => showArchived || !category.archivedAt)
              .sort(
                (a, b) =>
                  Number(!!a.archivedAt) - Number(!!b.archivedAt) ||
                  a.name.localeCompare(b.name),
              )
              .map((category) => (
                <li key={category.id} className={category.archivedAt ? "is-archived" : undefined}>
                  <CategoryBadge category={category} />
                  <div className="row-actions">
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={`Edit category ${category.name}`}
                      onClick={() => {
                        setEditingId(category.id);
                        setName(category.name);
                        setColor(category.color);
                        setError(null);
                        nameInput.current?.focus();
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={`${category.archivedAt ? "Restore" : "Archive"} category ${category.name}`}
                      onClick={async () => {
                        if (
                          await onArchive(category.id, !category.archivedAt)
                        ) {
                          setNotice(
                            category.archivedAt
                              ? "Category restored."
                              : "Category archived. Existing tasks keep their category.",
                          );
                          if (editingId === category.id) reset();
                        }
                      }}
                    >
                      {category.archivedAt ? "Restore" : "Archive"}
                    </button>
                  </div>
                </li>
              ))}
          </ul>
          <p className="category-help">
            Archiving hides a category from new assignments. Existing tasks keep
            their name and color, and you can restore the category at any time.
          </p>
        </section>
      ) : null}
    </div>
  );
}
