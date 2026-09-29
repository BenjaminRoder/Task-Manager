"use client";
import { createContext, useContext } from "react";
import type { TaskRepository } from "../tasks/task-repository";
import type { CategoryRepository } from "../categories/category-repository";
export const RepositoryContext = createContext<{
  tasks: TaskRepository;
  categories: CategoryRepository;
} | null>(null);
export function useRepositories() {
  const repositories = useContext(RepositoryContext);
  if (!repositories) throw new Error("Sign in to access your data.");
  return repositories;
}
