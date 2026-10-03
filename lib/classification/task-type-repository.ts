import type { TaskType, TaskTypeInput } from "../../types/task-type.ts";

export interface TaskTypeRepository {
  list(): Promise<TaskType[]>;
  create(input: TaskTypeInput): Promise<void>;
  update(id: string, input: TaskTypeInput): Promise<void>;
  setArchived(id: string, archived: boolean): Promise<void>;
}
