import type { CategoryInput } from "../../types/category.ts";

export const categoryColors = [
  { name: "Green", value: "#23624c" },
  { name: "Blue", value: "#356cc4" },
  { name: "Purple", value: "#8256b4" },
  { name: "Orange", value: "#b96d28" },
  { name: "Rose", value: "#b94d70" },
  { name: "Teal", value: "#267e86" },
];

export function categoryNameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function validateCategory(input: CategoryInput): CategoryInput {
  const name = input.name.trim();
  if (!name || name.length > 60)
    throw new Error("Enter a category name between 1 and 60 characters.");
  if (!/^#[0-9a-f]{6}$/i.test(input.color))
    throw new Error(
      "Choose a color or enter a six-digit hex color, such as #356cc4.",
    );
  return { name, color: input.color.toLowerCase() };
}
