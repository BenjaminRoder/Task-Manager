import type { Category } from "@/types/category";

export function CategoryBadge({ category }: { category: Category }) {
  return (
    <span className="category-badge">
      <span
        className="category-dot"
        style={{ backgroundColor: category.color }}
        aria-hidden="true"
      />
      <span>
        {category.name}
        {category.archivedAt ? " (archived)" : ""}
      </span>
    </span>
  );
}
