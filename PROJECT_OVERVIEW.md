# Personal Task Manager — Project Overview

## 1. Project Summary

This project is a private, personal productivity web application designed to manage school work, busy work, reading, and other recurring responsibilities in one place.

The core goal is to create a task manager that becomes more useful over time by learning from the user's real behavior. Instead of only storing tasks and deadlines, the application should track how long work actually takes, use historical data to estimate future task duration, and provide analytics showing how time is being spent across classes, categories, and activities.

Version 1 should be usable immediately as a real daily productivity system. It is not intended to be a throwaway prototype. The initial version should have a clean architecture, a real persistent database, authentication, durable task history, and enough analytics to provide useful feedback from the start.

The application should be designed so that more intelligent prediction, calendar integrations, richer analytics, and additional automation can be added later without requiring the core system to be rebuilt.

---

## 2. Purpose

The application exists to solve several related productivity problems:

1. Tasks are often listed without a realistic understanding of how long they will take.
2. Traditional task managers usually require the user to estimate duration manually every time.
3. It is difficult to understand where study time and personal time are actually going.
4. Long task lists can feel overwhelming and make it harder to build momentum.
5. Reading goals are often tracked separately from school and productivity systems.
6. Most systems do not learn from a user's own historical task-completion behavior.

This app should create one system that combines:

- Task management
- Manual prioritization
- Automatic task ordering
- Time tracking
- Historical duration tracking
- Personal task-duration estimates
- Analytics
- Reading tracking
- Daily workload awareness

---

## 3. Product Philosophy

### 3.1 Useful immediately

Version 1 should work as a complete personal productivity system from the first day it is deployed.

The first release should avoid fake-data-only dashboards or placeholder systems. Core features should use the real database and real user data.

### 3.2 Structured before intelligent

The application should first collect high-quality structured data.

Advanced AI should not be used where a transparent deterministic method is sufficient.

For example, task-duration prediction should initially use historical averages or weighted averages rather than an opaque AI model.

The data structure should make more sophisticated prediction possible later.

### 3.3 Manual control remains important

The application should provide automatic suggestions without taking control away from the user.

Examples:

- A task may receive an automatically predicted duration.
- The user can override the duration.
- Tasks may be sorted automatically by estimated length.
- The user can manually prioritize or manually reorder tasks.

### 3.4 Build for personal use first

This application is initially intended for one primary user.

The database and authentication system should still be designed properly so the architecture can support multiple users later if desired.

### 3.5 Preserve historical data

Historical task and time data is one of the most valuable parts of the application.

Completed tasks should not simply disappear.

The system should retain enough information to answer questions such as:

- How long does accounting homework usually take?
- How much time was spent studying this week?
- Which class has required the most time this semester?
- How accurate are duration estimates?
- How much time is spent reading?
- How many tasks were completed this month?
- Which task types are consistently underestimated?

---

# 4. Target User Experience

The app should feel fast, calm, and practical.

The primary workflow should be:

1. Open the app.
2. See today's tasks immediately.
3. Add anything new quickly.
4. See how long the day's workload is expected to take.
5. Start a task timer.
6. Stop the timer when finished.
7. Mark the task complete.
8. Continue to the next task.
9. Review weekly analytics when useful.

The user should not have to navigate through multiple screens simply to add or start a task.

---

# 5. Version 1 Scope

Version 1 should include five primary sections:

1. Today
2. Tasks
3. Analytics
4. Reading
5. History

Authentication and settings may exist outside the main navigation.

---

# 6. Today Dashboard

The Today page is the primary home screen.

It should contain:

- Today's tasks
- Overdue tasks
- Quick-add task control
- Estimated total workload
- Completed workload
- Remaining workload
- Task priority
- Estimated task duration
- Active timer state
- Start/stop task timer controls
- Complete-task control
- Sort controls
- Manual task ordering

## 6.1 Sorting Modes

The user should be able to switch between several sorting modes.

### Momentum

Sort shortest estimated tasks first.

Example:

- 8 minutes
- 15 minutes
- 27 minutes
- 43 minutes
- 80 minutes

The purpose is to allow the user to gain momentum by clearing smaller tasks early.

### Priority

Sort using the user's assigned priority.

Suggested priority values:

- Low
- Medium
- High
- Critical

### Deadline

Sort by nearest due date and time.

### Manual

Use the user's manually saved task order.

Automatic sorting should never permanently overwrite the manually stored order.

---

# 7. Task Management

A user should be able to:

- Create a task
- Edit a task
- Delete a task
- Complete a task
- Reopen a task
- Schedule a task
- Assign a deadline
- Assign a category
- Assign a class/course
- Assign a task type
- Assign a priority
- Enter a manual estimate
- View the predicted estimate
- Start a timer
- View actual time spent
- Add notes

## 7.1 Suggested Task Fields

Each task should support the following information:

- `id`
- `user_id`
- `title`
- `description`
- `category_id`
- `course_id`
- `task_type`
- `priority`
- `status`
- `due_at`
- `scheduled_date`
- `manual_estimate_minutes`
- `predicted_minutes`
- `actual_minutes`
- `difficulty`
- `manual_sort_order`
- `created_at`
- `updated_at`
- `started_at`
- `completed_at`

Some fields may be nullable.

`actual_minutes` may be derived from time-session records rather than treated as the source of truth.

---

# 8. Categories

Categories should not be hardcoded into UI components.

They should be database records.

Example categories:

- School
- Career
- Research
- Reading
- Administrative
- Personal
- Exercise

Suggested fields:

- `id`
- `user_id`
- `name`
- `category_type`
- `color`
- `created_at`

This structure allows categories to be edited later without schema changes.

---

# 9. Courses / Classes

School tasks should optionally connect to a specific course.

Suggested fields:

- `id`
- `user_id`
- `name`
- `course_code`
- `semester`
- `active`
- `created_at`

Example:

- Name: Financial Accounting
- Code: ACCT 201
- Semester: Fall 2026
- Active: true

Courses should be optional because not every task belongs to a class.

---

# 10. Task Types

Task type is separate from category and course.

Examples:

- Homework
- Reading
- Exam Study
- Quiz Study
- Project
- Essay
- Email
- Administrative
- Research
- Meeting Preparation
- Personal Errand

This allows historical duration estimates to compare genuinely similar tasks.

For example:

`ACCT 201 + Homework`

should be a stronger match than:

`School + any task`

---

# 11. Time Tracking

Time tracking should use individual sessions.

A task may have zero, one, or many time sessions.

Suggested fields:

- `id`
- `user_id`
- `task_id`
- `category_id`
- `started_at`
- `ended_at`
- `duration_seconds`
- `session_type`
- `notes`
- `created_at`

Example:

A user works on one assignment twice:

- 3:15 PM to 3:45 PM
- 7:00 PM to 7:25 PM

The task should have two sessions totaling 55 minutes.

This model allows:

- Pause/resume behavior
- Multiple work sessions
- Accurate analytics
- Historical activity analysis
- Better future duration prediction

The timer should not rely only on a browser-side counter. Start time should be persisted so refreshing the page does not lose the session.

---

# 12. Duration Prediction

The initial duration-prediction system should be deterministic and explainable.

It should not require an external AI API.

## 12.1 Matching hierarchy

When predicting a task, use historical completed tasks in roughly this order:

1. Same course + same task type
2. Same course
3. Same category + same task type
4. Same task type
5. Same category
6. General historical average
7. Manual estimate or fallback default if insufficient history exists

## 12.2 Weighted history

Recent tasks should generally matter more than old tasks.

A simple implementation can use a weighted moving average of recent comparable tasks.

Example recent durations:

- 46 minutes
- 57 minutes
- 48 minutes
- 51 minutes
- 42 minutes

A weighted estimate could give the newest observation the largest weight.

The exact algorithm should be isolated in a service or utility so it can be upgraded later without changing UI code.

## 12.3 Prediction transparency

Where useful, the UI may show why an estimate exists.

Example:

> Estimated 49 min based on your last 5 ACCT homework tasks.

This is preferable to presenting an unexplained number.

---

# 13. Reading Tracker

Reading should have a dedicated area.

The system should support multiple books over time and preserve completed-book history.

## 13.1 Books

Suggested fields:

- `id`
- `user_id`
- `title`
- `author`
- `total_pages`
- `current_page`
- `start_date`
- `target_finish_date`
- `weekly_page_goal`
- `status`
- `completed_at`
- `created_at`

Suggested statuses:

- Want to Read
- Reading
- Paused
- Completed

## 13.2 Reading Sessions

Suggested fields:

- `id`
- `user_id`
- `book_id`
- `date`
- `start_page`
- `end_page`
- `pages_read`
- `minutes_read`
- `created_at`

Reading sessions should be the historical source for reading analytics.

## 13.3 Reading Metrics

The Reading screen should support:

- Current page
- Total pages
- Percentage complete
- Pages read today
- Pages read this week
- Weekly page quota
- Average pages per day
- Average reading speed when time is tracked
- Estimated completion date
- Books completed this year

---

# 14. Analytics

Analytics should use the application's real historical data.

Version 1 analytics should include:

- Total focused time this week
- Total focused time this month
- Study time
- Non-study productive time
- Reading time
- Tasks completed
- Average task duration
- Time by category
- Time by course
- Time by day
- Estimated vs. actual task duration
- Prediction error
- Reading progress
- Pages read by week

Analytics should make a clear distinction between:

- Time tracked through the task timer
- Reading time
- Other manually tracked sessions

Charts should remain secondary to readable summary statistics.

---

# 15. History

The History page should make completed data inspectable.

It should support viewing:

- Completed tasks
- Completion dates
- Estimated durations
- Actual durations
- Historical sessions
- Course
- Category
- Task type
- Past books and reading sessions

Filters may include:

- Date range
- Course
- Category
- Task type
- Completed / archived

Historical records should generally be retained instead of hard deleted.

---

# 16. Daily Capacity

The application should calculate the total estimated workload for a day.

Example:

- Available work time: optional/manual in V1
- Estimated scheduled workload: 5h 45m

Future versions may incorporate calendar availability automatically.

Version 1 may begin by simply displaying:

- Total estimated minutes scheduled today
- Completed minutes
- Remaining estimated minutes

This provides the foundation for later capacity planning.

---

# 17. Authentication and Privacy

The application is private.

Version 1 should use authentication.

Recommended authentication provider:

- Supabase Auth

All user-owned records must contain a `user_id` or equivalent ownership relationship.

Row Level Security should be enabled so authenticated users can access only their own data.

Even if there is initially only one user, ownership rules should be implemented correctly.

---

# 18. Recommended Technology Stack

## Frontend

- Next.js
- TypeScript
- React
- Tailwind CSS

## Backend / Database

- Supabase
- PostgreSQL
- Supabase Auth

## Hosting

- Vercel

## Charts

- Recharts or another lightweight React-compatible chart library

## Repository

- GitHub

## Development Environment

- Codex working in a GitHub-backed repository, with project guidance in `AGENTS.md`

Skills may assist with Next.js, Supabase/Postgres, browser verification, and security review. They are development aids, not runtime dependencies or app features. See `BUILD_PLAN.md` for the staged recommendations.

---

# 19. Design Principles

The interface should be:

- Minimal
- Fast
- Mobile-responsive
- Desktop-friendly
- Easy to scan
- Low-friction
- Consistent
- Data-dense without feeling cluttered

Avoid unnecessary decorative complexity.

The Today screen should prioritize action over analytics.

The Analytics screen can be more data-dense.

The application should work well on:

- Desktop
- Laptop
- iPad
- Mobile browser

It should be possible to add the hosted web app to an iPhone or iPad Home Screen.

A later version may become a Progressive Web App.

---

# 20. Data Integrity Principles

The application should follow these rules:

1. Time-session data is the source of truth for actual tracked time.
2. Completed tasks should remain available historically.
3. Database changes should use migrations.
4. Production schema changes should not be made casually by hand.
5. Foreign keys should be used where appropriate.
6. Destructive deletes should be avoided where historical analytics depend on records.
7. Row Level Security should be enabled for user-owned tables.
8. Validation should exist on both form inputs and server/database boundaries where appropriate.
9. Dates and times should be stored consistently.
10. UI-derived analytics should be reproducible from database records.

---

# 21. Out of Scope for Initial V1

The following features should generally be deferred until the core system is stable:

- Complex machine-learning models
- AI-generated task descriptions
- Automatic email parsing
- LMS assignment scraping
- Full Google Calendar synchronization
- Team accounts
- Social features
- Gamification-heavy systems
- Native iOS application
- Push-notification infrastructure
- Voice input
- Advanced recurring-task engine
- Public marketplace
- Public user profiles

The architecture should not intentionally prevent these features, but they should not slow down Version 1.

---

# 22. Future Opportunities

Potential later additions include:

- Google Calendar integration
- Automatic daily capacity based on calendar events
- Recurring tasks
- Assignment import
- Natural-language task entry
- AI weekly productivity summaries
- Smarter task-duration models
- Deadline-risk alerts
- Task dependencies
- Study-session recommendations
- Course-level semester analytics
- Focus streaks
- PWA installation and notifications
- Native iOS version
- Data export
- CSV import
- Backup and restore
- Calendar time-blocking
- Daily or weekly planning assistant

---

# 23. Definition of Version 1 Success

Version 1 is successful when the user can reliably:

1. Sign in.
2. Create and organize tasks.
3. See today's workload.
4. Sort tasks by shortest duration, priority, deadline, or manual order.
5. Start and stop a task timer.
6. Preserve multiple time sessions.
7. Complete tasks.
8. Use historical data to receive useful duration estimates.
9. See meaningful analytics by class/category.
10. Track books and weekly page goals.
11. Review historical work.
12. Access the application privately from desktop and mobile.
13. Refresh or close the app without losing important state.
14. Continue evolving the product without having to rewrite the database or core architecture.

The objective is not to build every possible productivity feature.

The objective is to create a reliable personal system that is useful immediately and becomes more valuable as historical data accumulates.
