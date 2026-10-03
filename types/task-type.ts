export interface TaskTypeInput {
  name: string;
}

export interface TaskType extends TaskTypeInput {
  id: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
