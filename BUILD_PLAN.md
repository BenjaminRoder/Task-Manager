# Personal Task Manager — Build Instructions and Living Implementation Plan

## Week calendar setup checkpoint — scaffold verified, features pending — 2026-10-04

### Scope and Git evidence

- [x] Survey and compile-safe setup only, verified below. This supersedes the older Stage 0 pending status; no Phase 1 or Phase 2 feature is complete.
- Actual repository/package root: `C:/Users/jacku/OneDrive/Desktop/Projects/Task-Manager/Task-Manager` (the outer directory is not a Git repository).
- Created and switched to `experiment/week-calendar` from local `main`, base HEAD `836802429404421eeaa2fea3d46c9f888b2bcfae`. The experiment branch did not previously exist. Local main was not updated.
- Initial index was empty. Existing unstaged edits to `AGENTS.md`, `BUILD_PLAN.md`, `PROJECT_OVERVIEW.md`, and `README.md`, plus untracked `.Rhistory`, were preserved. The setup commit includes only this new checkpoint and the ten scaffold files; earlier user documentation edits remain unstaged. No reset, clean, overwrite of user edits, or stash.
- Read the four available context documents and relevant Week, hosted M4–M5, classification, estimation, timer and Reading checkpoints. `WEEK_CALENDAR_PROMPTS.md`, referenced by the context, is absent from the workspace. The user's attached setup instructions and existing overview/checkpoint provide this stage's scope; the missing sequential prompt file remains a handoff gap, not permission to begin either feature phase.

### Verified implementation map

| Concern | Actual paths and behavior |
| --- | --- |
| Week route/rendering | `app/week/page.tsx` mounts `components/tasks/week-board.tsx`, which mounts `components/tasks/week-calendar.tsx`. Restructure this destination in future; do not add another Week route. Styling is in `app/globals.css`. |
| Loading/providers | `app/layout.tsx` wraps content in `components/auth/auth-gate.tsx`. Its account-keyed workspace installs `lib/supabase/repository-context.tsx` and `lib/timers/timer-provider.tsx`. `lib/tasks/use-tasks.ts` loads retained tasks plus categories/courses/task types/topics through `lib/supabase/repositories.ts`, derives predictions from timer history, filters deleted tasks for display, and reloads after mutations/focus. |
| Weekend actual time | `components/tasks/week-calendar.tsx` maps all seven `days` identically; Saturday/Sunday have no separate components. Every task button includes `ActualTime` from `components/timers/task-timer.tsx`. Actuals use `lib/timers/timer-provider.tsx`, `lib/timers/timer-rules.ts`, and `lib/supabase/time-session-repository.ts`; preserve these and `components/timers/time-history.tsx`. |
| Due-date editor | `components/tasks/task-form.tsx`: submit reads `dueDate`; the optional input has `name="dueDate"`, `type="date"`. There is no due-time field. Week edits through this shared form and exposes lifecycle/timer actions through `components/tasks/task-row.tsx`. Today/Tasks share it through `components/tasks/task-board.tsx`. |
| Sorting/duration | `lib/tasks/week-rules.ts` builds Monday–Sunday by due date and calls Momentum sorting. `lib/tasks/task-rules.ts` puts incomplete tasks first, then mode order, creation timestamp and ID. `lib/estimation/duration-estimation.ts` chooses valid manual estimate, valid prediction, then 25 minutes; completed tasks contribute no remaining workload. Calendar arithmetic uses date stepping, not elapsed 24-hour intervals. |
| Classification | `types/course.ts`, `types/task-type.ts`, `types/task.ts`; `lib/classification/classification-rules.ts`, `course-repository.ts`, `task-type-repository.ts`; `components/classification/classification-manager.tsx`; shared form and Supabase mappings. Stable IDs, nullable assignments and retained archives are already supported. Topics are separate in `types/topic.ts`, `lib/classification/topic-rules.ts`, `topic-repository.ts` and `components/classification/topic-manager.tsx`. |
| Preferences | No persisted UI sorting preference/helper exists in `app`, `components` or `lib`; TaskBoard uses component state. `lib/storage/local-store.ts` uses recovery keys `personal-task-manager.tasks.v1` and `personal-task-manager.data.v2`, with guarded storage access. `lib/storage/local-import.ts` scopes import markers by project/account/dataset. These are recovery conventions, not a calendar-preference implementation; future account-scoped preference hydration/fallback must be added deliberately. |
| Domain/validation/recovery | `types/task.ts`, `lib/tasks/task-rules.ts`; `lib/storage/local-store.ts` validates v2 and migrates v1 while preserving originals, rejecting unsupported classification/topic-bearing recovery snapshots. `lib/storage/local-import.ts` canonicalizes/fingerprints fields and invokes `import_local_data`. `components/auth/auth-gate.tsx` offers explicit import consent. |
| All task save paths | `components/tasks/task-board.tsx` create/update and `components/tasks/week-board.tsx` update call `useTasks().mutate`. `lib/supabase/repositories.ts` uses `taskFields`/`taskFromRow`, direct insert for creation without selected topics, direct update when topic IDs are omitted, and `saveWithTopics`/`save_task_with_topics` for topic-aware writes. Status/reopen and soft removal use direct partial updates. `lib/tasks/task-repository.ts` retains local create/update/status/remove for recovery/tests. Import writes through `lib/storage/local-import.ts` and the explicit task field list in `supabase/migrations/202609290001_milestone2.sql`; atomic topic saves have explicit insert/update field lists in `202610030003_task_topics.sql`. All must be considered when adding due time. |

### Scaffold inventory and boundaries

- [x] Domain types: `types/calendar-event.ts`, `types/recurring-class-pattern.ts`, `types/calendar-occurrence.ts`.
- [x] Repository interfaces: `lib/calendar/event-repository.ts`, `lib/calendar/recurring-class-repository.ts`. Account ownership belongs to future authenticated adapters and database constraints, never caller-supplied input. Archive/restore is represented by `setArchived`; lists include archives, and no delete method exists.
- [x] Dedicated type-only module shells: `lib/calendar/event-rules.ts`, `lib/calendar/weekly-recurrence.ts`. They export function signatures as types only, with no callable implementation or fabricated results.
- [x] Unmounted, null-returning component shells: `components/calendar/calendar-grid.tsx`, `components/calendar/event-block.tsx`, `components/calendar/calendar-sidebar.tsx`.

Dates/times are floating local YYYY-MM-DD/HH:mm strings, not UTC instants. Weekly patterns use the existing JavaScript weekday convention (Sunday 0 through Saturday 6); the tuple requires a nonempty weekday set, with uniqueness and valid same-day times left for future validation. Optional date bounds are inclusive. Patterns and events are retained persisted-record contracts; occurrences are read-only derived data with event identity or pattern+date identity, with no occurrence repository, exceptions, or overrides. No adapters, providers, fetches, routes, navigation, styles, migrations, or existing runtime behavior changed.

### Migration/test survey and verification

Existing migration order is `supabase/migrations/202609290001_milestone2.sql`, `202609300001_time_sessions.sql`, `202610030001_optional_manual_estimate.sql`, `202610030002_task_classification.sql`, `202610030003_task_topics.sql`, `202610030004_reading.sql`, then **`202610040001_analytics.sql`**. Future calendar migrations must follow the actual latest migration. No migration was authored or applied by setup.

Relevant tests: `tests/categories-week.test.ts`, `tasks.test.ts`, `estimation.test.ts`, `classification-estimation.test.ts`, `classification-repository.test.ts`, `topics.test.ts`, `supabase.test.ts`, `timers.test.ts`, `timer-repository.test.ts`; embedded PostgreSQL coverage in `tests/database.test.ts`, `classification-database.test.ts`, `topics-database.test.ts`, `estimation-database.test.ts`, `reading-database.test.ts`, `analytics-database.test.ts`. `supabase/tests/timer_acceptance.sql` is the existing rollback-only hosted script, not run here. Browser scripts are `tests/browser/verify-classification-ui.mjs` (includes Week), `verify-reading-ui.mjs`, and `verify-analytics-ui.mjs`, with their corresponding explicit fixture components. No signed-in/browser/hosted QA was needed for unmounted scaffold-only changes.

- [x] Before scaffold edits: `npm run lint`, `npm run typecheck`, `npm run build`, and `npm test` passed (98/98 tests).
- [x] After scaffold edits: the same four commands passed (98/98 tests; zero failures/skips). No baseline or introduced check failures. Existing tests were retained; no behavior-mirroring scaffold tests added.
- Shell sandbox initialization failed with `helper_unknown_error: setup refresh had errors`; approved escalated local shell execution provided a working fallback. This did not require hosted access.
- Concrete context discrepancy: Analytics already exists in `app/analytics/page.tsx`, `components/analytics/analytics-board.tsx`, `lib/analytics/`, `lib/supabase/analytics-repository.ts`, `types/analytics.ts`, and the latest migration/tests. Older statements that M6 has not started (and README claims that Reading/predictions are deferred) are historical/stale, not the current source state. This survey does not establish hosted Analytics migration/acceptance. No Analytics work was performed; user-edited context files and historical acceptance evidence were preserved.

### Remaining scope

Phase 1 remains entirely pending: nullable due time with migration/RPC/mapping/validation/recovery coverage, compact accessible task rows, shortest-first/course/type organization with account-scoped preference, and removal of weekend inline actual time only. Effective duration remains primary in shortest-first mode; due time breaks ties. Course/type groups order timed deadlines before untimed work, with stable ties and existing completed placement. Existing date-only tasks remain untimed; clearing date must clear time. Automatic organization must not rewrite manual priority/order.

Phase 2 remains entirely pending: owned event/class schema and adapters with retention/restore and compound ownership/RLS tests, pure weekly expansion, clipped interval-union availability, accessible overlapping calendar blocks and create/edit/archive/restore controls, and courses/quick-task/availability sidebar in the existing Week view. Default planning window is 08:00–22:00; task estimates stay separate from recorded calendar availability. Preserve timers, estimation and Reading. Feature validation and hosted acceptance remain pending; no Phase 1/2 commit, push, merge, deployment, or hosted migration is authorized by setup.

---

## 1. Purpose of This Document

This document is the implementation guide for the Personal Task Manager.

It is intended to be used directly by Codex in the project's Git repository.

The agent should treat this document as a living implementation plan.

The project should be built incrementally, tested frequently, committed to Git regularly, and kept deployable throughout development.

Do not attempt to implement the entire application in one uncontrolled pass.

## Clear Studio visual reskin — verified 2026-10-04

### Implementation Notes

- 2026-10-04: Restyled existing selectors in app/globals.css with the exact Clear Studio light/dark palette, orange action/active states, Paper Ledger Newsreader headlines, IBM Plex Sans UI, and IBM Plex Mono timer/stat/micro-label typography. Added the requested radii, circular checkboxes, accent focus outlines, panel spacing, and elevated-surface shadow. Existing layout structure and responsive breakpoints remain intact.
- app/layout.tsx changes are limited to next/font/google imports, font definitions, and body font-variable wiring. Newsreader uses variable weight (including 500/650) with its optical-size axis.
- Category dots and inline user-selected colors remain untouched. Exact course/personal chip tokens and optional data-kind CSS hooks are defined; existing badges have no semantic kind attribute, so they retain a neutral pill surface rather than guessing category type. Activating distinct kind palettes would require a separately authorized component markup change.
- PASS: npm run lint; npm run typecheck; npm test (98/98); npm run build; npm run test:analytics-ui; npm run test:classification-ui; npm run test:reading-ui. All three browser scripts verified their existing desktop/320px flows and overflow assertions with local fixtures.
- Additional actual-app browser verification: signed-out Today at 1440px and 320px in both light and dark mode, no horizontal overflow, correct computed palette, IBM Plex Sans body and Newsreader 650 headings. Screenshots visually inspected. Existing UI fixture layouts do not wire next/font themselves; actual font wiring was verified in the real app separately.
- No application logic, schema, migration, RLS, data-driven category color, or component markup changes beyond font wiring. No commit or push. Development preview left running at http://127.0.0.1:3000.

---
## UI polish — completed and verified 2026-10-04

- [x] 2026-10-04 sign-in copy polish: replaced the developer-facing account/setup paragraph with “Sign in with your Task Manager account.” The signed-out sign-in panel contains no Supabase/README/setup guidance; the separate missing-configuration setup panel is unchanged. No form, input, button, auth behavior, schema, migration, or RLS changes. `npm run lint`, `npm run typecheck`, `npm test` (**98/98**), and `npm run build` PASS; no commit or push.
- [x] Archive visibility buttons now read **Show archived** when OFF and **Hide archived** when ON, retaining `aria-pressed`. Categories and Reading use their existing controls; Courses/Task types/Topics inherit the label change from `NamedClassificationManager`. Filtering and archive/restore behavior are unchanged.
- [x] Vertically center the sign-in panel using auth-only main-content flex layout, symmetric vertical padding, and the existing panel width limit. Mobile auth layout fills the space beneath navigation and remains scrollable on short screens. Form markup, inputs, and button styling are unchanged.
- Validation: `npm run lint`, `npm run typecheck`, `npm test` (**98/98**), `npm run build`, `npm run test:classification-ui`, `npm run test:reading-ui`, and `git diff --check` PASS. Existing browser assertions verify both visible toggle labels, including Topics. A local signed-out production-browser check confirms viewport centering at 1440×1000 and no horizontal overflow at 320×900 or 320×480; no sign-in was submitted or hosted auth request allowed. No schema, migration, RLS, or unrelated behavior changes; no commit or push.

---

## Management archive visibility — completed and verified 2026-10-04

- [x] Add local **Show archived** controls, OFF by default, to Categories, Courses, Task types, Topics, and Reading books management lists.
- Filtering uses existing `archivedAt` fields only during rendering. Active records remain visible; enabling the control includes archived records with existing archived labels and the app's muted color. Existing archive/restore callbacks reload records, so archiving hides a row immediately when OFF, keeps it visible when ON, and restoring makes it active in either view. Visibility resets on reload; no preference persistence was added.
- Reused `secondary-button`, `aria-pressed`, React local state, and the existing `NamedClassificationManager` for independent Courses/Task types/Topics controls. No new component abstraction or dependency; assignment dropdowns, historical relationships, and archive semantics are unchanged. No deletion functionality, schema/migration/RLS changes, hosted database operations, commit, or push.
- Validation: `npm run lint`, `npm run typecheck`, `npm test` (**92/92**), `npm run build`, `npm run test:classification-ui`, `npm run test:reading-ui`, and `git diff --check` PASS. Existing synthetic browser fixtures now verify archive visibility with both toggle states, restore behavior, and Reading reload defaults alongside retained dropdown/history/desktop/320px coverage. The existing test suite uses isolated embedded PostgreSQL; no application database migrations were run.

---

## Milestone 6 — Analytics — locally implemented and verified 2026-10-04

This request authorizes M6 after the hosted M4–M5 checkpoint below. The earlier checkpoint's “Do not begin M6” describes that historical checkpoint only; its schema and hosted evidence remain authoritative. No commit, push, hosted SQL, production data change, or deployment was performed for M6.

### Implementation and schema choices

- Added `supabase/migrations/202610040001_analytics.sql`, applied only to isolated embedded PostgreSQL after all M2–M5 migrations. It preserves existing tasks, timer sessions, books and reading sessions without rewriting/backfilling them.
- `completion_estimates` is a narrow append-only snapshot table with compound owner/UUID identity, owner-matching restrictive task FK, unique owner/task/completion timestamp, creation timestamp, checks, period index, and owner-only SELECT RLS. Authenticated clients have no INSERT, UPDATE or DELETE grant; anonymous access is denied. No cached actual duration or duplicated task-estimate columns were introduced.
- A non-callable SECURITY DEFINER trigger with an empty search path and explicit owner filtering captures a snapshot atomically after an incomplete → completed transition, after M3 closes any running timer. It stores nullable manual `estimated_minutes`, nullable derived prediction, effective minutes/source, prediction source and sample size. Manual → prediction → 25-minute default precedence remains intact. Snapshot generation failure rolls back completion; it cannot silently omit history.
- Predictions use the existing six-level hierarchy, minimum three samples, newest twenty, N..1 rank weights, nearest-five rounding and five-minute floor. Soft-deleted completed history remains eligible; active/void/zero sessions and reopened tasks do not train. SQL uses bytewise ID ordering for exact completion-time ties; normal generated UUID IDs match the existing JavaScript ordering, while legacy mixed-case/punctuation IDs may order differently at an exact timestamp tie. This narrow deterministic tie limitation is explicit; no estimator behavior was changed.
- Ordinary edits preserve a completed task's completion timestamp and its immutable snapshot. Reopening retains the old snapshot; recompletion captures a new one, matched with PostgreSQL microsecond precision. Existing/imported already-completed records intentionally have no retrospective snapshot: their historical predictions cannot be reconstructed honestly. Their count and recorded actuals still appear.

### Analytics definitions and boundaries

- 2026-10-04 follow-up: finalized study/non-study productive classification in `lib/analytics/analytics.ts`. For eligible task timer sessions in the selected period, `course_id != null` → study and `course_id == null` → non-study productive (`courseId` in the domain model; omitted legacy values are treated as null). Each duration enters exactly one bucket. Historical retained tasks use their current course relationship; archived courses still count as study. No course names/IDs, category names, task types, or course archive state influence the calculation. Reading remains a separate bucket with its existing overlap/time definition unchanged. Existing summary cards display the calculated totals without UI classification logic or redesign.
- Pure `lib/analytics/analytics.ts` calculations are separate from React and charts. All actual time derives from stopped, positive, valid, non-void `time_sessions`; active counters and mutable task estimates never supply actuals.
- Weeks are Monday–Sunday; months are calendar months. Timer sessions are attributed in full to their local **start date**, using the displayed browser timezone (overnight sessions are not split). Completion counts use local completion date. Future calendar dates are excluded; selected periods can still show empty future days. Date-only reading logs are not timezone shifted.
- Focused time = eligible task timer seconds + exclusive reading seconds. Date-period filtering happens **before** combination. Reading `time_source=reading` minutes are additive; `task_timer` minutes are contextual overlap only, displayed separately and never added again. Pages from both reading sources count; voided pages/minutes do not. Other manually tracked sessions are unsupported and labeled, not invented.
- Current-week/current-month focus summaries remain anchored to today. The week/month selector and date control drive selected-period summaries, category/course/day breakdowns, comparisons and page charts. Category/course charts show timer time only because reading logs have no category/course relationship. Day charts show combined focused time. Current stored classification IDs supply labels/grouping, including archived references and explicit unassigned buckets.
- Task counts include currently completed retained tasks (including soft deletion), once per task, in the selected completion period. Reopened tasks leave completion metrics until recompleted. Average task duration uses **lifetime** eligible session totals of timed completed tasks, excluding untimed tasks from the denominator; counts and denominator are shown. Period focus time instead uses the session start date.
- Effective-estimate and independent prediction errors compare frozen completion values with current corrected lifetime actuals. Bias = actual − estimate (positive means underestimated); mean absolute error is minutes; mean absolute percentage error divides by actual minutes. Only positive actuals with the corresponding snapshot value contribute. Default effective estimates are labeled; missing historical snapshots/predictions and empty samples are unavailable, never zero-error accuracy or fabricated trends.
- Reading progress is current, across retained books, independent of the period. Pages-by-week uses nonvoid ledger page ranges, groups by Monday, and includes only selected-period dates in partial edge weeks. Manual progress offsets do not fabricate logged pages.

### Architecture and local verification

- Added analytics domain snapshot types, pure calculations, a read-only repository interface and paginated owner-pinned Supabase adapter; wired it into the existing repository context. The route uses existing authenticated layout/navigation. Parallel loading, loading/empty/error states, reload recovery and focus refresh follow existing conventions; cloud errors never fall back to mock metrics.
- `components/analytics/analytics-board.tsx` provides dense summaries, accessible text with CSS bar charts for categories/courses/days/pages and paired estimate/actual bars, accuracy sample counts, and reading progress. No new charting/state dependency or navigation was added. Existing Reading/classification UI fixtures gained only the required empty analytics adapter.
- `tests/analytics.test.ts`: boundaries (Monday/Sunday, months, year/leap/DST/local midnight), session eligibility, retained tasks, category/course/day/unassigned groups, study/non-study exact-second totals, overlap/date filtering, error math, lifetime actuals, microsecond snapshot selection, period-edge pages, current reading progress and honest empty states.
- 2026-10-04 classification follow-up unit evidence: six added tests cover course-assigned tasks, null/omitted course assignments independent of task/category text, reading-only and declared overlap exclusion, mixed independent totals, archived-course historical tasks without requiring metadata, and period/future/active/void/zero exclusions. Updated the previous null-placeholder assertion to 3600 study seconds and 0 non-study seconds. `npm run lint` PASS (zero warnings), `npm run typecheck` PASS, `npm test` PASS **98/98**, `npm run build` PASS, `npm run test:analytics-ui` PASS (desktop/320px synthetic fixtures), and `git diff --check` PASS. No schema, migration, RLS, task/course relationship, reading calculation, or archive-behavior changes; no commit or push.
- `tests/analytics-database.test.ts`: all migrations apply post-M5, row-for-row preservation of tasks/timers/books/reading, frozen snapshots, completion timestamp protection, reopen/recomplete/soft-delete retention, SQL/TypeScript estimator parity for all six levels and sample cap, active timer close, actuals after correction/void, reading correction/void, owner isolation, denied spoofing, compound FK, anonymous denial and read-only snapshots. `tests/analytics-repository.test.ts` covers paging, mapping, owner pinning and actionable failure handling.
- Final verification 2026-10-04: `npm run lint` PASS (zero warnings), `npm run typecheck` PASS, `npm test` PASS **92/92** (all original 80 preserved, 12 analytics tests), `npm run build` PASS with `/analytics` generated, `npm run test:analytics-ui` PASS, and `git diff --check` PASS. No hosted test or rollout is implied.
- `npm run test:analytics-ui`: isolated temporary Next app importing real production components and synthetic repositories; no hosted access. Desktop 1440×1000 and mobile 320×900 checks cover totals, overlap, estimate values/error, pages/progress, period switching, refresh, empty states, failed load/retry and horizontal overflow. The period control's label was fixed after the first fixture run exposed an exact-label lookup failure. Desktop/mobile screenshots were visually reviewed; no page exceptions. Screenshots are outside the repository in the current Codex visualization directory (`analytics-desktop.png`, `analytics-mobile.png`).

### Intentionally unresolved decisions / limitations

- **Study vs non-study productive classification resolved 2026-10-04:** course assignment alone classifies task timer time, including historical tasks linked to archived courses; reading stays separate. See the finalized rule and test evidence above. The original M6 null placeholders are replaced by numeric totals.
- Historical snapshots cannot be backfilled accurately. Current classifications, corrected sessions and current book progress can change analytics; frozen estimates cannot. Browser timezone changes can regroup historical calendar dates. Overnight start-date attribution and the timed-only average denominator are explicit M6 choices.
- The personal-use client loads paginated retained history; very large histories may eventually need server aggregation. Independent reads are not a single database snapshot; reload resolves concurrent edits. Exact-timestamp legacy-ID sort ties have the narrow SQL/JS collation limitation described above. Hosted migration/deployment and cross-account browser acceptance remain unperformed.

### M6 hosted application checklist — 2026-10-04 (hosted rollout remains unchecked)

- [ ] Review/backup production schema and confirm all M2–M5 migrations are present with no partial M6 application.
- [ ] Apply `202610040001_analytics.sql` once to hosted Supabase using the approved deployment workflow; do not replay earlier SQL Editor migrations.
- [ ] Confirm snapshot table/FK/index/RLS/grants and trigger installation; verify pre-existing tasks, sessions and books are preserved.
- [ ] With authorized test accounts, verify completion (including active timer), manual/automatic/default snapshots, reload, reopen/recomplete, correction/void, and cross-account denial.
- [ ] Deploy the verified application to Netlify after the database migration and confirm `/analytics` on desktop/mobile against authorized test data.
- [x] Resolve the study/non-study product rule — authorized follow-up completed and locally verified 2026-10-04; no hosted operation required for this calculation-only change.

---

## Hosted database checkpoint — migrations M4/M4.5/M4.6/M5 applied and verified 2026-10-04

Scope for this checkpoint is hosted M4–M5 migrations and focused authenticated acceptance only. Do not begin M6 Analytics.

### Git and repository evidence

Actual repository: `Task-Manager/Task-Manager`. Initial 2026-10-03 review read `AGENTS.md`, `PROJECT_OVERVIEW.md`, this plan and the actual migration scripts; HEAD was `df51f0ee16fef78d5c2a6db2079a130ec99b5e57`, initially clean and 4 commits ahead of `origin/main`. For authenticated acceptance on 2026-10-04, `git fetch origin --prune` and `git pull --ff-only origin main` succeeded (already up to date): branch `main`, HEAD `64be5024bacb3b7e35913d2b67ff85d92d8d28d3`, upstream `origin/main`, 0 ahead / 0 behind. Remote is `https://github.com/BenjaminRoder/Task-Manager.git`. The user's staged hosted-checkpoint update was preserved; acceptance results modify only this plan in the repository. No commit or push was performed.

### Exact migration review, in application order

1. `202610030001_optional_manual_estimate.sql`: relaxes `tasks.estimated_minutes` NOT NULL and documents manual override/automatic estimation semantics. Existing values and the existing 1–1440 check remain intact. **The actual manual column is `estimated_minutes`; predictions are derived, not persisted.** The suggested overview names `manual_estimate_minutes` and `predicted_minutes` are not migration requirements. No new tables, RPCs or policies.
2. `202610030002_task_classification.sql`: adds `courses` and `task_types` with owner/ID compound primary keys, names, archive and creation/update timestamps; courses also have optional `code`. Owner references restrict deletion; IDs/names/code have length checks and names are normalized unique per owner, including archives. Adds nullable `tasks.course_id`/`task_type_id`, owner-matching restrictive foreign keys and indexes; makes existing `category_id` nullable. Identity guards use existing `guard_record`. Replaces `guard_category_assignment` to support null/unchanged archived categories and adds `guard_task_classification` for active new assignments. Enables RLS on both new tables, with authenticated owner-only SELECT/INSERT/UPDATE and no DELETE grant. No callable application RPC is added.
3. `202610030003_task_topics.sql`: adds `topics` (owner/ID, name, archive/timestamps, compound primary key, owner FK, normalized name uniqueness and identity guard) and `task_topics` (owner, task/topic IDs, creation timestamp, compound primary key and owner-matching restrictive FKs). Adds assignment guard/index, owner-only RLS and authenticated SELECT/INSERT/UPDATE on topics, SELECT/INSERT/DELETE on association links. `save_task_with_topics(text,jsonb,text[],uuid)` is an authenticated-only SECURITY INVOKER RPC that verifies the session identity and atomically saves a task/selection while retaining unchanged archived links. Its runtime DELETE intentionally removes deselected links; it is not a migration-time data deletion.
4. `202610030004_reading.sql`: adds `books` with owner/text ID, title/optional author, total pages, progress offset, status, start/completion dates, optional weekly goal, archive/timestamps; adds `reading_sessions` with owner/UUID ID, owner-matching book FK, date, page range, generated `pages_read`, optional minutes, time source, void/timestamps. Compound ownership keys and restrictive FKs preserve records. Checks/guards enforce valid lengths, pages, finite dates, statuses, completion consistency, immutable identity, active-book logging and safe corrections. Both tables enable authenticated owner-only SELECT/INSERT/UPDATE RLS without DELETE grants. `books_with_progress` is a SECURITY INVOKER view deriving current page from offset plus nonvoid ledger pages. Authenticated-only invoker RPCs are `save_reading_book(text,jsonb,timestamptz,uuid)` (revision-checked saves/manual progress) and `log_reading_session(uuid,jsonb,uuid)` (idempotent logging). Ledger triggers advance book revision and reopen completed books if a correction reduces progress.

No reviewed script drops tables/columns, renames objects, changes existing column types, or rewrites existing records at migration application. DROP NOT NULL relaxes constraints. Classification changes the existing category guard; ALTER TABLE/foreign-key validation and index creation can briefly lock existing tables. These scripts are not generally rerunnable: creation statements will fail on existing objects. Live preflight must rule out partial application and confirm existing columns, compound ownership keys, `guard_record`/category guard, role privileges and PostgreSQL support for the invoker view. Based on the user's reported four-table schema, the scripts are consistent with the missing features and preserve existing records; that reported schema has not been independently reconfirmed in this checkpoint.

### Hosted evidence and application status — updated 2026-10-04 (Muse)

On 2026-10-04 the four pending migrations were applied to the hosted production project ("Task Manager", ref sbyqkfggwqmgbzjzumgq) through the Supabase dashboard SQL Editor, one at a time in repository order, each pasted verbatim from `main` and confirmed successful before proceeding. No `supabase db push` was used; M2/M3 were not replayed.

Preflight (read-only, before any write):
- Public schema held exactly `categories`, `local_imports`, `tasks`, `time_sessions`; none of the six new tables existed — no partial application.
- `supabase_migrations.schema_migrations` does not exist (absent migration registry, as previously reported — SQL Editor path keeps no registry; this is expected, not an error).
- `tasks.estimated_minutes` was NOT NULL; `tasks.category_id` was NOT NULL; `course_id`/`task_type_id` were absent.
- PostgreSQL 17.6 (supports `security_invoker` views).

Application record:
- [x] `202610030001_optional_manual_estimate.sql` — applied OK ("Success. No rows returned."). `tasks.estimated_minutes` is now nullable; existing values and 1–1440 check intact.
- [x] `202610030002_task_classification.sql` — applied OK. Tables `courses`, `task_types` created with RLS owner policies; `tasks.course_id`/`task_type_id` added (nullable), `tasks.category_id` now nullable; guards replaced/added.
- [x] `202610030003_task_topics.sql` — applied OK. Tables `topics`, `task_topics` created with RLS owner policies; `save_task_with_topics(text,jsonb,text[],uuid)` RPC created (SECURITY INVOKER, authenticated-only). The dashboard showed a "destructive operations" warning because the function body contains a runtime DELETE of deselected links; this was confirmed as the intended, reviewed behavior — it is not a migration-time data deletion.
- [x] `202610030004_reading.sql` — applied OK. Tables `books`, `reading_sessions` created with RLS owner policies; `books_with_progress` SECURITY INVOKER view created; `save_reading_book` and `log_reading_session` RPCs created (authenticated-only).

Post-application verification (read-only):
- [x] All six new tables exist: `courses`, `task_types`, `topics`, `task_topics`, `books`, `reading_sessions`. Full public schema is now 11 entries (10 tables + `books_with_progress` view).
- [x] `rowsecurity = true` on all 10 public tables.
- [x] All three RPCs present: `save_task_with_topics`, `save_reading_book`, `log_reading_session`.
- [x] `public.books_with_progress` exists as a VIEW.
- No data rows were created, modified, or deleted. Auth settings, API keys, and other projects untouched. Local test suite: 80/80 passing, including embedded-PostgreSQL migration tests, run 2026-10-04 before the hosted application.

Earlier 2026-10-03 notes (superseded): Codex's sandbox/browser connection failed before any hosted access (`windows sandbox failed: helper_unknown_error`), so no hosted SQL was executed in that run. That blockage no longer applies — the work above was completed through the Supabase dashboard with the user's credentials.

### Focused hosted checks

| Authenticated app check | Result in this checkpoint |
| --- | --- |
| Course/Task Type/Topic creation and task assignment survive reload | Passed 2026-10-04 — created all three in the authenticated app, assigned them to the QA task, reloaded, and verified both task badges and reopened editor selections |
| Manual `estimated_minutes` save/load | Passed 2026-10-04 — created at 45 minutes, reloaded and confirmed editor value; updated to 37 minutes, reloaded and confirmed both displayed estimate and editor value |
| Timer sessions persist and eligible completed history produces a derived prediction | Passed 2026-10-04 — active session survived reload and sign-out/sign-in; stopped/corrected history persisted; 3 completed QA observations of 10/20/40 minutes produced a 30-minute category prediction with blank manual estimate. See dated timer acceptance and monitoring observations below. |
| Book/Reading Session persist with correct progress and weekly totals | Passed 2026-10-04 — 200-page book with initial page 10 and weekly goal 50; logged 10→30 on 2026-10-04 with 15 minutes; reload preserved page 30, 20 pages today/this week, 30 pages remaining to weekly goal, 40% goal attainment, and session history |

### Authenticated acceptance evidence — 2026-10-04 (Codex)

Ran the real repository app at `http://127.0.0.1:3001/today` and `/reading` against hosted project `sbyqkfggwqmgbzjzumgq`, using installed Playwright/Chrome at 1440×1000 with America/New_York timezone. The Browser plugin/skill is not available; in-app tab access additionally failed with `windows sandbox failed: helper_unknown_error: setup refresh had errors`. A fresh Chrome QA session provided the working fallback. The user signed in interactively and explicitly authorized their existing account because no dedicated test account was available. No credentials or session tokens were read, copied or saved by the QA scripts.

All test records were uniquely named with prefix `QA Hosted 2026-10-04 mutbc6xv` and suffixes Course, Type, Topic, Task or Book. Actions used actual app controls and the existing production adapters, without mocks, local-storage data fixtures, direct SQL, RLS bypass or migration replay. Hosted request evidence includes creation responses HTTP 201 for courses/types/topics, HTTP 204 for `save_task_with_topics`, `save_reading_book` and `log_reading_session`, and HTTP 200 reload reads of tasks, classifications, `books_with_progress` and reading sessions. All 177 observed hosted REST requests through the flow/final verification succeeded. This demonstrates authenticated app persistence, separately from the earlier schema inspection and local tests; it does not establish cross-account isolation.

QA cleanup passed and survived reload: the QA task was soft-deleted; its course/type/topic and book were archived; only its Reading Session was voided, retaining recoverable history. The archived QA book returned to initial page 10 and this week's logged pages returned to 0, keeping the test session out of totals. No real task or reading history was mutated, and no timer sessions were created or modified. QA audit records intentionally remain archived/soft-deleted/voided under the repository retention design.

Today and Reading both rendered their expected titles/headings and functional controls. Card screenshots were reviewed and show the reloaded classification/manual estimate and Reading progress/weekly totals. Final verification with a fresh console baseline had no console errors or warnings and no failed hosted requests. The earlier browser buffer contained one HTTP 404 and one HTTP 400 console resource entry without resource URLs; their origin was not established, and they did not recur during final verification. No application page exceptions were observed.

Evidence is saved outside the repository in `C:/Users/jacku/.codex/visualizations/2026/10/03/01a1040d-5c19-7371-9a6a-5b493290f9eb/`: `hosted-qa-results.json`, `hosted-qa-verification.json`, `hosted-task-qa.png` and `hosted-reading-qa.png`. Temporary QA scripts also stay outside committed source. No full local test suite was rerun for this hosted acceptance; the 80/80 local result recorded by Muse remains separate. The three requested hosted flows pass. Timer/prediction acceptance, mobile/sign-out/sign-in acceptance, broader session corrections/time-source scenarios and cross-account ownership testing remain unverified by this run. M6 has not been started.

### Timer and prediction hosted acceptance — 2026-10-04 (Codex)

Pulled `main` using `git fetch origin --prune` and `git pull --ff-only origin main`: already up to date at `64be5024bacb3b7e35913d2b67ff85d92d8d28d3`, tracking `origin/main`, 0 ahead / 0 behind. Existing staged and unstaged plan edits were preserved. Used the real app at `http://127.0.0.1:3001/today` in installed Playwright/Chrome, 1440×1000, America/New_York, against hosted Supabase project `sbyqkfggwqmgbzjzumgq`. The user interactively signed into the authorized account initially and again after the app's Sign out action. No credentials/session tokens were read or saved by the QA scripts. No application refactor, migration replay, scope change, full-suite run, commit or push occurred; M6 remains untouched.

The exact first task name was **QA timer check**. A new isolated category, **QA Timer 2026-10-04 mutc16o0 Category**, kept prediction observations separate from real history. Other task names used that unique QA prefix. Every action used actual app controls and authenticated production adapters. The following supersedes the earlier timer/prediction unverified status for these specific desktop flows only.

| Requested step | Result | Observed hosted/app evidence |
| --- | --- | --- |
| 1. Create task, start timer, reload | Pass | Running clock advanced from `00:00:02` before reload to `00:00:04` afterward. The active session remained the same, with original start `2026-10-04T00:41:15.680068-04:00`. |
| 2. Sign out and sign back in | Pass | App displayed Sign in after sign-out. After interactive reauthentication, the same session ID/start timestamp returned, still active at `00:02:43`; elapsed time matched wall time within the QA tolerance. |
| 3. Stop and inspect Time history | Pass | Hosted stopped duration was `164.684218` seconds; Time history showed `00:02:44`, and task actual showed `2 min`. Session end/start difference agreed with generated duration. |
| 4. Correct start/end timestamps | Pass | Both local inputs changed to `2026-10-04T00:33:00.364` and `2026-10-04T00:43:00.364`. History became `00:10:00`, actual changed from `2 min` to `10 min`, hosted duration became exactly `600` seconds, and actual survived reload. No correction alerts/errors occurred. |
| 5. Three completed timed tasks and prediction | Pass | First corrected QA task plus two additional started/stopped/corrected QA tasks were completed in the isolated category. Retained stopped durations were 10, 20 and 40 minutes (600/1200/2400 seconds). New QA task had hosted `estimated_minutes = NULL`, displayed Manual: Automatic and Prediction: **30 min**, and showed **3 recent category completed tasks · medium confidence**. Prediction survived reload. Rank-weighted history is `(40×3 + 20×2 + 10×1)/6 = 28.33` minutes, rounded to 30 by the existing 5-minute rule; this is not the 25-minute default. |
| 6. Console/request monitoring throughout | Pass, with observations reported | No console warnings/errors or page exceptions during the timer flow, and no hosted HTTP 4xx/5xx responses. Of 453 monitored hosted request/response events, the logout POST returned HTTP 204 and subsequently emitted Chrome `net::ERR_ABORTED`; sign-out and reauthentication recovery still passed. Before the QA flow, local `/favicon.ico` returned 404 and produced one console error. These observations were recorded, not suppressed. |

All three `start_task_timer` RPCs returned HTTP 200; all three `stop_task_timer` RPCs returned HTTP 204. Six `time_sessions` PATCH requests (three corrections and three voids) returned HTTP 200. Task creation/completion/cleanup and category creation/archive also succeeded. Temporary harness locator/controlled-checkbox assertions required adaptation to the existing UI's asynchronous updates; hosted writes succeeded, and no product code was changed.

**Cleanup passed and survived reload.** The app has no separate task-archive control, so its existing Delete action soft-deleted the four QA tasks while retaining their historical records. All three QA sessions were voided before task removal; QA task actuals returned to `0 sec`, the QA category was archived, and no active timer remained. Voided sessions no longer contribute to actual time or prediction observations. No QA book/reading session was created in this run.

Before/after canonical row comparisons (in memory, with no personal field values exported) confirmed **zero changed or missing pre-existing rows**: tasks 3, time_sessions 6, books_with_progress 1, reading_sessions 1, categories 1. These baselines include every row loaded by the authenticated adapters before QA creation, including previous retained QA history. This independently confirms that existing task and reading history were untouched by the run.

Evidence remains outside the repository in the same visualization directory above: `timer-qa-results.json`, `timer-reload-qa.png`, `timer-corrected-qa.png`, `timer-prediction-qa.png`, plus temporary QA scripts. Screenshots were reviewed; final app inspection found no error alerts/framework dialog. The temporary Chrome QA session and dev server were closed after verification. Mobile, cross-account isolation and broader Reading correction/time-source acceptance remain unverified; successful timer reauthentication is not a claim that all those checks pass.

---

## Milestone 5 — Reading Tracker — implemented and hosted-accepted 2026-10-04

### Implemented and locally verified

- [x] User-owned Book and ReadingSession domain/repository models; add/edit/start/pause/complete books and archive/restore without deleting history.
- [x] Optional author/minutes/weekly goal, validated page ranges, dates/status, timestamps and consistent manual progress semantics.
- [x] Atomic book saves, idempotent session log requests, immutable record identities, optimistic edit/correction/archive revisions, retained removed sessions, book ownership FK, RLS and invoker-security progress view.
- [x] Correctable session ledger; generated pages_read and derived current page; completion corrections reopen books when progress drops below the final page.
- [x] Reading section centers on active books with compact capture/logging, progress, Monday-Sunday quotas, recent calendar-day pace, projection and retained completed/archived book/session history.
- [x] Dedicated deterministic calculations for progress, today/week pages, goal percentage/remaining, remaining pages, pace/projection, completed books/year and exclusive/overlapping reading minutes.
- [x] 15 added automated tests (9 calculation/validation, 3 adapter, 3 real PostgreSQL integration); all 80 tests pass, retaining all 65 task/classification/topic/prediction/workload/timer tests.
- [x] Lint, typecheck and production build pass; all six migrations execute under embedded PostgreSQL and Reading ownership checks pass.
- [x] Isolated desktop/320px browser fixture: add/start/log, quota/current-page updates, refresh, session correction, overlap marker, manual progress/history preservation, completion, archive/restore, removed history and actual-form pace/projection. Existing task/classification/topic/estimation/timer browser fixture also passes.
- [x] Apply M5 migration to hosted Supabase after M4/M4.5/M4.6 migrations — completed and verified 2026-10-04 in the hosted checkpoint above.
- [x] Authenticated hosted desktop acceptance, including sign-out/sign-in, real persistence/RLS, corrections and task/reading time-source behavior — passed 2026-10-04 (see hosted checkpoint above).
- [ ] Authenticated hosted mobile acceptance (narrow-viewport flows against the hosted project).

### Book and session semantics

Migration `202610030004_reading.sql` adds `books`, `reading_sessions`, `books_with_progress`, guard triggers and invoker-security `save_reading_book`/`log_reading_session` RPCs. Existing task/classification/topic/timer data and estimation code are untouched. Explicit ReadingRepository is injected through the existing account-scoped repository context. It pages all retained books/sessions, pins Auth identity, reports errors, and never queries from presentation components. Missing hosted schema fails visibly; no production synthetic data or local fallback is introduced.

Book statuses are Want to Read, Reading, Paused and Completed. Total pages are 1–100,000; current page is 0..total. Author is optional; weekly goal is null or a positive whole number. Started date is required outside Want to Read; completed date exists only for Completed, must not precede started date, and completion requires the final page. Mark completed is an explicit manual progress adjustment and does not invent session pages/time. Archived books remain inspectable/editable/restorable, but new logs require an active Reading book. No hard-delete grants/UI exist.

Current page is **progress_offset + sum(nonvoid session end_page − start_page)**, computed by an RLS-respecting invoker view. Offset captures preexisting/unlogged progress. Editing current page atomically adjusts offset to the requested page while preserving every session; offset can be negative after a deliberate backward adjustment. No cached current-page/session total is stored. New logs start from current progress and advance by end−start. Session corrections/removals apply their page delta to progress and quotas, never silently rewrite later ranges. Corrections that would place progress outside 0..total fail with an instruction to adjust current page first. Nonvoid retained ranges must fit total pages; removed ranges do not prevent a safe total-page correction. Session removal preserves an immutable voided record. Corrections that reduce a completed book below its final page reopen it and clear its completed date. Every ledger change advances the book revision, protecting stale manual edits.

### Metrics, goals and projection

Session dates are explicit local calendar dates, with the same Monday-through-Sunday arithmetic as Week. Metrics exclude removed, foreign-book and future-dated rows. Today uses exact date; this week sums dated ranges through today within that local week. Goal remainder floors at zero; goal percentage may exceed 100% to show overachievement. Missing goals display No weekly target. Manual page changes never count as logged pages toward quotas.

Pace uses sessions in the latest 28 calendar days through today, divided by inclusive calendar days from the first eligible date in that window to today. Nonreading days count; multiple sessions on a date count once toward the distinct-date requirement. A projection requires at least three positive reading dates across at least seven calendar days. Remaining pages divided by pace is rounded up to calendar days and added to today; paused/completed/archived books, insufficient history, no remaining pages or estimates over 100 years have no forecast. This is a labeled estimate, not a deadline. Completed books/year counts retained currently-completed books with completed dates in the current local year through today, including archived books; reopened books no longer count as completed.

### Reading/task time rule for M6

Reading minutes are optional and independently recorded. Sessions have `time_source = reading | task_timer`. The UI asks users to mark **Already tracked with a task timer** when minutes overlap. Reading-exclusive minutes can be added to task ledger time; task_timer minutes are retained for context and excluded from additive reading-time totals. No task session is duplicated, modified or created by Reading. M6 must apply its date-period filtering, then use the separate readingMinutes/overlappingMinutes outputs; never sum raw minutes across both systems. Dates and optional durations cannot automatically detect an unmarked overlap, so this V1 rule relies on the user's declaration. Precise timestamp/task-session linkage remains deferred.

### Verification, hosted status and checkpoint

Local PostgreSQL tests verify lifecycle, page/status constraints, generated page deltas, progress/manual adjustments, corrections/removal, history retention, anonymous denial, two-owner RLS including the progress view, spoofed relationships, idempotent requests and stale revisions. Browser tests import actual production components into an isolated synthetic app and use explicit local test storage; they validate UI/refresh behavior, not hosted persistence. Desktop/320px screenshots were reviewed; compact book/log sections keep active progress prominent, and button/progress contrast was adjusted. No page errors or document overflow occurred in the accepted runs.

Only public Supabase configuration is available; no authenticated management connection was found. Nothing was applied or verified on the hosted project during M5. Pending order: `202610030001_optional_manual_estimate.sql` → `202610030002_task_classification.sql` → `202610030003_task_topics.sql` → `202610030004_reading.sql`. Do not rerun M2/M3 migrations. All hosted M4/M4.5/M4.6/M5 acceptance remains a release gate and does not block M6 development.

Task 11 and its reading tests below are reconciled to locally/browser-verified work. M6 Analytics, unified History, final hardening/security and outstanding V1 task requirements remain unchecked. The app is deployed to Netlify (2026-10-04). No external book API, ISBN/Goodreads, notes/highlights, recommendations, social features, calendars, notifications or Analytics UI was added. Ready for **M6 Analytics development** using existing task/timer/classification/topic/prediction/reading data.

---

## Milestone 4.6 — Topics/Tags — implemented and hosted-accepted 2026-10-04

### Implemented and locally verified

- [x] Custom user-owned topics: create, rename, archive and restore, stable IDs and timestamps.
- [x] Zero/multiple topic assignments with intentional add/remove; completed and soft-deleted task associations survive archival and lifecycle changes.
- [x] Backward-compatible migration; existing tasks have no associations and keep all prior fields.
- [x] Compound ownership FKs, RLS, anonymous denial, immutable topic identities and archive assignment guard.
- [x] Explicit TopicRepository, account-pinned paginated adapter, nested task association reads and atomic task/selection RPC; no component database queries.
- [x] Collapsed optional checkbox selection plus adjacent topic management on Today/Tasks/Week; archived assigned topics remain labeled and editable.
- [x] Topic-independent estimation, unchanged manual/prediction/fallback precedence, Momentum/workload and timer rules.
- [x] 8 added automated tests; all 65 pass, including real embedded PostgreSQL/RLS/rollback tests and the existing timer suite with all five migrations.
- [x] Lint, typecheck and production build pass.
- [x] Desktop (1440px) and mobile (320px) browser fixture acceptance: topic create/rename/archive/restore, multiple selection/removal, retained completed/archived labels, refresh and Week cards; all prior hierarchy/Momentum/workload/timer UI regressions pass.
- [ ] Hosted migration/ownership/persistence and authenticated browser acceptance for M4/M4.5/M4.6.

### Topic semantics and architecture

Category is a broad area; Course is academic context; Task Type is the kind of work; Topic is specific subject matter. Topics are independent, many-to-many structured data, and never enter the prediction hierarchy. Names are 1–60 characters and unique per account after case/outer-space normalization, including archived topics. Archives preserve historical links and current labels; unchanged archived selections are retained, new associations require an active topic, and users may deliberately remove a historical association. Renames update display everywhere without changing IDs. No hard delete of topics is granted.

Migration `202610030003_task_topics.sql` adds `topics`, `task_topics`, owner policies/indexes/FKs, guarded new assignment and invoker-security `save_task_with_topics`. Task fields and explicit selection are saved in one transaction; failed new references roll back both. Current associations are retained rather than replaced, protecting archived links. Parent-task locks serialize RPC edits, and topic row locks serialize new assignment with archive. Ordinary status/deletion/timer operations do not touch links. Omitted topic IDs at legacy repository boundaries preserve existing links; cloud reads normalize no links to []. Legacy recovery rejects unsupported topic-bearing snapshots rather than silently dropping their relationships.

### Hosted status and checkpoint audit

Only public Supabase URL/publishable-key configuration is available. No database-management connector, CLI auth token or database credential was found. Browser-session inventory also failed at Windows sandbox initialization. Therefore no hosted migration or authenticated acceptance was performed, and no hosted data changed. Apply M4 `202610030001_optional_manual_estimate.sql`, M4.5 `202610030002_task_classification.sql`, then M4.6 `202610030003_task_topics.sql` in order; do not rerun already-applied M2/M3 migrations. Local PostgreSQL verification is separate from hosted verification.

Browser evidence: `npm run test:classification-ui` passed using bundled Playwright/Chrome and real production components in the isolated synthetic fixture. The final 320px screenshot was reviewed; no document overflow or page errors occurred. Browser testing caught duplicate Week badges, which were corrected before the full successful rerun. This validates UI behavior, not hosted persistence.

The audit found stale lower checklist flags for the implemented Today timer and estimator/session tests; those are reconciled to existing/new test evidence. Historical milestone entries remain dated records; this ledger is current status. Outstanding V1 requirements remain explicit: deadline time, notes/description, manual ordering, separate overdue section, completed workload summary, reading, analytics/snapshots and full History, resilience/accessibility/security review, deployment and final hosted acceptance. Inline topic creation is deferred in favor of the existing adjacent classification-manager pattern; task capture stays compact. No Reading/Analytics/History/calendar/AI feature was started.

The codebase is ready to begin **M5 Reading Tracker** development after this local checkpoint, with hosted M4/M4.5/M4.6 acceptance still an open release gate. M6 Analytics and M7 hardening/final acceptance remain pending; this milestone does not imply V1 completion.

---

## Milestone 4.5 — Task classification and full estimation hierarchy — implemented and hosted-accepted 2026-10-04

### Verified implementation and local acceptance

- [x] Independent user-owned Courses and Task Types with names, optional course code, creation/update timestamps, and archive/restore.
- [x] Backward-compatible migration preserves every existing task and estimate; optional category/course/type references support title-only capture.
- [x] Composite ownership keys/FKs, RLS, anonymous denial, identity guards, non-destructive archives, and archived-assignment guards.
- [x] Explicit CourseRepository/TaskTypeRepository contracts and account-pinned, paginated Supabase adapters; no presentation queries or local-storage fallback.
- [x] Manage/create/rename/archive/restore classifications alongside task capture on Today, Tasks, and Week.
- [x] Compact optional selectors, current/archived classification labels, and named prediction explanations in task details; Week cards/editing preserve assignments.
- [x] Full matching hierarchy with M4 minimum/window/weighting/rounding/manual precedence retained.
- [x] Historical reclassification changes future derived predictions; M4 session eligibility, soft-delete, reopening, correction/void behavior retained.
- [x] All original 39 tests retained; 18 added classification/hierarchy/adapter/PostgreSQL tests (57 total) pass, alongside lint, typecheck, and optimized build.
- [x] Isolated browser UI fixture verifies actual components with synthetic history: title-only/category-only/course-only/type-only capture/editing, all six hierarchy levels and insufficient-history fallback, named explanations, manual override, Momentum, Today/Week, rename/archive/restore, retained archived assignments, refresh, timer start/stop UI recovery, and 320px creation/editing.
- [x] Apply pending M4 migration `202610030001_optional_manual_estimate.sql`, then M4.5 migration `202610030002_task_classification.sql` to the hosted project. (Done 2026-10-04 — see hosted checkpoint.)
- [x] Repeat the M4 and M4.5 flows against hosted Supabase with an authenticated browser, including real timer completion/correction/void, persisted classification edits, archived references, and refresh. (Passed 2026-10-04 — see hosted checkpoint. Mobile workflows and cross-account ownership checks remain unverified.)

### Classification architecture and semantics

Category remains the broad area of life/work; Course supplies optional academic context; Task Type independently describes the kind of work. There is no parent/child taxonomy, category restriction, hard-coded task-type enum, or automatic classification seed. Courses have a name (1–60 characters), optional code (1–20), stable ID and timestamps; task types have a name (1–60), stable ID and timestamps. Names are unique within each account/table after case/outer-space normalization, including archived records. Codes are labels, not identity or a unique key.

The migration follows existing compound `(user_id,id)` keys and owner FKs, retaining RLS and invoker-security guards. It permits null category and adds nullable `course_id`/`task_type_id`. Existing tasks keep their categories/estimates with null new references. Archived records remain readable and preserve IDs/history; unchanged archived references may be kept while editing a task, but a new/reassigned archived reference is rejected. Users can clear assignments or restore records. Relationship checks lock classifications consistently with category assignment to avoid an archive/assignment race. No hard-delete grant or UI is introduced.

UI → explicit repository interfaces → Supabase adapters → PostgreSQL remains the production architecture. Existing load/mutation handling fetches all four collections in parallel and reports errors. Missing hosted tables cause actionable load errors, not silent fallback. Legacy recovery storage remains legacy-only: it accepts old snapshots/missing new fields and nullable categories, never invents course/type records, and rejects unsupported non-null classification references. Optional course/type properties at the legacy TypeScript boundary normalize to null in persisted row mappings and task writes.

### Estimation hierarchy and unchanged mechanics

The first group with at least three eligible observations wins: **course + task type → course → category + task type → task type → category → global → no prediction**. Each non-global group requires its identifying fields to be present; null/missing fields never create a fake specific group. Groups overlap rather than forming one nested taxonomy: sample size always counts only rows matching the selected level. More numerous/newer broader groups never replace a sufficient specific group.

M4 mathematics are unchanged: newest 20 matching observations, descending completion timestamp and deterministic task-ID tie break, rank weights N..1, weighted mean, nearest-five-minute half-up rounding and five-minute floor. Confidence extends the same M4 rule to each specific source: 3–7 medium, 8–20 high; global/fallback low, always labeled heuristic. Effective estimate remains valid manual → valid prediction → 25 minutes, shared by Momentum and Today/Week. Actual duration still derives from stopped, non-void sessions; active/zero/invalid sessions do not train predictions.

Historical comparison uses each completed task's **current stored** category/course/type IDs. Reclassification changes future predictions immediately after task reload; renaming changes labels while IDs keep the same groups. Completed soft-deleted tasks remain observations, archived classifications remain valid historical context, and reopened tasks are excluded until recompleted. There are no new snapshots or actual-duration caches. Priority/deadline sorting and timer persistence are unchanged.

### Evidence, hosted status, and next step

2026-10-03: Real migration tests in embedded PostgreSQL verify preserved pre-migration tasks, nullable assignments, course/type creation/rename/archive/restore, timestamps and validation, unchanged archived references, new archived-reference rejection, retained completed/deleted joins, identity immutability, duplicate names, two-owner RLS/spoofing/cross-owner references, anonymous denial and restricted deletes. A persisted timer-ledger test reclassifies historical tasks through all matching levels and verifies deletion/reopening/recompletion. The existing timer acceptance test now executes all four migrations; all M3/M4 regressions still pass. New adapter fixtures verify ownership pinning, owner filters, paging request shape, error propagation, timestamps/archives, and independent nullable task writes.

`npm run test:classification-ui` runs bundled Playwright/Chrome against a temporary Next app importing the **real production components**, with explicit browser-only synthetic/persisted local fixtures. It never connects to Supabase, modifies a production route, or ships fixture data into the app. This is UI verification, not hosted persistence/timer/ownership acceptance. The runner removes its own temporary app and junction afterward. The native browser tool still fails during Windows sandbox setup; no authenticated hosted session/database-management connection is available, so no M4 hosted item was closed or migration applied.

Apply both pending migrations in order and finish the hosted acceptance checklists before calling M4/M4.5 fully accepted. Classification work previously deferred by M4 is now implemented here. Analytics snapshots, course scheduling/semesters/grades, reading, calendar/LMS integration, AI/ML, offline/realtime behavior and full Settings remain outside this milestone. Next product milestone: **Milestone 5 Reading Tracker**, followed by Milestone 6 Analytics using these classification IDs.

---

## Milestone 4 — Deterministic duration estimation — implemented and hosted-accepted 2026-10-04

The authorized scope was persisted task/session history → deterministic prediction → effective estimate → Momentum/Today/Week. M4 originally used category/global matching; its course/task-type deferral was implemented in Milestone 4.5 above. The mathematical and manual-precedence decisions below remain in effect.

### Verified implementation

- [x] Pure estimation module with prediction minutes, source, sample size, and heuristic confidence.
- [x] Owner-scoped, paginated task history includes soft-deleted completed tasks; visible lists still exclude deleted tasks.
- [x] Derive observations from the existing stopped, non-void session ledger; no actual-duration cache.
- [x] Same-category → global history → fallback hierarchy with finite, weighted recent history.
- [x] Preserve manual estimates separately and share one effective-estimate function across Momentum, Today, Week, and planned-duration displays.
- [x] Nullable manual estimate migration preserves existing numbers and existing validation/RLS/timer constraints.
- [x] Automated tests cover eligibility, weights, bounds, rounding, confidence, precedence, determinism, ordering/workload, repository requests, and real PostgreSQL corrections/lifecycle.
- [x] Lint, typecheck, 39 tests, and production build pass.
- [x] Production Playwright sign-in smoke checks on Today/Tasks/Week at 1440px and 320px; no overflow or page errors.
- [ ] Apply `202610030001_optional_manual_estimate.sql` to the connected hosted database.
- [ ] Signed-in browser acceptance with real Supabase: create/time/complete three category tasks, inspect prediction and recency, preserve/clear manual override, check Momentum/Today/Week, refresh, correct/void history, and verify active timer recovery.
- [ ] Signed-in mobile review of expandable prediction details and automatic-estimate form.

### Durable design decisions

- Classification at M4 delivery: category → global with three usable observations. The deferred course/type dimensions and fuller hierarchy are now implemented in Milestone 4.5 above; they were not part of the original M4 commit.
- Parameters live in `lib/estimation/duration-estimation.ts`: minimum 3, newest 20 matching tasks, newest weight N down to oldest weight 1, sum(minutes × weight)/sum(weights). Rank uses completedAt descending, then task ID to resolve ties, without the current clock. Round to nearest 5 minutes (half up), floor 5 minutes. Do not cap real multi-session task totals at the manual-entry limit.
- Confidence is heuristic, never a probability: fallback/global low; category 3–7 medium; category 8–20 high. Count only usable observations, and never label broader global history high confidence.
- Eligibility: current status completed, valid completedAt, positive finite summed duration from ended non-void sessions with valid increasing timestamps and positive finite generated durationSeconds. Exclude zero/invalid sessions, active sessions, and any task with a non-void active session. Include completed soft-deleted tasks and archived category relationships. Exclude reopened tasks until recompleted; recompletion uses the entire retained eligible ledger and latest completion timestamp. Exclude the target itself. Session corrections/voids affect the next derivation.
- `Task.estimatedMinutes` / SQL `estimated_minutes` remains the manual value, now nullable. Existing values are preserved as overrides because earlier records cannot distinguish default entry from deliberate entry. New forms default blank; blank means automatic. Effective estimate is valid manual (integer 1–1440) → positive finite prediction → 25 minutes. Predictions never overwrite manual values. Compact expandable row details show both values, source/count/confidence, and precedence; Week uses the same effective minutes.
- Predictions are derived from repository task history and the shared TimerProvider session records, memoized against data changes. No prediction snapshots or new actual-time field. Estimate-at-completion snapshots for future error analytics remain a Milestone 6 decision; current predictions are not historical snapshots. Session load failures show workload/history unavailable instead of presenting missing data as no history.

### Verification and remaining acceptance

2026-10-03: Added 13 estimator tests, one real PostgreSQL estimation integration test, one repository request/nullable-write test, and extended the existing timer migration test to execute all three migrations and validate nullable/manual bounds. All 24 previous tests are retained (39 total). Embedded PostgreSQL verifies generated session totals, corrections/voids, completed deletion/reopening/recompletion, nullable overrides, and unchanged timer/RLS invariants. Typecheck initially found corrupt ignored `.next/dev/types` artifacts; removed only those generated files and regenerated successfully.

The native browser/Node tool cannot start because the Windows sandbox helper fails during setup. Elevated shell tools and bundled Playwright work. A fresh headless Chrome session verified production protected routes at desktop/mobile widths; it has no signed-in account, so no M4 authenticated browser flow is claimed. Hosted migration was not applied: there is no available authenticated dashboard/browser or database-management connection. README provides exact application instructions. M4 is **not fully accepted** until the unchecked hosted/browser items pass. No legitimate hosted task/session data was changed. Finish that acceptance before Milestone 5 Reading; Milestones 5–7 were not implemented.

---

## Milestone 3 — Persistent task timers and session history — complete 2026-10-01

The user authorized timing infrastructure only. This section supersedes older notes that defer timers; all prediction, analytics, reading, calendar integration, and scheduling work remains deferred.

### Recovery audit

The interrupted working tree already contained the timer migration, domain/repository contracts, Supabase adapter, account-level provider, task/global/history UI, Today/Tasks/Week integration, duration/database/adapter tests, hosted SQL acceptance script, and initial README notes. Those pieces were reviewed against the original 30-part prompt and preserved. No partial files, conflict markers, TODO implementations, or broken imports were found. BUILD_PLAN had not been updated, production/browser acceptance remained unfinished, and fresh-install README steps omitted the timer migration. Recovery corrects those documentation gaps, extends invalid SQL correction coverage, and completes validation before committing.

### Architecture and historical model

- `TimeSessionRepository` isolates persistence; the Supabase adapter checks the authenticated account, scopes reads/writes, paginates history, and reports failures. Existing task/category repository contracts remain intact.
- `time_sessions` has a compound owner/UUID primary key, compound task ownership foreign key with restricted deletion, canonical start/end timestamps, generated fractional seconds, creation/update timestamps, and `voided_at` for erroneous sessions. There is no independently stored task total.
- A partial unique index enforces one active session per account. Invoker-security RPCs use an account transaction lock, expected active-session consent, and idempotent request IDs. Confirmed switches stop/start in one transaction; stale confirmations fail safely.
- Database guards set start/stop timestamps, prevent reopening sessions and identity changes, validate corrections, and close timers on task completion/soft deletion. Completion and session end share a timestamp. Reopening a task does not restart timing.
- Account-level TimerProvider reconstructs sessions from Supabase, samples server time, and derives visible elapsed time from timestamps plus a monotonic clock. A one-second interval only redraws the display; focus/30-second refresh picks up other devices.
- Task rows and Week editing expose start/stop and correctable history. Week cards show actual time. A compact global bar remains across routes with Stop, Inspect time, and a task link. Actual time sums all non-void sessions, including the currently elapsed active period.
- Correction forms display local time, reject invalid/future ranges, and use optimistic `updated_at` checks. Removal retains the database row but excludes it from actual time. Completed/deleted tasks retain estimate, category, completion/history relationships.
- RLS permits only own reads/inserts/updates, compound ownership prevents foreign-task sessions, and anonymous/hard-delete grants are absent. Browser code uses only public configuration and the user's Auth session.

### Validation record

- All 24 automated tests pass, including both real migration files executed in PGlite, duration sums, midnight/DST, invalid/future/infinite corrections, retry/consent, uniqueness, lifecycle/completion/deletion, ownership/anonymous denial, adapter paging/scoping/stale-write filters, and previous task/category/week/import tests.
- Lint, TypeScript checking, and optimized production build pass. Production server starts successfully on port 3001; the final build passed signed-in Today/Tasks/Week smoke checks with clean browser error/warning logs. The temporary production process was stopped afterward.
- Hosted migration was applied through SQL Editor on 2026-09-30. The rollback-only `supabase/tests/timer_acceptance.sql` returned PASS for lifecycle, retry, switching, correction duration, completion timestamp, history retention, and simulated cross-owner RLS under the actual `authenticated` role.
- Browser QA passed against hosted Supabase: task creation/editing, all three sorts, Today carryover/workload, Week due-date placement/navigation/editing, category rename/recolor/archive/restore, start/stop/resume, canceled/confirmed switching, shared timer visibility, refresh, correction rejection, exact three-minute sum from two corrected sessions, removal reducing the total to two minutes, completion stopping timing, reopening without restart, and deletion closing the active session.
- Sign-out/sign-in retained the earlier session history. The user intentionally stopped/restarted/switched the QA timer between visits, so this is not evidence that the original session remained continuously active. The restarted session was restored after sign-in and refresh, including its multi-hour elapsed duration across midnight; earlier stopped sessions remained inspectable.
- Responsive QA at 320x740 and 1440x1000 covered Today, Tasks, Week/task editing, category controls, global timer, and session correction/history. No document overflow. Fixed task-form date/category clipping at <=400px by making fields a single column. No browser warning/error logs in the exercised flows.
- Cleanup soft-deleted only the two identified Timer QA tasks, archived their QA category, and voided their six timing sessions. Hosted SQL confirmed all six historical rows remain, are ended/excluded from actual totals, and retain exact generated durations. No legitimate user records were modified. Screenshots stay outside the repository; no sample data or debug code is shipped.
- Milestone 3 is accepted within the documented limits below. No further migration is required on the connected project; README contains reproducible setup for other environments.

### Limitations and deferred work

Cross-device UI synchronization polls every 30 seconds and on focus; database invariants remain authoritative. All sessions load for this personal-scale app. There is no offline queue, realtime engine, advanced timesheet/overlap validation, correction audit log, or user-facing restore for void/deleted records. A forgotten active timer continues until stopped/corrected. Local datetime inputs use the browser's interpretation of repeated DST hours; corrections use millisecond precision while original recorded durations retain database precision. Two real-account browser isolation and sustained concurrent-device stress were not performed; local two-owner SQL and hosted simulated-JWT RLS checks are distinct evidence.

Recommended Milestone 4, only after new authorization: a deterministic, explainable duration estimator with explicit task classification scope, minimum-history thresholds, and manual override. Do not begin it here.

---

## Milestone 2 — Supabase persistence and ownership — 2026-09-29

Implementation is complete for local validation; hosted acceptance remains pending credentials. This authorization supersedes the earlier instruction to defer Milestone 2, and narrows the original Tasks 2–4 to tasks/categories/auth/import only. Courses, books, time sessions, and predictive fields remain deferred.

- [x] Add @supabase/ssr and @supabase/supabase-js, public environment configuration, browser/server clients, and Next.js proxy session refresh.
- [x] Email/password sign-in for dashboard-created private accounts, persistent cookies, sign-out, account-scoped workspace remount, and setup/loading/error states.
- [x] Preserve TaskRepository/CategoryRepository interfaces and existing domain models; inject Supabase adapters through context without queries in task/category presentation components.
- [x] Reproducible SQL migration for tasks, categories, and local_imports, composite ownership keys/FK, date fields, constraints, indexes, timestamps, archive/soft-delete preservation, and archived-assignment guards.
- [x] Explicit RLS policies and grants for each owned table; no anonymous access or hard-delete privileges; identity immutability; invoker-security import RPC.
- [x] Consent-based local import with counts, stable fingerprint, atomic categories→tasks→archive restoration, preserved IDs/history, account/project local marker and transactional server ledger. Retain v1 and v2 recovery data.
- [x] Preserve existing Today/Tasks/Week presentation, filters, sort modes, workload calculations, editing, and category workflows; replace their persistence boundary only.
- [x] Document exact setup variables, migration application, private account creation, conflict/retry behavior, limitations, and live acceptance checklist in README.md.
- [x] Install dependencies; pass lint, typecheck, 20 automated tests, production build; smoke-check unconfigured browser UI.
- [ ] Apply migration to hosted Supabase and verify real Auth sessions and all data workflows end to end.
- [ ] Verify hosted RLS with two real accounts and direct REST access; verify hosted failure/expiry handling and import retry.

### Architecture and safety decisions

UI → existing asynchronous repository contracts → Supabase adapters → PostgreSQL. Local repositories remain solely for recovery/tests. Without configuration, show setup instructions instead of silently reverting to a competing local source. Session ownership is verified before operations and enforced by RLS; the import RPC additionally checks the expected account to reject a session-switch race. No service-role key is required.

The migration is `supabase/migrations/202609290001_milestone2.sql`. Text IDs preserve legacy IDs; `(user_id,id)` keys and a compound category FK enforce relationship ownership. Account deletion is restricted to preserve records. Category creation/update timestamps are new; task creation/completion/deletion timestamps are preserved. A database trigger disallows new assignments to archived categories while allowing historical references.

Import operates on a validated snapshot only after explicit consent. It inserts its ledger entry, categories, tasks, and archive states in one database transaction. Failure rolls everything back. Identical retries become no-ops. Conflicting names/IDs fail safely without overwriting cloud data; no automatic merging is attempted. A browser marker write failure is reported as a successful cloud import with a marker warning; the durable ledger still prevents duplicates. Local recovery data is never cleared.

### Validation evidence and limits

All 14 prior tests remain. Six additional tests cover repository request mapping/lifecycle/scoping/session changes and local import consent boundary/history/discovery/retry/recovery. One of those executes the actual SQL migration in embedded PostgreSQL (PGlite) using explicit test Auth fixtures: it verifies two-user RLS, anonymous denial, cross-owner FK/insert/update rejection, uniqueness/check constraints, task/category lifecycle, archive rules, complete historical import, no-op retries, and transactional rollback. PGlite is a dev-only dependency; no fixture runs in production.

Hosted Supabase was **not tested**: no environment credentials were present. Browser smoke verification covers setup state on direct Today and Week routes without credentials; signed-in UI workflows and real cookie persistence require hosted verification. Local success does not close those unchecked acceptance criteria.

No offline queue, realtime sync, merge/conflict editor, public signup, password-reset UI, or permanent-delete UI. Same-record concurrent cloud edits remain last-write-wins. No later milestone features were added. Recommended Milestone 3 after hosted acceptance: persistent timer sessions and refresh recovery, only after explicit authorization.

---
## Milestone 1.5 — Custom categories and Week view — 2026-09-29

The user explicitly added customizable categories and a due-date weekly workload view before Milestone 2. Week is now a sixth navigation destination. This is a local-only extension of Milestone 1; Supabase, authentication, timers, analytics, recurring tasks, and calendar integrations remain deferred.

### Verified checklist

- [x] Model categories with stable IDs, names, six-digit hex colors, and archive timestamps; tasks reference categoryId.
- [x] Create categories with arbitrary names and preset/custom colors, edit names/colors, and reuse them on tasks.
- [x] Share category badges/color indicators across Today, Tasks, category management, and Week.
- [x] Archive/restore categories without deleting task relationships or historical records; block new assignments to archived categories.
- [x] Migrate legacy name-based categories without duplicating repeated names or losing active/completed/deleted tasks.
- [x] Keep the original v1 document untouched and validate the full migrated document before an atomic v2 write.
- [x] Show Monday–Sunday due-date columns with daily incomplete counts and estimated workload, current-day indication, and relative workload bars.
- [x] Navigate previous/current/next week with a clear date range; stack days on phones and allow contained scrolling at intermediate widths.
- [x] Open calendar tasks in the existing task form and reuse existing completion/reopen/delete controls and repository operations.
- [x] Preserve Today/Tasks selection, all three sorts, task CRUD, workload totals, and refresh persistence.
- [x] Run lint, type checking, 14 automated tests, and production build successfully.
- [x] Verify category/task workflows and desktop/mobile rendering in the native browser at 1536x1024, 390x844, and 320x740.

### Architecture and migration

- Added types/category.ts and replaced TaskInput.category with categoryId. Names/colors are resolved from category records at render time, so changes propagate without rewriting tasks.
- TaskRepository and CategoryRepository expose asynchronous methods. Their local adapters share lib/storage/local-store.ts, which writes one document containing both collections. Components do not access localStorage, and no new dependency or global-state library was added.
- Storage uses personal-task-manager.data.v2. If absent, the adapter validates personal-task-manager.tasks.v1 and converts it once. Category names are trimmed and deduplicated case-insensitively; the first spelling is retained and each distinct category receives a stable UUID and initial palette color. All existing task fields except the replaced category-name field are preserved, including IDs and completion/deletion timestamps. The untouched v1 document retains the original names for recovery.
- Invalid data, dangling references, duplicate IDs, and invalid category colors prevent the write. Quota/access failures are surfaced without clearing previous data. A corrupted v2 document never silently falls back to the older snapshot.
- Archive is the only category removal operation. Existing active, completed, and soft-deleted tasks retain their references; editing other fields while keeping an archived category is allowed. New assignments require an active category. Restore reuses the same ID.
- Category text remains neutral/high-contrast; user color appears in small dots and calendar accent borders. Color is supplementary to the visible category name. One editable Personal category is supplied only when initializing an empty store.
- Week groups by dueDate, independently of scheduledDate. It includes completed tasks on their due dates with a Completed label but excludes them from remaining counts/minutes. Deleted and undated tasks do not appear. Date arithmetic operates on calendar dates to avoid DST drift. The week starts Monday.
- Existing task forms and rows are reused for Week editing/actions. UI state loads tasks/categories together from the shared repositories and refreshes after mutations or storage events.

### Verification evidence

- Automated tests: retained task/sort/workload tests plus migration deduplication and idempotence; all task-field preservation; untouched legacy recovery copy; failed migration/write protection; category lifecycle, duplicate-name/color validation, archiving/reassignment rules; invalid references; due-date grouping; completed/undated/deleted handling; Sunday, leap-year, DST, and year-boundary cases. All 14 pass.
- Native browser/IAB: created a purple custom category and assigned tasks; renamed/recolored it blue and checked consistent computed colors; archived/restored it and edited an existing task while archived; created another custom hex-color category and reassigned a task. Names/colors updated across Today, Tasks, and Week and survived refresh.
- Week browser checks: correct day placement/counts/minutes; previous/current/next navigation; current-day label; editing task title, duration, and due date moved it to the right day; completion changed daily totals to zero while preserving the task; reopening restored workload; deletion removed it from Week and Tasks after refresh; undated tasks stayed in Tasks.
- Rechecked Momentum, Priority, and Deadline ordering after category changes. Mobile task/category editing worked at 390px and 320px without document overflow. Desktop showed seven readable columns. No relevant browser warning/error logs or framework overlay during the tested flows.
- Temporary QA tasks were removed from active lists and QA categories archived after verification. Screenshots were saved outside the repository. No sample tasks are seeded into the application.
- Production startup and /week smoke test passed at http://127.0.0.1:3001/week with the correct title, loaded calendar, current-day indication, and no browser warning/error logs.

### Limitations and next step

Data remains browser/origin-local, without authentication, cloud backup, or cross-device synchronization. Concurrent-tab writes remain last-write-wins. Use the upgraded app in all tabs: edits from old Milestone 1 builds still target v1 and are not merged after v2 migration. The legacy document is a recovery snapshot, not a live backup. Calendar due dates are date-only, and the week start is fixed to Monday. The existing ESLint 9 compatibility pin remains unchanged.

The repository boundaries and stable category IDs are ready for Supabase adapters, category foreign keys, and ownership policies in Milestone 2. Database migrations, authentication/RLS, and a safe local-data import still need to be implemented and verified after the user's next authorization. Do not begin Milestone 2 in this session.

---

## Milestone 1 scope update — 2026-09-28

The user explicitly authorized a local-only frontend milestone before the original Supabase/authentication sequence. This supersedes the original database-first ordering for Milestone 1 only; the complete V1 requirements below remain in scope for later milestones. Local CRUD does not satisfy the eventual Supabase acceptance criteria.

### Verified Milestone 1 checklist

- [x] Scaffold Next.js App Router, TypeScript, and Tailwind in the existing inner repository root, without another nested application folder.
- [x] Preserve project guidance and review the existing .gitignore; it already covers dependencies, builds, local secrets, and test output.
- [x] Correct README references and document setup, commands, architecture, and local persistence.
- [x] Responsive navigation for Today, Tasks, Analytics, Reading, and History.
- [x] Today landing page and functional all-tasks view; honest future-milestone placeholders elsewhere.
- [x] Create, edit, complete, reopen, and confirm deletion of tasks.
- [x] Typed title, category, priority, due date, estimate, status, identity, and timestamps; add a planned date to support Today correctly.
- [x] Momentum, Priority, and Deadline sorting with independent manual priorities.
- [x] Remaining workload calculated from the displayed incomplete tasks.
- [x] Versioned local-storage adapter behind an asynchronous TaskRepository interface.
- [x] Validate inputs, preserve malformed saved data, and report storage failures without silently resetting data.
- [x] Lint, TypeScript check, six automated business/repository tests, and production build pass.
- [x] Browser verification: create/edit/complete/reopen/delete, refresh persistence, all sort modes, future scheduling, navigation, and desktop/mobile layouts.

### Implementation decisions and validation

- UI components call a task hook/repository; storage and business rules live under lib/tasks. No state library, Supabase, authentication, timer, prediction, or fake data was added.
- Today includes unfinished tasks scheduled today or earlier and tasks due today/overdue; completed tasks appear on their local completion day. Tasks includes future work and older completions. Dates use the browser's local calendar. Due times remain deferred.
- Categories are editable strings for this local milestone, with suggestions derived from existing tasks. Database category records remain required when Supabase is added.
- Completion retains records. Deletion sets deletedAt and hides the record after confirmation; no restore UI yet. No historical session data exists in this milestone.
- Storage key: personal-task-manager.tasks.v1. Data remains in the current browser/origin; no cross-device sync or backup. Cross-tab storage events refresh the list, but simultaneous writes are last-write-wins.
- Native browser/IAB tests used 1536x1024, 390x844, and 320x740 viewports. No horizontal overflow at the tested mobile widths; no browser warning/error logs in the tested flows. Test-created tasks were removed from active lists after verification.
- Six Node tests cover independent sort order, Today/date boundaries and workload, input validation, repository lifecycle/persistence, malformed storage protection, and unavailable/full storage.
- ESLint 10 crashes the current Next.js React plugin. Pin ESLint 9.39.5 until upstream support is available; its npm deprecation warning remains documented. All lint rules pass, and installation audit reported zero vulnerabilities.
- next.config.ts explicitly sets the application root and disables generated agent rules, preserving AGENTS.md. Sandbox Git overrides are command-scoped only.

### Visual review

- Compared the generated desktop concept and native-browser screenshot with view_image at 1536x1024. Reviewed sidebar geometry/navigation, heading and control typography, white/gray/forest-green palette, quick-entry form spacing, and empty-state layout/copy.
- Increased desktop typography and form-control spacing after the first comparison. The final render preserves the concept's hierarchy, palette, navigation, and open layout.
- Intentional functional differences: an editable category field supports custom categories, and a planned-date input replaces the concept's simple today checkbox so future tasks and carryover work are unambiguous. Native select/date controls follow browser styling.
- Above-the-fold copy matches the concept except for the intentional planned-date label change; responsive navigation moves above the content at mobile widths. No imagery, fabricated task data, or analytics panels were introduced.

### Deferred and next milestone

Supabase, authentication/RLS, timers, prediction, actual analytics, reading tracking, manual drag ordering, deadline times, and completed-workload summaries remain deferred. Recommended Milestone 2: Supabase schema/migrations, authentication and ownership checks, repository replacement, and a safe import path for existing local tasks (original Tasks 2–4). Obtain the user's next scope before proceeding.

---

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

- [x] Create a Git repository.
- [x] Create the Next.js application.
- [x] Enable TypeScript.
- [x] Configure Tailwind CSS.
- [x] Confirm the application runs locally.
- [x] Add `.gitignore`.
- [x] Add `.env.example`.
- [x] Add `PROJECT_OVERVIEW.md`.
- [x] Add `BUILD_PLAN.md`.
- [x] Add `AGENTS.md`.
- [x] Open the repository in Codex and confirm root `AGENTS.md` is loaded.
- [x] Check availability of the recommended skills for the first milestone; add only those that fit current work.
- [x] Make initial Git commit.

### Acceptance Criteria

- Local dev server starts successfully.
- TypeScript works.
- Tailwind styles render.
- Repository contains no secrets.
- Initial commit exists.

### Implementation Notes

- 2026-09-28: Initialized the app in the existing repository. Initial Git commit already existed (e2f6e32 was the starting HEAD). No extra nested folder. Framework, frontend, and React guidance consulted. Dev server, lint, typecheck, tests, and build verified. See Milestone 1 update above for scope and tooling limitations.

---

# 7. Supabase Setup

## Task 2 — Connect Supabase

- [x] Create Supabase project. (Done 2026-09-29; hosted "Task Manager" project live and verified 2026-10-04.)
- [x] Add required environment variables. (`.env.local` holds `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; same vars set on the Netlify deploy 2026-10-04.)
- [x] Create browser/client Supabase helper. (`lib/supabase/client.ts`)
- [x] Create server Supabase helper. (`lib/supabase/server.ts`)
- [x] Confirm a server-side database request succeeds. (Verified through app flows and SQL Editor 2026-10-04.)
- [x] Typed database support — N/A: explicit TypeScript domain types are used instead of generated types (see AGENTS.md).
- [x] Document local environment setup in README. (README "Set up Supabase" section.)

### Acceptance Criteria

- Local app can connect to Supabase.
- Secrets are not committed.
- Server/client boundaries are clear.
- A simple connection test succeeds.

### Implementation Notes

- Completed 2026-09-29 with the M2 persistence milestone; reconfirmed against the hosted project 2026-10-04 (all six migrations applied, RLS/policies/RPCs verified, app flows passing).

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

- [x] Desktop navigation.
- [x] Mobile navigation.
- [x] Active route state.
- [ ] User/logout control.
- [x] Responsive page container.
- [x] Shared loading/error patterns.

### Acceptance Criteria

- All sections are reachable.
- Navigation works on desktop and mobile.
- No horizontal overflow on common mobile widths.

### Implementation Notes

- 2026-09-28: Responsive shell and all five routes verified. Today and Tasks are functional locally; other pages state their future scope. User/logout controls deferred with authentication.

---

# 12. Task CRUD

## Task 7 — Build Task Management

Implement:

- [x] Create task.
- [x] Edit task.
- [x] Complete task.
- [x] Reopen task.
- [x] Archive/delete task behavior.
- [x] Assign category.
- [x] Assign course (M4.5; hosted acceptance passed 2026-10-04).
- [x] Assign task type (M4.5; hosted acceptance passed 2026-10-04).
- [x] Assign priority.
- [ ] Assign due date/time.
- [x] Assign scheduled date.
- [x] Enter manual estimate.
- [ ] Add notes/description.
- [x] Validate input.

### Acceptance Criteria

- CRUD uses real Supabase data.
- Refresh does not lose changes.
- Completed tasks retain historical data.
- Errors are visible and actionable.
- Empty states exist.

### Implementation Notes

- 2026-09-28: Verified these operations using the user-authorized local-storage adapter. Due DATE is implemented; due TIME is deferred, so the combined date/time checkbox remains unchecked. Course, task type, notes, Supabase CRUD, and ownership validation remain pending. Completed/deleted records are retained locally.

---

# 13. Today Dashboard

## Task 8 — Build Today Page

Required sections:

- [x] Today task list.
- [ ] Overdue task section.
- [x] Quick-add task.
- [x] Total estimated workload.
- [ ] Completed workload.
- [x] Remaining workload.
- [x] Start timer control.
- [x] Complete task control.
- [x] Sorting selector.

Sorting modes:

- [x] Momentum.
- [x] Priority.
- [x] Deadline.
- [ ] Manual.

### Momentum Rule

Order incomplete tasks by best available duration:

1. valid manual estimate (deliberate override; see Milestone 4)
2. valid derived predicted duration
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

- 2026-09-28: Verified local Today selection, incomplete planned workload, and all three sorts. Overdue due dates are visibly labeled inline, rather than a separate section. Estimates are manual in Milestone 1. At this dated M1 checkpoint timers/predictions were pending; M3/M4/M4.5 implemented them. Completed-workload totals and persisted manual ordering remain pending.

---

# 14. Timer System

## Task 9 — Implement Persistent Timer

Required behavior:

- [x] Start task session.
- [x] Stop task session.
- [x] Persist start timestamp immediately.
- [x] Support multiple sessions per task.
- [x] Restore active timer after refresh.
- [x] Prevent accidental duplicate active sessions.
- [x] Calculate task total actual duration.
- [x] Display active elapsed time.
- [x] Handle abandoned/open sessions safely.

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

2026-10-01: Completed and verified by Milestone 3 above. Durable sessions, database-enforced one-active rule, server timestamps, global visibility, correction/history, completion/deletion triggers, and RLS are implemented. See the Milestone 3 validation record and README for evidence, migration instructions, and limitations.

---

# 15. Duration Estimation

## Task 10 — Implement V1 Prediction Engine

Create estimation logic outside React components.

Suggested location:

```text
lib/estimation/
```

Matching hierarchy:

1. same course + task type
2. same course
3. same category + task type
4. same task type
5. same category
6. general completed-task history
7. no prediction; effective estimate uses manual or 25-minute default

All levels are implemented by M4.5 and require at least three eligible observations. Manual override takes precedence over every prediction level. Missing classifications skip their corresponding levels.

Required:

- [x] Query historical comparable tasks.
- [x] Derive actual duration from time sessions.
- [x] Implement weighted recent average.
- [x] Require a reasonable minimum history before displaying a strong prediction.
- [x] Return metadata describing prediction source.
- [x] Derive predicted duration when needed; snapshot persistence implemented locally in Milestone 6; hosted M6 application pending.
- [x] Allow manual estimate to remain visible separately (signed-in browser acceptance passed 2026-10-04).

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

2026-10-03: Pure estimator, nullable manual override, retained task history, shared Momentum/Today/Week calculations, and compact estimate details implemented. Algorithm, eligibility, parameters, tests, migration instructions, and pending hosted/browser acceptance are recorded in Milestone 4 above. The pending checks passed against hosted Supabase 2026-10-04 — M4 is accepted (mobile and cross-account checks deferred).

2026-10-03: M4.5 adds independent course/task-type records and all comparison levels without changing estimation mathematics or effective-estimate precedence. See the M4.5 ledger for local SQL/browser evidence and remaining hosted acceptance.

---

# 16. Reading Tracker

## Task 11 — Build Reading Section

Required:

- [x] Add book.
- [x] Edit book.
- [x] Mark book completed.
- [x] Update current page.
- [x] Set weekly page target.
- [x] Add reading session.
- [x] Store pages read.
- [x] Store minutes read.
- [x] Display current progress.
- [x] Display weekly quota progress.
- [x] Calculate average pages/day.
- [x] Estimate completion date.
- [x] Show completed-book history.

### Acceptance Criteria

- Reading progress persists.
- Page counts are validated.
- Weekly quota is calculated from reading sessions.
- Completion projection handles insufficient history gracefully.

### Implementation Notes

2026-10-03: Implemented and locally/browser verified by M5 above. These flags refer to local PostgreSQL and synthetic real-component UI acceptance; hosted persistence/sign-in acceptance remains pending in the M5 ledger. Completed/archived books and correctable session history are available within Reading; the unified History page remains M6/M7 scope.

---

# 17. Analytics

## Task 12 — Build Analytics Service

Do not put core analytics math directly inside chart components.

Suggested location:

```text
lib/analytics/
```

Required metrics:

- [x] Total tracked time this week.
- [x] Total tracked time this month.
- [x] Study time — task timer time with `course_id != null`, including archived courses; see M6 ledger.
- [x] Non-study productive time — task timer time with `course_id == null`; reading remains separate; see M6 ledger.
- [x] Reading time.
- [x] Time by category.
- [x] Time by course.
- [x] Time by day.
- [x] Tasks completed.
- [x] Average task duration.
- [x] Estimated vs actual duration.
- [x] Prediction error.
- [x] Pages read per week.

### Acceptance Criteria

- Metrics are derived from real session/task data.
- Date boundaries are handled consistently.
- Analytics logic is testable without rendering charts.

### Implementation Notes

2026-10-04: Implemented and locally verified by the M6 ledger above. The authorized follow-up completes study/non-study classification from course assignment; reading remains separate. Hosted rollout remains unchecked.

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

- [x] Responsive layout.
- [x] Empty states.
- [x] Human-readable duration formatting.
- [x] Date-period selector if feasible.

### Acceptance Criteria

- Charts match underlying metrics.
- Mobile view remains readable.
- Dashboard remains useful with limited history.

### Implementation Notes

2026-10-04: Implemented and locally verified by the M6 ledger above. Existing study/non-study summary cards now display domain-calculated course-assignment totals; reading remains separate. Hosted rollout remains unchecked.

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

- [x] Duration estimator.
- [x] Time-session aggregation.
- [x] Daily workload calculation.
- [x] Reading quota calculation.
- [x] Analytics date grouping.
- [x] Task sorting.
- [x] Priority ordering.
- [x] Deadline ordering.

Where practical, add integration tests for:

- [ ] Authentication-protected routes.
- [ ] Task creation.
- [x] Timer lifecycle.
- [x] Reading-session creation (local PostgreSQL + browser fixture; hosted passed 2026-10-04).

### Acceptance Criteria

- Critical calculation logic has automated coverage.
- Tests run consistently from a documented command.
- Tests do not depend on random production data.

### Implementation Notes

- 2026-10-03 M5: 15 Reading tests added; 80 total pass, including quota/session lifecycle, ownership, progress, projection and time overlap.

- 2026-10-03 M4.6 audit: estimator and aggregation are verified by retained M3/M4/M4.5 tests; timer lifecycle passes embedded PostgreSQL with all five migrations. These flags describe local automated coverage, not new hosted acceptance.

- 2026-09-28: Six passing Node tests cover sorting, Today selection, workload, validation, local persistence, retained deletion, and storage failures. Browser/IAB covered creation/editing/completion/reopening/deletion, refresh persistence, scheduling, sorting, navigation, and mobile editing. Future timer, reading, analytics, and authentication tests remain pending.

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
