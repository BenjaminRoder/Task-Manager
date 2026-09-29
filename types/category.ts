export interface CategoryInput {
  name: string;
  color: string;
}

export interface Category extends CategoryInput {
  id: string;
  archivedAt: string | null;
}
