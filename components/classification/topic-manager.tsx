"use client";
import type { Topic, TopicInput } from "@/types/topic";
import { NamedClassificationManager } from "./classification-manager";
export function TopicManager({ topics, disabled, onCreate, onUpdate, onArchive }: {
  topics: Topic[]; disabled: boolean;
  onCreate(input: TopicInput): Promise<boolean>;
  onUpdate(id: string, input: TopicInput): Promise<boolean>;
  onArchive(id: string, archived: boolean): Promise<boolean>;
}) {
  return <details className="category-management"><summary className="category-toggle">Manage topics</summary>
    <div className="category-panel"><p className="category-help">Topics describe subject matter. Assign as many as needed; archived topics stay on existing tasks.</p>
      <NamedClassificationManager course={false} label="topic" records={topics} disabled={disabled}
        onCreate={onCreate} onUpdate={onUpdate} onArchive={onArchive} />
    </div></details>;
}
