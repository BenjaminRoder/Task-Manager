# Personal Task Manager — Build Instructions and Living Implementation Plan

## 1. Purpose of This Document

This document is the implementation guide for the Personal Task Manager.

It is intended to be used directly by Codex in the project's Git repository.

The agent should treat this document as a living implementation plan.

The project should be built incrementally, tested frequently, committed to Git regularly, and kept deployable throughout development.

Do not attempt to implement the entire application in one uncontrolled pass.

## Codex setup and skill recommendations

Keep `AGENTS.md` at the repository root for durable project instructions. Keep feature requirements in `PROJECT_OVERVIEW.md` and milestone status in this file. Codex skills provide focused workflows; they are not application dependencies and do not change the V1 scope.

Recommended skills to enable as the relevant work begins:

| Skill | Use for | Timing |
| --- | --- | --- |
| [Next.js Best Practices](https://github.com/openai/plugins/blob/main/plugins/vercel/skills/nextjs/SKILL.md) | App Router structure, server/client boundaries, authentication routes, and deployment conventions | Setup and application shell |
| [React Best Practices](https://github.com/openai/plugins/blob/main/plugins/build-web-apps/skills/react-best-practices/SKILL.md) | Responsive components, data fetching, rendering, and performance | UI milestones |
| [Supabase Postgres Best Practices](https://github.com/openai/plugins/blob/main/plugins/supabase/skills/supabase-postgres-best-practices/SKILL.md) | Schema, migrations, indexes, queries, and Row Level Security | Database and analytics milestones |
| [Playwright CLI](https://github.com/openai/skills/blob/main/skills/.curated/playwright/SKILL.md) | Real-browser checks of task entry, sorting, timer refresh, reading, and mobile layouts | Each completed user-facing flow |
| [Security Best Practices](https://github.com/openai/skills/blob/main/skills/.curated/security-best-practices/SKILL.md) | Explicit TypeScript/web security review, including auth and privacy risks | Security milestone before deployment |

Install only the useful skills in the Codex environment, or place a project-specific skill under `.agents/skills/` when a repeatable workflow emerges. Do not copy third-party skill instructions into `AGENTS.md`. Confirm availability before naming a skill in a Codex prompt. Skill installation is optional for implementation; the acceptance criteria and tests below remain authoritative.

---

# 2. Required Engineering Approach

## 2.1 Work incrementally

Implement one coherent milestone at a time.

For each milestone:

1. Inspect the existing repository before editing.
2. Review this document and `PROJECT_OVERVIEW.md`.
3. Plan the change.
4. Make the smallest coherent set of changes.
5. Run relevant tests, type checks, linting, and build checks.
6. Verify the feature manually where feasible.
7. Update this checklist.
8. Record implementation notes.
9. Commit the working milestone to Git.

Avoid stacking many unverified changes.

---

## 2.2 Preserve architectural consistency

Before creating a new component, utility, API route, hook, service, database table, or pattern:

- Search the repository for an existing equivalent.
- Reuse established conventions.
- Do not create duplicate abstractions.
- Do not silently replace architectural patterns.

If the architecture must change, document why.

---

## 2.3 Do not hide failures

The agent must not:

- Silence TypeScript errors using broad `any` types without justification.
- Disable lint rules merely to make checks pass.
- Swallow application errors without logging or user feedback.
- Remove failing tests simply because they fail.
- Hardcode production secrets.
- Bypass Row Level Security.
- Replace real database operations with mock data unless explicitly working in a test fixture.

---

# 3. Recommended Stack

Use:

- Next.js
- TypeScript
- React
- Tailwind CSS
- Supabase
- PostgreSQL
- Supabase Auth
- Vercel
- Recharts or another lightweight chart library
- GitHub

Prefer stable, maintained dependencies.

Avoid unnecessary libraries when the platform or existing stack already provides the needed capability.

---

# 4. Repository Structure

A suggested structure is:

```text
task-manager/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   │   ├── today/
│   │   ├── tasks/
│   │   ├── analytics/
│   │   ├── reading/
│   │   └── history/
│   ├── api/
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── tasks/
│   ├── timer/
│   ├── analytics/
│   ├── reading/
│   ├── navigation/
│   └── ui/
│
├── lib/
│   ├── supabase/
│   ├── analytics/
│   ├── estimation/
│   ├── validation/
│   └── utils/
│
├── types/
│
├── supabase/
│   ├── migrations/
│   └── seed.sql
│
├── tests/
│
├── public/
│
├── PROJECT_OVERVIEW.md
├── BUILD_PLAN.md
├── AGENTS.md
├── README.md
├── package.json
└── .env.example
```

Adapt this if the current framework version or repository conventions require a different arrangement.

---

# 5. Agent Rules

The coding agent should follow these rules throughout the project.

## Code Quality

- Use TypeScript.
- Prefer explicit types for business-domain objects.
- Keep business logic out of presentation components.
- Keep task-estimation logic isolated from UI code.
- Keep analytics calculations isolated from chart components.
- Prefer small composable functions.
- Avoid excessively large components.
- Use descriptive names.
- Do not introduce abstractions unless they reduce real duplication or complexity.

## Database

- Use migrations for schema changes.
- Use foreign keys.
- Use timestamps consistently.
- Enable Row Level Security on user-owned tables.
- Ensure ownership policies use the authenticated user.
- Do not trust client-provided user IDs.
- Avoid hard deletion where historical analytics depend on the record.
- Add indexes for frequently filtered foreign keys and date fields where appropriate.

## UI

- Build mobile-responsive screens from the beginning.
- Preserve accessibility.
- Use clear loading, empty, success, and error states.
- Do not block primary workflows behind unnecessary modals.
- Optimize the Today page for speed of use.

## Verification

After meaningful changes, run whichever commands exist in the repository for:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

If scripts differ, inspect `package.json` and use the correct equivalents.

Do not claim completion if relevant checks fail.

---

# 6. Environment Setup

## Task 1 — Initialize Repository

- [ ] Create a Git repository.
- [ ] Create the Next.js application.
- [ ] Enable TypeScript.
- [ ] Configure Tailwind CSS.
- [ ] Confirm the application runs locally.
- [ ] Add `.gitignore`.
- [ ] Add `.env.example`.
- [ ] Add `PROJECT_OVERVIEW.md`.
- [ ] Add `BUILD_PLAN.md`.
- [ ] Add `AGENTS.md`.
- [ ] Open the repository in Codex and confirm root `AGENTS.md` is loaded.
- [ ] Check availability of the recommended skills for the first milestone; add only those that fit current work.
- [ ] Make initial Git commit.

### Acceptance Criteria

- Local dev server starts successfully.
- TypeScript works.
- Tailwind styles render.
- Repository contains no secrets.
- Initial commit exists.

### Implementation Notes

_Add notes here when complete._

---

# 7. Supabase Setup

## Task 2 — Connect Supabase

- [ ] Create Supabase project.
- [ ] Add required environment variables.
- [ ] Create browser/client Supabase helper.
- [ ] Create server Supabase helper.
- [ ] Confirm a server-side database request succeeds.
- [ ] Add typed database support if generated types are used.
- [ ] Document local environment setup in README.

### Acceptance Criteria

- Local app can connect to Supabase.
- Secrets are not committed.
- Server/client boundaries are clear.
- A simple connection test succeeds.

### Implementation Notes

_Add notes here when complete._

---

# 8. Authentication

## Task 3 — Implement Authentication

- [ ] Implement sign-in.
- [ ] Implement sign-out.
- [ ] Add route protection.
- [ ] Redirect unauthenticated users appropriately.
- [ ] Confirm authenticated user identity is accessible server-side.
- [ ] Add basic account/profile display if useful.

### Acceptance Criteria

- Unauthenticated users cannot access private dashboard pages.
- Authenticated user persists across page refresh.
- Logout invalidates access.
- No database query depends on a user ID supplied directly from an untrusted form.

### Implementation Notes

_Add notes here when complete._

---

# 9. Database Schema

## Task 4 — Create Core Schema

Create migrations for the following tables.

### `categories`

Suggested columns:

```text
id
user_id
name
category_type
color
created_at
updated_at
```

### `courses`

```text
id
user_id
name
course_code
semester
active
created_at
updated_at
```

### `tasks`

```text
id
user_id
title
description
category_id
course_id
task_type
priority
status
due_at
scheduled_date
manual_estimate_minutes
predicted_minutes
difficulty
manual_sort_order
created_at
updated_at
started_at
completed_at
archived_at
```

### `time_sessions`

```text
id
user_id
task_id
category_id
started_at
ended_at
duration_seconds
session_type
notes
created_at
updated_at
```

### `books`

```text
id
user_id
title
author
total_pages
current_page
start_date
target_finish_date
weekly_page_goal
status
completed_at
created_at
updated_at
```

### `reading_sessions`

```text
id
user_id
book_id
date
start_page
end_page
pages_read
minutes_read
created_at
updated_at
```

### Required Schema Work

- [ ] Create tables through migrations.
- [ ] Add primary keys.
- [ ] Add foreign keys.
- [ ] Add useful check constraints.
- [ ] Add indexes for user/date filtering where appropriate.
- [ ] Add `updated_at` handling.
- [ ] Enable Row Level Security.
- [ ] Add ownership policies.
- [ ] Test RLS using two test users if practical.
- [ ] Generate/update TypeScript database types if used.

### Acceptance Criteria

- Migrations apply from a clean database.
- Authenticated users can CRUD only their own eligible records.
- Cross-user reads/writes are rejected.
- Foreign-key relationships work.
- Schema is reproducible from migration files.

### Implementation Notes

_Add notes here when complete._

---

# 10. Seed and Development Data

## Task 5 — Add Development Seed Data

- [ ] Add optional development seed categories.
- [ ] Add sample courses.
- [ ] Add sample tasks.
- [ ] Add sample historical time sessions.
- [ ] Add a sample book and reading sessions.
- [ ] Ensure production does not depend on seed data.

### Acceptance Criteria

- Development environment can be populated quickly.
- Seed data respects schema constraints.
- App still works with an empty database.

### Implementation Notes

_Add notes here when complete._

---

# 11. Application Shell

## Task 6 — Build Main Layout and Navigation

Main navigation:

- Today
- Tasks
- Analytics
- Reading
- History

Required:

- [ ] Desktop navigation.
- [ ] Mobile navigation.
- [ ] Active route state.
- [ ] User/logout control.
- [ ] Responsive page container.
- [ ] Shared loading/error patterns.

### Acceptance Criteria

- All sections are reachable.
- Navigation works on desktop and mobile.
- No horizontal overflow on common mobile widths.

### Implementation Notes

_Add notes here when complete._

---

# 12. Task CRUD

## Task 7 — Build Task Management

Implement:

- [ ] Create task.
- [ ] Edit task.
- [ ] Complete task.
- [ ] Reopen task.
- [ ] Archive/delete task behavior.
- [ ] Assign category.
- [ ] Assign course.
- [ ] Assign task type.
- [ ] Assign priority.
- [ ] Assign due date/time.
- [ ] Assign scheduled date.
- [ ] Enter manual estimate.
- [ ] Add notes/description.
- [ ] Validate input.

### Acceptance Criteria

- CRUD uses real Supabase data.
- Refresh does not lose changes.
- Completed tasks retain historical data.
- Errors are visible and actionable.
- Empty states exist.

### Implementation Notes

_Add notes here when complete._

---

# 13. Today Dashboard

## Task 8 — Build Today Page

Required sections:

- [ ] Today task list.
- [ ] Overdue task section.
- [ ] Quick-add task.
- [ ] Total estimated workload.
- [ ] Completed workload.
- [ ] Remaining workload.
- [ ] Start timer control.
- [ ] Complete task control.
- [ ] Sorting selector.

Sorting modes:

- [ ] Momentum.
- [ ] Priority.
- [ ] Deadline.
- [ ] Manual.

### Momentum Rule

Order incomplete tasks by best available duration:

1. predicted duration
2. manual estimate
3. fallback estimate

Shortest first.

### Manual Ordering

- [ ] Persist manual order.
- [ ] Drag-and-drop or equivalent reordering.
- [ ] Automatic sort must not destroy manual order.

### Acceptance Criteria

- Today's tasks load correctly.
- Overdue tasks are visually distinguishable.
- Sorting changes immediately.
- Manual order survives refresh.
- Estimated daily workload is correct.

### Implementation Notes

_Add notes here when complete._

---

# 14. Timer System

## Task 9 — Implement Persistent Timer

Required behavior:

- [ ] Start task session.
- [ ] Stop task session.
- [ ] Persist start timestamp immediately.
- [ ] Support multiple sessions per task.
- [ ] Restore active timer after refresh.
- [ ] Prevent accidental duplicate active sessions.
- [ ] Calculate task total actual duration.
- [ ] Display active elapsed time.
- [ ] Handle abandoned/open sessions safely.

### Important

The browser counter is not the source of truth.

The database start timestamp is the source of truth.

Elapsed display should be reconstructed from persisted timestamps.

### Acceptance Criteria

- Start a timer.
- Refresh the page.
- Timer continues correctly.
- Stop it.
- Stored session duration is correct.
- Start a second session.
- Total task duration equals both sessions combined.

### Implementation Notes

_Add notes here when complete._

---

# 15. Duration Estimation

## Task 10 — Implement V1 Prediction Engine

Create estimation logic outside React components.

Suggested location:

```text
lib/estimation/
```

Matching hierarchy:

1. same course + same task type
2. same course
3. same category + same task type
4. same task type
5. same category
6. general completed-task history
7. manual/default fallback

Required:

- [ ] Query historical comparable tasks.
- [ ] Derive actual duration from time sessions.
- [ ] Implement weighted recent average.
- [ ] Require a reasonable minimum history before displaying a strong prediction.
- [ ] Return metadata describing prediction source.
- [ ] Store or update predicted duration where appropriate.
- [ ] Allow manual estimate to remain visible separately.

Possible return shape:

```ts
type DurationPrediction = {
  minutes: number | null
  confidence: "low" | "medium" | "high"
  sampleSize: number
  source:
    | "course_task_type"
    | "course"
    | "category_task_type"
    | "task_type"
    | "category"
    | "global"
    | "fallback"
}
```

### Acceptance Criteria

- Same task history influences future prediction.
- Recent comparable tasks receive more influence.
- Prediction does not silently replace a user's manual estimate.
- No-history case behaves sensibly.
- Unit tests cover estimator behavior.

### Implementation Notes

_Add notes here when complete._

---

# 16. Reading Tracker

## Task 11 — Build Reading Section

Required:

- [ ] Add book.
- [ ] Edit book.
- [ ] Mark book completed.
- [ ] Update current page.
- [ ] Set weekly page target.
- [ ] Add reading session.
- [ ] Store pages read.
- [ ] Store minutes read.
- [ ] Display current progress.
- [ ] Display weekly quota progress.
- [ ] Calculate average pages/day.
- [ ] Estimate completion date.
- [ ] Show completed-book history.

### Acceptance Criteria

- Reading progress persists.
- Page counts are validated.
- Weekly quota is calculated from reading sessions.
- Completion projection handles insufficient history gracefully.

### Implementation Notes

_Add notes here when complete._

---

# 17. Analytics

## Task 12 — Build Analytics Service

Do not put core analytics math directly inside chart components.

Suggested location:

```text
lib/analytics/
```

Required metrics:

- [ ] Total tracked time this week.
- [ ] Total tracked time this month.
- [ ] Study time.
- [ ] Reading time.
- [ ] Time by category.
- [ ] Time by course.
- [ ] Time by day.
- [ ] Tasks completed.
- [ ] Average task duration.
- [ ] Estimated vs actual duration.
- [ ] Prediction error.
- [ ] Pages read per week.

### Acceptance Criteria

- Metrics are derived from real session/task data.
- Date boundaries are handled consistently.
- Analytics logic is testable without rendering charts.

### Implementation Notes

_Add notes here when complete._

---

# 18. Analytics UI

## Task 13 — Build Analytics Page

Recommended layout:

### Summary Cards

- Focus time this week
- Study time
- Reading time
- Tasks completed

### Charts

- Time by category
- Time by course
- Time by day
- Estimated vs actual
- Reading pages by week

Required:

- [ ] Responsive layout.
- [ ] Empty states.
- [ ] Human-readable duration formatting.
- [ ] Date-period selector if feasible.

### Acceptance Criteria

- Charts match underlying metrics.
- Mobile view remains readable.
- Dashboard remains useful with limited history.

### Implementation Notes

_Add notes here when complete._

---

# 19. History

## Task 14 — Build History Page

Required:

- [ ] Completed task list.
- [ ] Task completion date.
- [ ] Estimated duration.
- [ ] Actual duration.
- [ ] Category.
- [ ] Course.
- [ ] Task type.
- [ ] Session history.
- [ ] Basic filters.
- [ ] Completed book history.

### Acceptance Criteria

- Historical tasks remain inspectable.
- History is not dependent on currently active courses/categories.
- Filters operate correctly.

### Implementation Notes

_Add notes here when complete._

---

# 20. Reliability and UX Pass

## Task 15 — Add Application Resilience

Required:

- [ ] Loading states.
- [ ] Empty states.
- [ ] Error states.
- [ ] Form validation.
- [ ] Confirmation for destructive actions where appropriate.
- [ ] Timer edge-case handling.
- [ ] Optimistic updates only where safe.
- [ ] Prevent double submissions.
- [ ] Mobile responsiveness review.
- [ ] Keyboard-accessibility review.
- [ ] Basic accessibility labels.

### Acceptance Criteria

- Common user errors do not break app state.
- Refreshing during normal workflows is safe.
- No obvious console errors during core flows.
- Mobile flows are usable.

### Implementation Notes

_Add notes here when complete._

---

# 21. Automated Testing

## Task 16 — Add Core Tests

Prioritize business-critical logic.

Required tests:

- [ ] Duration estimator.
- [ ] Time-session aggregation.
- [ ] Daily workload calculation.
- [ ] Reading quota calculation.
- [ ] Analytics date grouping.
- [ ] Task sorting.
- [ ] Priority ordering.
- [ ] Deadline ordering.

Where practical, add integration tests for:

- [ ] Authentication-protected routes.
- [ ] Task creation.
- [ ] Timer lifecycle.
- [ ] Reading-session creation.

### Acceptance Criteria

- Critical calculation logic has automated coverage.
- Tests run consistently from a documented command.
- Tests do not depend on random production data.

### Implementation Notes

_Add notes here when complete._

---

# 22. Security Review

## Task 17 — Security and Data Review

Verify:

- [ ] No secrets are committed.
- [ ] `.env.example` contains placeholders only.
- [ ] RLS enabled.
- [ ] RLS policies tested.
- [ ] Server operations do not trust arbitrary `user_id`.
- [ ] Input validation exists.
- [ ] Dangerous HTML injection is avoided.
- [ ] Dependency audit reviewed.
- [ ] Logs do not expose credentials/tokens.
- [ ] Production environment variables are configured securely.

### Acceptance Criteria

- Cross-user data access is rejected.
- No credentials exist in Git history.
- Core production data is private by default.

### Implementation Notes

_Add notes here when complete._

---

# 23. Deployment

## Task 18 — Deploy V1

Recommended host:

- Vercel

Required:

- [ ] Connect GitHub repository.
- [ ] Configure environment variables.
- [ ] Deploy production build.
- [ ] Configure Supabase production URLs.
- [ ] Confirm authentication works on deployed domain.
- [ ] Confirm database operations work.
- [ ] Confirm timer works.
- [ ] Verify mobile browser layout.
- [ ] Test Add to Home Screen behavior if desired.

### Acceptance Criteria

- Application is accessible through a private authenticated URL.
- Production build completes successfully.
- Core flows work from desktop and mobile.

### Implementation Notes

_Add notes here when complete._

---

# 24. V1 Final Acceptance Test

## Task 19 — Full End-to-End Verification

Perform the following real workflow:

- [ ] Create account/sign in.
- [ ] Create categories.
- [ ] Create a course.
- [ ] Create several tasks.
- [ ] Assign different priorities.
- [ ] Schedule tasks for today.
- [ ] Confirm Momentum sort.
- [ ] Confirm Priority sort.
- [ ] Confirm Deadline sort.
- [ ] Reorder tasks manually.
- [ ] Refresh and verify manual order persists.
- [ ] Start a task timer.
- [ ] Refresh while timer is active.
- [ ] Stop timer.
- [ ] Start a second session.
- [ ] Complete the task.
- [ ] Confirm history shows correct actual duration.
- [ ] Create enough comparable tasks to exercise prediction.
- [ ] Confirm prediction appears.
- [ ] Add a book.
- [ ] Add reading sessions.
- [ ] Confirm weekly quota.
- [ ] Confirm analytics reflect task sessions.
- [ ] Test core flows on mobile width.
- [ ] Run lint.
- [ ] Run type checks.
- [ ] Run tests.
- [ ] Run production build.

### V1 Completion Criteria

V1 is complete only when:

- Core workflows function against real persisted data.
- Authentication and RLS are working.
- The app can be deployed.
- Timer state survives refresh.
- Historical data is preserved.
- Analytics use real historical data.
- Reading goals are functional.
- The repository passes its required quality checks.

### Implementation Notes

_Add final V1 notes here._

---

# 25. Recommended Git Strategy

Use small commits.

Examples:

```text
chore: initialize nextjs project
feat: add supabase authentication
feat: create core task schema
feat: implement task CRUD
feat: add persistent task timer
feat: add duration prediction engine
feat: build reading tracker
feat: add analytics dashboard
fix: restore active timer after refresh
test: cover duration estimator
```

Do not allow many unrelated features to accumulate in one commit.

Before risky refactors, ensure the current state is committed.

---

# 26. Recommended Codex Workflow

For significant features:

1. Open the Git repository in Codex and give it the relevant task number from this file.
2. For a large or ambiguous feature, ask Codex to make a short implementation plan.
3. Have Codex inspect the current code and implement one coherent milestone.
4. Review the diff and exercise the affected workflow in the running app.
5. Run the relevant checks and resolve failures.
6. Update the checklist and implementation notes, then commit the verified milestone.

Use a separate Git branch or worktree for genuinely independent workstreams. Coordinate before editing the same core files or database migrations in parallel.

---

# 27. Repository `AGENTS.md`

The repository already has an `AGENTS.md` draft. Add that file at the repository root when initializing the project and keep it concise. It should point to the product overview and the relevant checklist task, define durable engineering rules, and explain the verification and checklist update cycle. Keep milestone details in this file so the two documents do not drift.

Codex reads root-level `AGENTS.md` when working in the repository. Confirm it has loaded the file when the repository is created.

---

# 28. Living Checklist Protocol — REQUIRED FOR ALL AGENTS

This section is mandatory.

Every coding agent working on this repository must treat this file as a living project tracker.

## When a Task Is Completed

The agent must:

1. Locate the relevant task in this Markdown file.
2. Change completed checklist items from:

```md
- [ ] Item
```

to:

```md
- [x] Item
```

3. Do not check an item merely because code was written.
4. Check it only after the implementation has been verified against its acceptance criteria.
5. Add a concise entry under that task's `Implementation Notes` section.

Example:

```md
### Implementation Notes

- 2026-09-28: Added Supabase email/password authentication.
- Protected `/today`, `/tasks`, `/analytics`, `/reading`, and `/history`.
- Verified session persistence after refresh.
- `npm run lint`, `npm run typecheck`, and `npm run build` pass.
```

## If a Task Is Partially Complete

Leave unfinished items unchecked.

Document partial progress:

```md
### Implementation Notes

- Task CRUD implemented.
- Edit flow complete.
- Delete/archive behavior still requires confirmation.
```

## If the Implementation Changes the Plan

The agent may update this file when new technical information requires a change.

When doing so:

1. Preserve the original product intent.
2. Explain the change in Implementation Notes.
3. Add new checklist items when new required work is discovered.
4. Do not silently remove unfinished requirements.
5. If a requirement is no longer appropriate, mark it explicitly as superseded and explain why.

Example:

```md
- [ ] ~~Use library X~~ — Superseded: incompatible with Next.js version used by project.
- [ ] Implement equivalent behavior using library Y.
```

## At the End of Every Agent Work Session

The agent should summarize:

- What was completed
- Which checklist items were checked
- What files changed
- What validation was run
- Any unresolved problems
- The next recommended task

The agent must leave `BUILD_PLAN.md` accurate enough that a different agent can open the repository later and understand the current state without relying on previous chat history.

## Source of Truth Rule

For project implementation status:

**The repository and this checklist are the source of truth, not the agent's conversation history.**

If conversation context conflicts with the repository, inspect the code and update the documentation to reflect verified reality.

The goal is for the project to remain understandable and maintainable even when different agents or models work on it over time.
