import type { Course, CourseInput } from "../../types/course.ts";

export interface CourseRepository {
  list(): Promise<Course[]>;
  create(input: CourseInput): Promise<void>;
  update(id: string, input: CourseInput): Promise<void>;
  setArchived(id: string, archived: boolean): Promise<void>;
}
