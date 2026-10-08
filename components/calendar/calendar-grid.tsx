import type { CalendarOccurrence } from "@/types/calendar-occurrence";
import { positionOccurrences } from "@/lib/calendar/calendar-rules";
import { formatDate } from "@/lib/tasks/task-rules";
import { EventBlock } from "./event-block";
import { useEffect, useRef } from "react";

export function CalendarGrid({ dates, occurrences, disabled, onEdit }: {
  dates: string[]; occurrences: CalendarOccurrence[]; disabled: boolean; onEdit: (occurrence: CalendarOccurrence) => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const firstDate = dates[0];
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 8 * 56; }, [firstDate]);
  return <div ref={scroll} className="calendar-time-scroll" role="region" aria-label="Weekly event time grid" tabIndex={0}>
    <div className="calendar-time-grid">
      <div className="calendar-hours" aria-hidden="true"><div className="calendar-grid-heading">Time</div><div className="calendar-hour-body">
        {Array.from({ length: 24 }, (_, hour) => <span key={hour} style={{ top: `${hour / 24 * 100}%` }}>{String(hour).padStart(2, "0")}:00</span>)}
      </div></div>
      {dates.map(date => <section className="calendar-grid-day" key={date} aria-label={`Events ${formatDate(date)}`}>
        <h3 className="calendar-grid-heading">{new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" })}<br />{formatDate(date)}</h3>
        <div className="calendar-day-body">
          {positionOccurrences(occurrences.filter(item => item.date === date)).map(item => <EventBlock key={item.occurrence.id} item={item} disabled={disabled} onEdit={() => onEdit(item.occurrence)} />)}
        </div>
      </section>)}
    </div>
  </div>;
}
