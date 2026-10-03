import type { TopicInput } from "../../types/topic.ts";

export function validateTopic(input: TopicInput): TopicInput {
  const name = input.name.trim();
  if (!name || name.length > 60) throw new Error("Enter a topic name between 1 and 60 characters.");
  return { name };
}

export function validateTopicIds(ids: string[]): string[] {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string" || !id.trim() || id.trim().length > 200)) {
    throw new Error("Choose valid topics, or leave them unassigned.");
  }
  return [...new Set(ids.map((id) => id.trim()))];
}
