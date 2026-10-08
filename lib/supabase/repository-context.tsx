"use client";
import { createContext, useContext } from "react";
import type { TaskRepository } from "../tasks/task-repository";
import type { CategoryRepository } from "../categories/category-repository";
import type { CourseRepository } from "../classification/course-repository";
import type { TaskTypeRepository } from "../classification/task-type-repository";
import type { TopicRepository } from "../classification/topic-repository";
import type { ReadingRepository } from "../reading/reading-repository";
import type { AnalyticsRepository } from "../analytics/analytics-repository";
import type { EventRepository } from "../calendar/event-repository";
import type { RecurringClassRepository } from "../calendar/recurring-class-repository";
export const RepositoryContext = createContext<{
  // Production is account-pinned; isolated fixtures may omit persistence scope.
  userId?: string;
  tasks: TaskRepository;
  categories: CategoryRepository;
  courses: CourseRepository;
  taskTypes: TaskTypeRepository;
  topics: TopicRepository;
  reading: ReadingRepository;
  analytics: AnalyticsRepository;
  events: EventRepository;
  classes: RecurringClassRepository;
} | null>(null);
export function useRepositories() {
  const repositories = useContext(RepositoryContext);
  if (!repositories) throw new Error("Sign in to access your data.");
  return repositories;
}
