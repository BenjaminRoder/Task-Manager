export interface TopicInput { name: string }
export interface Topic extends TopicInput {
  id: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
