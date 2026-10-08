import type { PositionedOccurrence } from "@/lib/calendar/calendar-rules";
import { formatDueTime } from "@/lib/tasks/task-rules";
export function EventBlock({ item, disabled, onEdit }: { item: PositionedOccurrence; disabled: boolean; onEdit: () => void }) {
  const { occurrence, lane, lanes, top, height } = item;
  const label = `${occurrence.title}, ${formatDueTime(occurrence.startTime)}–${formatDueTime(occurrence.endTime)}. ${occurrence.kind === "class" ? "Edit entire class series" : "Edit event"}`;
  return <button className={`calendar-block calendar-block-${occurrence.kind}`} type="button" disabled={disabled}
    aria-label={label} title={label} onClick={onEdit}
    style={{ top: `${top}%`, height: `${height}%`, left: `${lane / lanes * 100}%`, width: `${100 / lanes}%` }}>
    <strong>{occurrence.title}</strong><span>{formatDueTime(occurrence.startTime)}–{formatDueTime(occurrence.endTime)}</span>
    {occurrence.kind === "class" ? <span className="sr-only">Weekly series</span> : null}
  </button>;
}
