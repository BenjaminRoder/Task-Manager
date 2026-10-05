import type { RecurringClassPattern, RecurringClassPatternInput } from "../../types/recurring-class-pattern.ts";

// Persists patterns only, with Auth-derived ownership and database-owned links.
// list includes archives for restore; setArchived never physically deletes rows.
export interface RecurringClassRepository {
  list(): Promise<RecurringClassPattern[]>;
  create(input: RecurringClassPatternInput): Promise<void>;
  update(id: string, input: RecurringClassPatternInput): Promise<void>;
  setArchived(id: string, archived: boolean): Promise<void>;
}
