"use client";
import { ActualTime } from "@/components/timers/task-timer";
import type { Category } from "@/types/category";
import type { Task } from "@/types/task";
import type { WeekDay } from "@/lib/tasks/week-rules";
import { formatDate, formatDuration } from "@/lib/tasks/task-rules";
import { CategoryBadge } from "@/components/categories/category-badge";
import { effectiveEstimate, type Predictions } from "@/lib/estimation/duration-estimation";
import type { Course } from "@/types/course";
import type { TaskType } from "@/types/task-type";

interface WeekCalendarProps {
  days: WeekDay[];
  predictions?: Predictions;
  estimationReady: boolean;
  today: string;
  categories: Category[];
  courses: Course[];
  taskTypes: TaskType[];
  disabled: boolean;
  onEdit: (task: Task) => void;
}

export function WeekCalendar({
  days,
  predictions,
  estimationReady,
  today,
  categories,
  courses,
  taskTypes,
  disabled,
  onEdit,
}: WeekCalendarProps) {
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const busiest = Math.max(1, ...days.map((day) => day.estimatedMinutes));
  return (
    <div
      className="week-scroll"
      role="region"
      aria-label="Weekly task calendar"
      tabIndex={0}
    >
      <div className="week-grid">
        {days.map((day) => {
          const weekday = new Date(`${day.date}T12:00:00`).toLocaleDateString(
            undefined,
            { weekday: "long" },
          );
          return (
            <section
              key={day.date}
              className={`week-day${day.date === today ? " current-day" : ""}`}
              aria-label={`${weekday}, ${formatDate(day.date)}`}
              aria-current={day.date === today ? "date" : undefined}
            >
              <header className="week-day-header">
                <h2>
                  <time dateTime={day.date}>
                    <span>{weekday}</span>
                    <strong>{Number(day.date.slice(-2))}</strong>
                  </time>
                </h2>
                {day.date === today ? (
                  <span className="today-marker">Today</span>
                ) : null}
                <p className="day-count">
                  {day.incompleteCount}{" "}
                  {day.incompleteCount === 1 ? "task" : "tasks"} remaining
                </p>
                <p className="day-workload">
                  {estimationReady ? formatDuration(day.estimatedMinutes) : "History unavailable"}
                </p>
                <div className="workload-track" aria-hidden="true">
                  <span
                    style={{
                      width: estimationReady ? `${(day.estimatedMinutes / busiest) * 100}%` : "0%",
                    }}
                  />
                </div>
              </header>
              <div className="week-task-list">
                {day.tasks.length ? (
                  day.tasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className={`week-task${task.status === "completed" ? " week-task-completed" : ""}`}
                      style={{
                        borderLeftColor: task.categoryId ? categoryById.get(task.categoryId)?.color : undefined,
                      }}
                      disabled={disabled}
                      aria-label={`Edit ${task.title}`}
                      onClick={() => onEdit(task)}
                    >
                      <span className="week-task-title">{task.title}</span>
                      {task.categoryId && categoryById.get(task.categoryId) ? <CategoryBadge category={categoryById.get(task.categoryId)!} /> : <span>No category</span>}
                      {task.courseId ? <span>{courses.find((course) => course.id === task.courseId)?.code || courses.find((course) => course.id === task.courseId)?.name}</span> : null}
                      {task.taskTypeId ? <span>{taskTypes.find((type) => type.id === task.taskTypeId)?.name}</span> : null}
                      <span className="week-task-details">
                        <span>{estimationReady || task.estimatedMinutes !== null ? formatDuration(effectiveEstimate(task, predictions?.get(task.id))) : "History unavailable"}</span>
                        <span className={`priority priority-${task.priority}`}>
                          {task.priority}
                        </span>
                      </span>
                      <ActualTime taskId={task.id} />
                      {task.status === "completed" ? (
                        <span className="week-completed-label">Completed</span>
                      ) : null}
                    </button>
                  ))
                ) : (
                  <p className="empty-day">Nothing due</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
