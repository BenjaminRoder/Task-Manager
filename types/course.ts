export interface CourseInput {
  name: string;
  code?: string | null;
}

export interface Course extends CourseInput {
  id: string;
  code: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
