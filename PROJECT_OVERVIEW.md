# Personal Task Manager

## Product goal

A private productivity web app for school, work, personal tasks, and reading. Capture tasks quickly, build momentum by clearing shorter work, track actual effort, and use that history to improve estimates and understand time allocation. Keep manual control, explainable calculations, and durable history.

This document defines intended V1 behavior, not completion status. See BUILD_PLAN.md for implemented features and remaining work, README.md for setup, and AGENTS.md for engineering rules. Code and migrations define the actual schema; conceptual field lists are not contracts.

## V1 sections

| Section | Purpose |
| --- | --- |
| Today | Quick capture, actionable daily list, timer controls, estimated/completed/remaining workload, sorting. |
| Tasks | Create, edit, complete, reopen, schedule, and soft-delete tasks; organize by category, optional course, task type, priority, and manual order. |
| Week | Monday–Sunday due-date workload; authorized experiment adds compact tasks, due times/grouping, events, weekly classes, time grid, and task-creation sidebar. |
| Analytics | Real time allocation, completions, estimate accuracy, and reading progress. |
| Reading | Books, page progress, reading sessions, weekly quotas, and completed-book history. |
| History | Inspect completed tasks, estimates, actual time, sessions, and past reading with basic filters. |

Week is the sixth destination added in Milestone 1.5. Implementation status, including Reading and hosted acceptance, is recorded in the newest BUILD_PLAN.md checkpoints; this overview does not determine completion.

## Tasks, dates, and ordering

- Tasks support title, optional description/notes, category, optional course, task type, priority, deadline, planned date, manual estimate, completion state, and retained history. Add unimplemented fields only through their authorized milestone.
- Categories are editable records with stable identities, arbitrary names, and colors. Archive/restore preserves relationships; archived categories cannot receive new assignments. Course and task type are separate classification dimensions, not substitutes for category.
- Today includes unfinished tasks planned today or earlier or due today/overdue, plus tasks completed today in the browser's local calendar. Future work and older completions remain in Tasks. Overdue work must be visibly identified; inline labels are acceptable.
- Week groups by due date independently of planned date. Completed tasks remain visible but contribute no remaining count/minutes. Deleted and undated tasks are excluded; undated work stays in Tasks. Use calendar-date arithmetic and a Monday week start.
- Planned dates remain date-only. Optional due times are authorized in Week calendar Phase 1; see the semantics below.
- Momentum orders incomplete tasks shortest first using the best available estimate. The original baseline is prediction, then manual estimate, then fallback; explicit manual override must be resolved and documented with Milestone 4.
- Priority uses user-assigned importance; Deadline uses the nearest deadline; Manual uses persisted user order. Automatic sorts never overwrite manual priority or saved manual order.
- Daily workload is calculated from the displayed task set. Remaining workload excludes completed work. Completed-workload summaries are still required; limited calendar availability is authorized in Week calendar Phase 2.

## Timing and estimation

Actual task time derives from individual non-void time sessions. Multiple sessions may belong to a task; only one may be active per account. Persist server timestamps and reconstruct active elapsed time after refresh. The browser counter is display-only. Completion/deletion closes active timing; reopening does not restart it. Corrections/removal preserve records.

Duration estimation is deterministic and explainable, with no external AI API. Prefer comparable completed work, weight recent history more heavily, and fall back sensibly when history is insufficient. Keep manual input separate from predictions and show source/sample information without implying calibrated statistical confidence. Milestone 4 defines the implementation and outstanding classification decisions.

## Reading

Track books with title, author, total/current pages, start/target dates, weekly page goal, and status (Want to Read, Reading, Paused, Completed). Preserve completed books. Record reading sessions with date, page range/pages read, and optional minutes; these provide historical metrics and weekly quota totals.

Show percentage complete, pages today/this week, weekly quota progress, average pages/day, reading speed when timed, projected completion date, and books completed this year. Validate page ranges and handle insufficient history without fabricated projections.

## Analytics and History

Use real persisted data to calculate weekly/monthly focus time, study time, non-study productive time, reading time, time by category/course/day, completed-task count, average task duration, estimated versus actual duration, prediction error, reading progress, and pages by week. Distinguish task timing, reading timing, and other manual timing if introduced; avoid double-counting.

Readable summary statistics take precedence over charts. Support limited-history empty states, human-readable durations, and consistent date boundaries. History should expose completion dates, classification, estimates, actuals, and sessions, with date/category/course/task-type/status filters. Historical inspection must not depend on categories/courses remaining active.

## UX and privacy

Keep the interface calm, fast, accessible, and usable on desktop, iPad, and mobile browsers. Today favors immediate action; Analytics may be denser. Private authentication and ownership isolation apply even for one initial user. Use real data, preserve history, and provide clear loading, validation, success, and recovery states. The supported stack and operational configuration are recorded in README.md.

## Deferred beyond V1

External AI/complex ML, AI-generated descriptions or summaries, email/LMS imports, full calendar sync, automatic task scheduling, advanced recurrence, dependencies and deadline-risk recommendations, teams/social/public profiles or marketplace, heavy gamification, voice entry, native iOS, PWA/offline/push infrastructure, CSV import/export, and backup/restore tooling. Do not prebuild speculative integrations.

## V1 success

The user can privately sign in, organize and manually reorder tasks, see daily/weekly workload, track multiple durable sessions, obtain useful explainable estimates, review time by class/category, meet reading quotas, and inspect historical work from desktop/mobile. Refresh preserves important state; ownership checks and repository quality checks pass. Remaining acceptance is tracked in BUILD_PLAN.md.


## Authorized Week calendar experiment

This is planned work on `experiment/week-calendar`, not a completed feature or a change to main. Setup surveys/scaffolds only. Phase 1 adds nullable due times, dense task rows, organization controls, and weekend actual-time cleanup. Phase 2 adds one-off events, weekly recurring class patterns, the calendar layout, and sidebar. Analytics M6 remains outside this authorization.

### Due dates, times, and organization

- Keep due date separate from optional minute-precision due time (`HH:mm`, SQL `time without time zone` or the equivalent existing convention). A time requires a date. Clearing the date clears the time; clearing only time keeps the date. Existing date-only records remain untimed, never converted to midnight deadlines.
- Retain browser-local calendar semantics used by the current app. These are floating local dates/times, not UTC instants or timezone-aware alarms. Do not introduce account timezone storage in this experiment. Different browser timezones may interpret the same wall-clock deadline differently; document that limitation. Calendar arithmetic must avoid UTC date shifting and fixed 24-hour recurrence stepping.
- Week still assigns tasks to due-date days, independently of planned date; deleted/undated tasks are excluded and completed tasks remain visible with no remaining workload contribution.
- Preserve a genuine shortest-first mode: effective duration is primary, due time breaks equal-duration ties (timed before untimed), then a stable identity/order tie-break. In course and task-type modes, group by stable IDs, with an explicit Unassigned group; within each group/day order timed deadlines chronologically, then untimed tasks, with effective duration and stable identity/order for ties. Keep completed-task placement consistent with existing behavior. This resolves the draft's conflict between unconditional deadline sorting and the current shortest-first mode.
- Persist only the organization preference in account-scoped localStorage through existing UI preference patterns, with safe hydration, invalid-value fallback, and unavailable-storage handling. Automatic organization never rewrites manual priority/order.
- Dense rows retain existing task information/actions through accessible details where needed. Aim for a scannable desktop week, not a guarantee that an arbitrary number of tasks fits without scrolling. Phones must remain usable. Remove the weekend columns' inline actual-time display only; retain timer/history data and access.

### Events, classes, and calendar layout

- One-off events have title, local date, start/end time, optional task and/or course links, retained removal/archive, and creation/update timestamps. Same-day intervals only in this experiment, with end strictly after start. Do not automatically convert deadlines into blocks or add effort to task actuals/predictions.
- Recurring class patterns are persisted user-owned records with title, optional course, a nonempty set of unique weekdays, start/end time, optional inclusive start/end dates, archive and timestamps. Use existing weekday convention or explicitly map it once. Weekly expansion yields derived read-only occurrences with stable pattern+date identity. Edit/archive the series; no per-occurrence overrides, exceptions, RRULE, or stored generated instances.
- Events, class patterns, and linked tasks/courses require compound owner-matching keys/FKs, owner-only SELECT/INSERT/UPDATE RLS, no DELETE grant, identity guards and retention consistent with the repository. Archived links remain readable; new/reassigned links must follow active-record rules.
- Existing Week route becomes compact task strip above a Monday–Sunday time grid showing events and expanded classes. Provide event and class create/edit/archive/restore controls, week navigation, loading/empty/error states, overlapping-block visibility, keyboard-accessible actions and responsive layout. No drag/drop or resize scheduling is required.
- Sidebar shows courses, quick task creation, and per-day availability. Define availability transparently: within an adjustable local planning window (default 08:00–22:00), subtract the union of nonremoved event/class intervals clipped to that window. Overlaps count once. Display remaining minutes and rank the most free days. Task estimates appear separately as due workload; unscheduled tasks, sleep and unentered commitments do not occupy calendar intervals. This is recorded calendar availability, not a promise of actual free time or automatic scheduling.
- Calendar blocks never create timer sessions or change estimation/Reading totals. QA records are uniquely labeled, then soft-deleted/archived/voided through existing retention flows; no hard-delete cleanup.
