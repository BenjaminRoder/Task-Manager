"use client";
import { ActualTime } from "@/components/timers/task-timer";
import type { Category } from "@/types/category";
import type { Task } from "@/types/task";
import type { WeekDay } from "@/lib/tasks/week-rules";
import { formatDate, formatDuration, formatDueTime } from "@/lib/tasks/task-rules";
import { groupWeekTasks, type WeekOrganization } from "@/lib/tasks/week-organization";
import { CategoryBadge } from "@/components/categories/category-badge";
import { effectiveEstimate, type Predictions } from "@/lib/estimation/duration-estimation";
import type { Course } from "@/types/course";
import type { TaskType } from "@/types/task-type";

import type { Topic } from "@/types/topic";

interface WeekCalendarProps {
  organization?: WeekOrganization;
  days: WeekDay[];
  predictions?: Predictions;
  estimationReady: boolean;
  today: string;
  categories: Category[];
  courses: Course[];
  taskTypes: TaskType[];
  topics: Topic[];
  disabled: boolean;
  onEdit: (task: Task) => void;
}

export function WeekCalendar({
  organization = "shortest",
  days,
  predictions,
  estimationReady,
  today,
  categories,
  courses,
  taskTypes,
  topics,
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
        {days.map((day, dayIndex) => {
          const groups = groupWeekTasks(day.tasks, organization, courses, taskTypes, predictions);
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
                  groups.map((group) => (
                    <div className="week-task-group" key={group.key}>
                      {group.label ? <h3>{group.label}</h3> : null}
                      {group.tasks.map((task) => (
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
                      {task.dueTime ? <span className="week-due-time">due at {formatDueTime(task.dueTime)}</span> : null}
                      {task.categoryId && categoryById.get(task.categoryId) ? <CategoryBadge category={categoryById.get(task.categoryId)!} /> : <span>No category</span>}
                      {task.courseId ? <span className="week-classification">{courses.find((course) => course.id === task.courseId)?.code || courses.find((course) => course.id === task.courseId)?.name}{courses.find((course) => course.id === task.courseId)?.archivedAt ? " (archived)" : ""}</span> : null}
                      {task.taskTypeId ? <span className="week-classification">{taskTypes.find((type) => type.id === task.taskTypeId)?.name}{taskTypes.find((type) => type.id === task.taskTypeId)?.archivedAt ? " (archived)" : ""}</span> : null}
                      {topics.filter((topic) => task.topicIds?.includes(topic.id)).map((topic) => <span className="topic-badge" key={topic.id}>{topic.name}{topic.archivedAt ? " (archived)" : ""}</span>)}
                      <span className="week-task-details">
                        <span>{estimationReady || task.estimatedMinutes !== null ? formatDuration(effectiveEstimate(task, predictions?.get(task.id))) : "History unavailable"}</span>
                        <span className={`priority priority-${task.priority}`}>
                          {task.priority}
                        </span>
                      </span>
                      {dayIndex < 5 ? <ActualTime taskId={task.id} /> : null}
                      {task.status === "completed" ? (
                        <span className="week-completed-label">Completed</span>
                      ) : null}
                    </button>
                      ))}
                    </div>
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
