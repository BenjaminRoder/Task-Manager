import type { Topic, TopicInput } from "../../types/topic.ts";

export interface TopicRepository {
  list(): Promise<Topic[]>;
  create(input: TopicInput): Promise<void>;
  update(id: string, input: TopicInput): Promise<void>;
  setArchived(id: string, archived: boolean): Promise<void>;
}
