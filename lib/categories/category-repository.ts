import type { Category, CategoryInput } from "../../types/category.ts";
import { localStore, type LocalStore } from "../storage/local-store.ts";
import { categoryNameKey, validateCategory } from "./category-rules.ts";

export interface CategoryRepository {
  list(): Promise<Category[]>;
  create(input: CategoryInput): Promise<void>;
  update(id: string, input: CategoryInput): Promise<void>;
  setArchived(id: string, archived: boolean): Promise<void>;
}

export function createLocalCategoryRepository(
  store: LocalStore,
): CategoryRepository {
  return {
    async list() {
      return store.read().categories;
    },
    async create(input) {
      const fields = validateCategory(input);
      const data = store.read();
      if (
        data.categories.some(
          (category) =>
            categoryNameKey(category.name) === categoryNameKey(fields.name),
        )
      ) {
        throw new Error(
          "A category with this name already exists. Use it or restore it from archived categories.",
        );
      }
      data.categories.push({
        ...fields,
        id: crypto.randomUUID(),
        archivedAt: null,
      });
      store.write(data);
    },
    async update(id, input) {
      const fields = validateCategory(input);
      const data = store.read();
      const category = data.categories.find((category) => category.id === id);
      if (!category)
        throw new Error(
          "This category is no longer available. Reload and try again.",
        );
      if (
        data.categories.some(
          (category) =>
            category.id !== id &&
            categoryNameKey(category.name) === categoryNameKey(fields.name),
        )
      ) {
        throw new Error(
          "A category with this name already exists. Choose a different name.",
        );
      }
      Object.assign(category, fields);
      store.write(data);
    },
    async setArchived(id, archived) {
      const data = store.read();
      const category = data.categories.find((category) => category.id === id);
      if (!category)
        throw new Error(
          "This category is no longer available. Reload and try again.",
        );
      category.archivedAt = archived ? new Date().toISOString() : null;
      store.write(data);
    },
  };
}

export const categoryRepository = createLocalCategoryRepository(localStore);
