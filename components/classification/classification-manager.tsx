"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import type { Course, CourseInput } from "@/types/course";
import type { TaskType, TaskTypeInput } from "@/types/task-type";
import { validateCourse, validateTaskType } from "@/lib/classification/classification-rules";

import { validateTopic } from "@/lib/classification/topic-rules";

interface ClassificationManagerProps {
  courses: Course[];
  taskTypes: TaskType[];
  disabled: boolean;
  onCreateCourse(input: CourseInput): Promise<boolean>;
  onUpdateCourse(id: string, input: CourseInput): Promise<boolean>;
  onArchiveCourse(id: string, archived: boolean): Promise<boolean>;
  onCreateTaskType(input: TaskTypeInput): Promise<boolean>;
  onUpdateTaskType(id: string, input: TaskTypeInput): Promise<boolean>;
  onArchiveTaskType(id: string, archived: boolean): Promise<boolean>;
}

export function ClassificationManager(props: ClassificationManagerProps) {
  return (
    <details className="category-management classification-management">
      <summary className="category-toggle">Manage courses and task types</summary>
      <div className="category-panel">
        <p className="category-help">Courses provide academic context; task types describe the kind of work. Both are optional and independent of category.</p>
        <NamedClassificationManager course records={props.courses} disabled={props.disabled}
          onCreate={props.onCreateCourse} onUpdate={props.onUpdateCourse} onArchive={props.onArchiveCourse} />
        <NamedClassificationManager course={false} records={props.taskTypes} disabled={props.disabled}
          onCreate={(input) => props.onCreateTaskType({ name: input.name })}
          onUpdate={(id, input) => props.onUpdateTaskType(id, { name: input.name })}
          onArchive={props.onArchiveTaskType} />
      </div>
    </details>
  );
}

export function NamedClassificationManager({ course, label, records, disabled, onCreate, onUpdate, onArchive }: {
  course: boolean;
  label?: string;
  records: readonly (Course | TaskType)[];
  disabled: boolean;
  onCreate(input: CourseInput): Promise<boolean>;
  onUpdate(id: string, input: CourseInput): Promise<boolean>;
  onArchive(id: string, archived: boolean): Promise<boolean>;
}) {
  const id = useId();
  const noun = label ?? (course ? "course" : "task type");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);

  function reset() {
    setEditingId(null);
    setName("");
    setCode("");
    setError("");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    try {
      const fields = course ? validateCourse({ name, code }) : label ? validateTopic({ name }) : validateTaskType({ name });
      setError("");
      if (await (editingId ? onUpdate(editingId, fields) : onCreate(fields))) {
        setNotice(editingId ? "Classification updated everywhere it is used." : "Created. You can now assign it to a task.");
        reset();
        input.current?.focus();
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Check the classification details.");
    }
  }
  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{course ? "Courses" : label ? "Topics" : "Task types"}</h2>
      <form aria-label={`${editingId ? "Edit" : "Create"} ${noun}`} onSubmit={save}>
        <fieldset disabled={disabled} className="classification-fields">
          <label htmlFor={`${id}-name`}>{course ? "Course name" : label ? "Topic name" : "Task type name"}
            <input id={`${id}-name`} ref={input} value={name} onChange={(event) => setName(event.target.value)}
              maxLength={60} required placeholder={course ? "e.g. Accounting" : label ? "e.g. Chapter 8" : "e.g. Homework"} />
          </label>
          {course ? <label htmlFor={`${id}-code`}>Course code (optional)
            <input id={`${id}-code`} value={code} onChange={(event) => setCode(event.target.value)} maxLength={20} placeholder="e.g. ACCT 151" />
          </label> : null}
          <button className="primary-button" type="submit">{editingId ? `Save ${noun}` : `Create ${noun}`}</button>
          {editingId ? <button type="button" className="secondary-button" onClick={reset}>Cancel {noun} edit</button> : null}
        </fieldset>
      </form>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <p className="notice" role="status">{notice}</p>
      <button type="button" className="secondary-button" aria-pressed={showArchived}
        onClick={() => setShowArchived(!showArchived)}>Show archived</button>
      <ul className="category-list">
        {records.filter((record) => showArchived || !record.archivedAt).sort((a, b) => Number(!!a.archivedAt) - Number(!!b.archivedAt) || a.name.localeCompare(b.name)).map((record) => (
          <li key={record.id} className={record.archivedAt ? "is-archived" : undefined}>
            <span>{"code" in record && record.code ? `${record.code} · ` : ""}{record.name}{record.archivedAt ? " (archived)" : ""}</span>
            <div className="row-actions">
              <button type="button" disabled={disabled} aria-label={`Edit ${noun} ${record.name}`} onClick={() => {
                setEditingId(record.id); setName(record.name); setCode("code" in record ? record.code ?? "" : ""); setError(""); input.current?.focus();
              }}>Edit</button>
              <button type="button" disabled={disabled} aria-label={`${record.archivedAt ? "Restore" : "Archive"} ${noun} ${record.name}`} onClick={async () => {
                if (await onArchive(record.id, !record.archivedAt)) {
                  setNotice(record.archivedAt ? "Restored for new assignments." : "Archived. Existing task references are preserved.");
                  if (editingId === record.id) reset();
                }
              }}>{record.archivedAt ? "Restore" : "Archive"}</button>
            </div>
          </li>
        ))}
      </ul>
      {!records.length ? <p className="category-help">No {course ? "courses" : label ? "topics" : "task types"} yet. Tasks can be created without them.</p> : null}
    </section>
  );
}
