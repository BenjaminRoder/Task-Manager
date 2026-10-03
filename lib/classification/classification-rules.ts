import type { CourseInput } from "../../types/course.ts";
import type { TaskTypeInput } from "../../types/task-type.ts";

function validateName(name: string, label: string): string {
  const value = name.trim();
  if (!value || value.length > 60) {
    throw new Error(`Enter a ${label} name between 1 and 60 characters.`);
  }
  return value;
}

export function validateCourse(input: CourseInput): CourseInput {
  const name = validateName(input.name, "course");
  const code = input.code?.trim() || null;
  if (code !== null && code.length > 20) {
    throw new Error("Course code must be at most 20 characters.");
  }
  return { name, code };
}

export function validateTaskType(input: TaskTypeInput): TaskTypeInput {
  return { name: validateName(input.name, "task type") };
}
