# Personal Task Manager

Private task management with Today, Tasks, Week, custom color categories, optional courses and task types, customizable topics, and Supabase-backed accounts. Momentum, Priority, and Deadline sorting remain independent of manual task priority. Completed tasks and soft-deleted records are retained. Persistent task timers, correctable session history, and deterministic duration estimation are implemented. Reading books, progress, correctable sessions and weekly goals are implemented. M4/M4.5/M4.6/M5 are implemented, migrated to hosted Supabase, and hosted-accepted 2026-10-04 (see BUILD_PLAN.md). The app is deployed to Netlify. Analytics and calendar integration remain deferred.

See [BUILD_PLAN.md](BUILD_PLAN.md), [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md), and [AGENTS.md](AGENTS.md).

## Set up Supabase (one time)

1. Create a project at https://supabase.com/dashboard. Keep its database password private.
2. Open the project's **SQL Editor**, create a query, paste the entire contents of `supabase/migrations/202609290001_milestone2.sql`, and run it **once**. Then run `supabase/migrations/202609300001_time_sessions.sql`, `supabase/migrations/202610030001_optional_manual_estimate.sql`, `supabase/migrations/202610030002_task_classification.sql`, `supabase/migrations/202610030003_task_topics.sql`, and `supabase/migrations/202610030004_reading.sql` once each, in that order. These create the owned records, constraints, indexes, triggers, RLS policies and RPCs, allow blank manual estimates, and add optional classification references. Do not create tables manually. Use a fresh project/schema; subsequent schema changes should be new migrations.

3. In **Authentication → Sign In / Providers**, enable Email/password. Disable public signups for this private application. Under **Authentication → Users → Add user → Create new user**, create your email/password account and mark the email confirmed. There is intentionally no public registration or password-reset UI; manage the private account in the dashboard.
4. Copy the project URL and **publishable** API key from the project's Connect/API settings. Never use a secret or service-role key. Create `.env.local` in the inner repository (next to `package.json`):

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   ```

   Fill those values with your project's URL and publishable key. `.env.local` is ignored by Git. `.env.example` contains only the expected variable names. These two values are intentionally public browser configuration; the user's session and database RLS authorize data access. Restart development after changing them; rebuild production because Next.js embeds public environment variables at build time.
5. Run the app and sign in. If you have old browser data, use the **same browser profile and exact origin** (hostname and port) used previously, then choose **Import local data** before creating conflicting categories. A new account without local data starts empty: use **Manage categories** to create a category, then add tasks.

The auth integration follows the [Supabase Next.js SSR guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs). Password sign-in requires no email redirect callback. `@supabase/ssr` maintains session cookies; `proxy.ts` refreshes/verifies claims. The browser verifies the active Auth user before repository operations. Sign-out removes the workspace from the UI. Account changes remount it so previous-account tasks and forms are discarded.

### Optional CLI migration workflow

The SQL Editor route above needs no CLI. For ongoing migration tracking, use the official Supabase CLI instead, from the repository root:

```powershell
npx supabase login
npx supabase init
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Choose either SQL Editor or CLI for the initial application. If you already ran this exact migration in the SQL Editor and then adopt CLI tracking, use `npx supabase migration repair 202609290001 --status applied` after linking; do not run the initial SQL twice. Never commit CLI credentials. The CLI stores ignored local state under `supabase/.temp`.

## Run locally

Use Node.js 22.18+ and npm. The actual repository is the inner `Task-Manager` directory:

```powershell
cd Task-Manager
npm ci
npm run dev
```

Open http://localhost:3000. `/` redirects to `/today`. Without both environment variables, the application shows a setup screen; it does not silently fall back to browser storage or upload local records.

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Stop the dev server before `npm start` if both use port 3000.

## Architecture and database

Data flow: **UI → existing asynchronous TaskRepository / CategoryRepository interfaces → Supabase adapters → PostgreSQL**. React task/category components contain no Supabase queries. `AuthGate` manages sign-in and consent UI; `lib/storage/local-import.ts` owns import logic. `lib/supabase/repositories.ts` maps snake_case SQL rows to the unchanged camelCase domain models. `useTasks` receives the repositories through context. Local adapters remain available for recovery/tests but are never a competing live data source.

- `categories`: `(user_id, id)` primary key, name, color, archive timestamp, created/updated timestamps; case-insensitive unique names per account, including archived names.
- `tasks`: `(user_id, id)` primary key, title, category reference, priority, due/planned dates, estimated minutes, status, creation/update/completion/deletion timestamps. Date-only scheduling semantics are unchanged.
- `local_imports`: `(user_id, dataset_id)` primary key and import timestamp. This is the durable account import ledger.
- IDs remain text to preserve valid legacy IDs, including non-UUID IDs. Compound keys allow another account to have the same local ID without collision. Ownership references `auth.users`; the compound task-category foreign key prevents cross-owner references.
- Validation constraints cover titles, names, colors, estimates, statuses, and completion consistency. Update triggers preserve identity/creation time and maintain `updated_at`. A task cannot be newly assigned to an archived category; an existing assignment can remain while editing other fields.
- Indexes cover ownership, category references, due dates, and planned dates. Repository reads page in batches of 500 to avoid the default PostgREST row limit dropping older records.

RLS is enabled on all three tables. Authenticated users can SELECT/INSERT/UPDATE only their own tasks/categories (`auth.uid() = user_id` in both USING and WITH CHECK). Import ledger permits own SELECT/INSERT only. Anonymous users have no table permissions. There are no hard DELETE grants/policies. IDs/owners are immutable on updates. Account deletion is deliberately restricted by ownership foreign keys to prevent accidental history loss.

The import RPC uses **SECURITY INVOKER**, preserving RLS. It derives record owners from `auth.uid()`, and checks the expected authenticated account to reject account-switch races. It never accepts ownership fields from local records. No service-role key is used anywhere in the application.

## Safe local import

After sign-in, the app checks for `personal-task-manager.data.v2` or the older `personal-task-manager.tasks.v1`. An empty browser does not get a fabricated dataset. Existing v1 data uses the original validated v1→v2 migration; v1 remains untouched. Corrupt data displays a recovery error and is never reset.

The prompt reports task/category counts and uploads nothing until **Import local data** is clicked. It includes archived categories and every task, including completed/deleted history. A SHA-256 fingerprint identifies the stable snapshot. The database imports categories first, then tasks, then restores category archive timestamps, all in one transaction with its import ledger entry. Task IDs, relationships, statuses, and existing timestamps are retained. Categories had no creation timestamps locally, so these receive the import time.

Retries of the same dataset/account are no-ops, including retries after a lost response or failed browser-marker write. A local marker is scoped to project URL, account ID, and fingerprint; the server ledger also suppresses repeat offers after marker loss. Original v1/v2 data is retained, never deleted, and no ongoing local/cloud synchronization occurs. Another account requires its own explicit consent; only import browser records belonging to that account.

Conflicting cloud IDs or category names abort the whole import without overwriting anything. Import before creating matching categories where possible. There is no automatic merge or conflict editor; preserve the local snapshot and resolve conflicts deliberately (for example, rename a conflicting cloud category) before retrying. Changed/overlapping recovery snapshots are not incrementally merged. Clearing all site data loses the local recovery copy, but not committed cloud data.

## Daily behavior and errors

Today includes unfinished work planned today or earlier, due today/overdue, and tasks completed today. Tasks includes future work and older completions. Week shows Monday–Sunday by due date, with daily incomplete counts and estimated workload; completed tasks remain visible but do not count toward remaining workload. Undated tasks remain in Tasks. Category changes propagate through stable references; archive/restore retains historical relationships.

Cloud operations finish before success is displayed. Loading and save errors are visible; retry loading after connection/session failures. No offline write queue, realtime subscription, or conflict resolution engine is included. Refresh/focus reloads cloud data; simultaneous edits use last-write-wins. Do not edit the retained local snapshot with old builds after importing.

## Verification and remaining acceptance checks

Verified locally: dependency installation (zero audit vulnerabilities), lint, TypeScript, production build, and 20 automated tests. The original 14 tests still pass. New tests exercise adapter CRUD/lifecycle, owner scoping, session changes, import discovery/consent boundary, v1 recovery, empty/corrupt storage, history/relationships, marker failures, and duplicate suppression. Explicit HTTP fixtures test adapters; they are never used by the app.

`tests/database.test.ts` runs the **actual migration SQL** on embedded PostgreSQL (PGlite), with test-only Auth roles and `auth.uid()` fixture. It checks two-user isolation, anonymous denial, ownership spoofing, lifecycle/constraints, archived assignments, historical import, duplicate retries, conflict rollback, and failed-import atomicity. This is actual local SQL execution, not a hosted Supabase test. Browser smoke checks cover the missing-configuration screen on direct Today and Week routes, with no browser warning/error logs.

**Live Supabase verification (updated 2026-10-04):** the M2 migration is applied to the hosted project; sign-in/out and refresh, and task/category CRUD across Today/Tasks/Week, were verified through the real app. Remaining: session-expiry and cross-tab account-change behavior, import recovery retry, offline/save-failure handling, and two-real-account REST isolation checks.

ESLint remains pinned to 9.39.5 for compatibility with the current Next.js React plugin. The Milestone 2 verification record above is historical. See the Milestone 3 section below for the timer implementation and migration.

## Milestone 3: persistent task timers

The timer migration is `supabase/migrations/202609300001_time_sessions.sql`. It was applied to the connected hosted project through SQL Editor on 2026-09-30; do not rerun it there. For another environment, apply Milestone 2 first, then paste this entire new migration into SQL Editor and Run once, or use `npx supabase db push` with your linked/tracked project. If adopting CLI after the dashboard application, mark this already-applied migration with `npx supabase migration repair 202609300001 --status applied`. No new environment variables are needed. The existing public-key variable also accepts the legacy anon public key; never supply service-role credentials.

Each task has **Start timer**, **Stop timer**, **Actual**, and **Time history** controls. Week exposes them through its existing task editor and shows actual time on calendar entries. A shared compact bar keeps the current timer visible across routes, links to its task, and offers Stop and Inspect time. Stop ends the current work period; Start again creates another session. Closing the browser, navigating, or signing out does not stop the saved session. If a timer was forgotten, stop it and correct its recorded times.

`time_sessions` stores owner, UUID, task reference, start/end UTC timestamps, generated fractional duration in seconds, creation/update timestamps, and an optional removal timestamp. The task reference includes ownership. Sessions have RLS for own SELECT/INSERT/UPDATE, no hard DELETE grant, and an index on task history. A partial unique index permits only one active session per account. The task's total is the sum of non-removed session durations, including the visible elapsed active period; there is no separate cached task total.

`TimeSessionRepository` and its Supabase adapter own all persistence. The account-level TimerProvider loads saved sessions, synchronizes its clock against server time, and updates the display using elapsed monotonic time rather than incrementing a counter. Recorded start/stop timestamps are set by PostgreSQL, so device clock changes cannot corrupt durations. Reload/sign-in reconstructs the active timer from the database. A 30-second refresh and window-focus refresh pick up other devices; this is not realtime synchronization.

Starting a different task asks for confirmation, then a single RPC stops the expected current session and starts the new one transactionally. A stale confirmation fails without stopping an unexpected session. An account lock serializes starts; the unique index also protects direct writes. Request IDs make start retries idempotent; stop targets an exact session and an already-stopped session is a no-op. Task completion and soft deletion close the active session through a database trigger, even for writes outside this UI. Completion uses the same server timestamp as the stopped session. Reopening never starts a timer; ordinary edits leave timing intact.

In **Time history**, stop an active session first, then correct its local start/end timestamps or remove an erroneous session. PostgreSQL enforces `end > start`, finite timestamps, and no future corrections, and automatically recalculates fractional seconds. Correction writes include the previously loaded `updated_at` so stale edits fail instead of overwriting another device's correction. Removal excludes the session from totals but retains its record. Displayed times use the device timezone. Unchanged local fields retain their original UTC instant (corrections normalize to JavaScript millisecond precision); entering an ambiguous repeated local hour during a daylight-saving transition uses the browser's interpretation (usually the earlier occurrence). There is no timezone-setting or advanced timesheet UI.

Failures remain visible and controls require refreshed data before retrying uncertain writes. An old running indication may remain with an error until refreshed: it is not a claim that a failed stop succeeded. A completed server write followed by a failed reload is explicitly reported as saved with stale history. All sessions are currently loaded/paginated for this personal-scale application; future large-history optimization can add aggregation without changing the source of truth.

No prediction, analytics dashboard, task classification, reading tracking, calendar integration, or scheduling was added.


### Milestone 3 final verification — 2026-10-01

All 24 tests, lint, type checking, and the production build pass. Timer tests execute both actual migrations in PGlite and verify duration logic, lifecycle, consent/retries, correction constraints, completion/deletion, ownership, and adapter requests/errors. Existing task/category/week/import tests remain intact.

Live hosted SQL acceptance passed using `supabase/tests/timer_acceptance.sql` (a rollback-only test under the authenticated role). Cross-owner checks used a simulated second JWT subject, not a second real browser login. Browser checks against Supabase covered start/stop/resume, canceled/confirmed switching, navigation/refresh, edits while timing, exact corrected totals, removal, completion/reopen, deletion, categories, sorting, and Week workload. Session history survived sign-out/sign-in. The user stopped/restarted the QA timer between visits; the restarted timer and earlier history were recovered, rather than claiming uninterrupted operation of the original session.

Desktop (1440px) and narrow (320px) QA passed without horizontal overflow. Task fields now stack below 400px so native dates remain readable. QA tasks were soft-deleted, their category archived, and all six test sessions voided; historical rows remain recoverable but do not contribute to actual time. No real user records were removed. Multi-device load testing, two-real-account browser isolation, and real network-outage testing remain unperformed; local SQL/adapter failure tests and hosted simulated-owner checks are the available evidence. See BUILD_PLAN.md for the full validation record and deferred scope.

### Milestone 4 upgrade and estimation

For an existing M3 database, apply **only** `supabase/migrations/202610030001_optional_manual_estimate.sql` once through SQL Editor, or your linked/tracked CLI migration workflow. This upgrade has not yet been applied to the connected hosted project. Existing manual estimates are preserved; the column becomes nullable while its 1–1440 bound and existing RLS remain intact. Apply it before using blank estimates in the updated application.

Leave Manual estimate blank for automatic estimation. A manual value always overrides the prediction for Momentum, Today, and Week. Expand Estimated on a task row to see manual/predicted values, source, observation count, and heuristic confidence. Three valid completed timed tasks are needed; same-category history is preferred, then global history, then a 25-minute effective default. The newest twenty comparable tasks use linear rank weights (newest N, oldest 1), rounded to nearest five minutes with a five-minute floor.

Completed soft-deleted tasks remain training history. Reopened tasks are excluded until completed again. Ended, non-void, positive finite session durations train predictions; active tasks do not. Correction/removal updates derived predictions after session reload. Predictions are not saved snapshots and there is no actual-duration cache. The original course/task-type deferral is implemented by M4.5 below; analytics snapshots remain deferred.

M4 local validation: lint, typecheck, 39 tests (including actual three-migration PostgreSQL estimation/timer tests), and optimized build pass. Production Playwright checks verified only protected sign-in routes at 1440px/320px. Hosted migration and signed-in task/prediction/timer/mobile acceptance remain pending; see BUILD_PLAN.md for the exact unchecked flows.

### Milestone 4.5 upgrade and classification

For the connected M3 project, apply the pending **M4 migration first**, then `supabase/migrations/202610030002_task_classification.sql` once through SQL Editor or the linked/tracked CLI workflow. Neither has been applied to the hosted project here. Do not rerun the already-applied M2/M3 migrations. If adopting CLI tracking after SQL Editor, mark only migrations actually applied using `supabase migration repair <version> --status applied`; never mark an unapplied migration complete. No new environment variables are needed.

Courses and Task Types are independent user-owned records. Use **Manage courses and task types** on Today/Tasks/Week to create, rename, archive or restore them. A course has a name and optional short code; task types are arbitrary names. Archived names remain visible on assigned tasks and in history but are excluded from new assignments. You can retain an existing archived assignment, remove it, or restore the classification. There is no hard deletion or course/category coupling.

Task capture now works with a title alone: dates/priority retain defaults, category is optional, and **Course and task type (optional)** expands compact selectors. Predictions select the first group with three observations: **course + type → course → category + type → type → category → global → default**. Null fields skip specific matching; insufficient groups are not combined. M4 weighting, twenty-observation cap, rounding and manual override are unchanged. Each completed task's current stored classifications drive matching, so reclassifying history changes future derived predictions. Renames update explanation labels without changing group IDs.

Local verification: **57 passing automated tests**, lint/typecheck/production build, actual four-migration PostgreSQL ownership/archive/reclassification/timer regressions, and an isolated real-component browser fixture. The fixture verifies all hierarchy levels, capture/editing, management/archives, manual override, shared Momentum/Today/Week estimates, refresh, timer UI, and 320px layouts using synthetic local data. It is not hosted Supabase acceptance.

Run the browser fixture with `npm run test:classification-ui`. It requires installed Chrome and Playwright; the bundled Codex runtime is used by default, or set `PLAYWRIGHT_MODULE` to an installed Playwright module path. The runner creates a temporary Next app and removes it afterward; no fixture route or seeded data ships with production. Hosted migration application and authenticated persistence/timer/reading flows were verified 2026-10-04 (see BUILD_PLAN.md); hosted mobile and cross-account checks remain open.


## M4.6 Topics/Tags

Topics describe specific subject matter and support zero/multiple assignments per task. Use **Manage topics** on Today, Tasks or Week to create, rename, archive or restore a topic; expand **Topics (optional)** in task capture/editing to select or remove assignments. Archives keep labels on existing/completed tasks and exclude new assignments. Topics do not affect estimates, Momentum, workload or timers.

Apply pending M4, M4.5 and then `supabase/migrations/202610030003_task_topics.sql` once, in order, using authenticated SQL Editor or a correctly linked/tracked CLI. This migration adds owned `topics`, the compound-owner `task_topics` join and atomic `save_task_with_topics` RPC. Existing tasks remain unchanged and start without topics. No new configuration is needed. All three migrations and authenticated hosted acceptance remain pending in this session; see BUILD_PLAN for evidence and release gates.

`npm test` includes embedded PostgreSQL topic lifecycle/RLS/atomicity and behavioral regressions. `npm run test:classification-ui` also exercises topic management, multiple selection, archived historical labels, refresh, Week and narrow editing in an explicitly synthetic local UI fixture. These do not claim hosted verification.


## M5 Reading Tracker

Use Reading to add books, set optional authors/weekly page goals, start/pause/complete reading and log pages with optional minutes. Book capture and logging collapse so active progress stays visible. Completed/archived books retain their session history; restore a book before logging again. History permits session correction and removal from totals while retaining the removed record.

Current page is derived from a progress adjustment plus nonremoved ledger pages. Manual current-page edits adjust that offset without rewriting history or counting as logged quota pages. New sessions start at current page. Corrections change derived progress/quotas; if a correction would put progress outside the book, adjust current page first. A correction below the final page reopens a completed book. Book/session revisions prevent stale writes; explicit Reload reading discards the stale editor so you can reopen fresh data.

Weeks run Monday–Sunday using local calendar session dates. Pace is logged pages per calendar day over up to the last 28 days, starting at the first logged date in that window and including nonreading days. Projections require three reading dates across seven days, use rounded-up remaining-pages/pace, and remain labeled estimates. No goal/history is handled without a fabricated quota or forecast.

**Time rule:** record minutes here only for reading-exclusive time, or mark **Already tracked with a task timer**. Flagged minutes stay in history but are excluded from additive reading time; task timers remain the authoritative source for those minutes. Unmarked overlap cannot be detected automatically from date-only records. M6 must keep the two sources distinct.

Apply pending M4/M4.5/M4.6 migrations and then `supabase/migrations/202610030004_reading.sql` once in order. No new environment variables are needed. M5 adds owned books/sessions, a security-invoker progress view, page/status/lifecycle guards, and atomic save/idempotent log RPCs. All four migrations and authenticated hosted acceptance remain pending here.

Run `npm test` for calculation, adapter and embedded PostgreSQL tests (80 total). `npm run test:reading-ui` verifies real Reading components in an explicit synthetic desktop/320px fixture; `npm run test:classification-ui` retains existing task/topic/estimation/timer UI regressions. Neither fixture connects to hosted Supabase. See BUILD_PLAN for the exact evidence and M6 readiness.
