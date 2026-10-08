# Personal Task Manager

Private task management with Today, Tasks, Week, custom color categories, and Supabase-backed accounts. Momentum, Priority, and Deadline sorting remain independent of manual task priority. Completed tasks and soft-deleted records are retained. Persistent task timers and correctable session history are available. Prediction, analytics, reading, and calendar integration remain deferred.

See [BUILD_PLAN.md](BUILD_PLAN.md), [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md), and [AGENTS.md](AGENTS.md).

## Set up Supabase (one time)

1. Create a project at https://supabase.com/dashboard. Keep its database password private.
2. Open the project's **SQL Editor**, create a query, paste the entire contents of `supabase/migrations/202609290001_milestone2.sql`, and run it **once**. Then run `supabase/migrations/202609300001_time_sessions.sql` once. Together these create the task/category/import and timer tables, constraints, indexes, triggers, RLS policies, and RPCs. Do not create tables manually. Use a fresh project/schema; subsequent schema changes should be new migrations.
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

Choose either SQL Editor or CLI for the initial application. If you already ran this exact migration in the SQL Editor and then adopt CLI tracking, mark both already-applied migrations after linking:

```powershell
npx supabase migration repair 202609290001 --status applied
npx supabase migration repair 202609300001 --status applied
```

Repair only migrations actually applied to that project; do not run either SQL file twice. Never commit CLI credentials. The CLI stores ignored local state under `supabase/.temp`.

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

## Architecture

Next.js App Router, React, TypeScript, Tailwind, Supabase/PostgreSQL/Auth. UI calls asynchronous repository contracts; Supabase adapters own database access. Local adapters serve recovery/tests only. Exact schema is defined by migrations, not planning field lists. BUILD_PLAN.md records architectural constraints, implementation status, and remaining acceptance.

## Safe local import

After sign-in, the app checks for `personal-task-manager.data.v2` or the older `personal-task-manager.tasks.v1`. An empty browser does not get a fabricated dataset. Existing v1 data uses the original validated v1→v2 migration; v1 remains untouched. Corrupt data displays a recovery error and is never reset.

The prompt reports task/category counts and uploads nothing until **Import local data** is clicked. It includes archived categories and every task, including completed/deleted history. A SHA-256 fingerprint identifies the stable snapshot. The database imports categories first, then tasks, then restores category archive timestamps, all in one transaction with its import ledger entry. Task IDs, relationships, statuses, and existing timestamps are retained. Categories had no creation timestamps locally, so these receive the import time.

Retries of the same dataset/account are no-ops, including retries after a lost response or failed browser-marker write. A local marker is scoped to project URL, account ID, and fingerprint; the server ledger also suppresses repeat offers after marker loss. Original v1/v2 data is retained, never deleted, and no ongoing local/cloud synchronization occurs. Another account requires its own explicit consent; only import browser records belonging to that account.

Conflicting cloud IDs or category names abort the whole import without overwriting anything. Import before creating matching categories where possible. There is no automatic merge or conflict editor; preserve the local snapshot and resolve conflicts deliberately (for example, rename a conflicting cloud category) before retrying. Changed/overlapping recovery snapshots are not incrementally merged. Clearing all site data loses the local recovery copy, but not committed cloud data.

## Daily behavior and errors

Today includes unfinished work planned today or earlier, due today/overdue, and tasks completed today. Tasks includes future work and older completions. Week shows Monday–Sunday by due date, with daily incomplete counts and estimated workload; completed tasks remain visible but do not count toward remaining workload. Undated tasks remain in Tasks. Category changes propagate through stable references; archive/restore retains historical relationships.

Cloud operations finish before success is displayed. Loading and save errors are visible; retry loading after connection/session failures. No offline write queue, realtime subscription, or conflict resolution engine is included. Refresh/focus reloads cloud data; simultaneous edits use last-write-wins. Do not edit the retained local snapshot with old builds after importing.

## Verification

At the recorded 2026-10-01 acceptance, 24 tests, lint, typecheck, and production build passed. Tests execute both actual migrations in PGlite with test-only Auth fixtures; hosted timer SQL and signed-in browser core-flow checks also passed. These are recorded results, not checks rerun by this documentation edit.

Use `supabase/tests/timer_acceptance.sql` for the rollback-only hosted timer acceptance check. Two-real-account browser/REST isolation, hosted import/retry, session-expiry, network-outage, and sustained multi-device checks remain outstanding; see BUILD_PLAN.md. ESLint stays pinned to 9.39.5 for the current Next.js React-plugin compatibility constraint.

## Persistent task timers

The timer migration is `supabase/migrations/202609300001_time_sessions.sql`. It was applied to the connected hosted project through SQL Editor on 2026-09-30; do not rerun it there. For another environment, apply Milestone 2 first, then paste this entire new migration into SQL Editor and Run once, or use `npx supabase db push` with your linked/tracked project. If adopting CLI after the dashboard application, mark this already-applied migration with `npx supabase migration repair 202609300001 --status applied`. No new environment variables are needed. The existing public-key variable also accepts the legacy anon public key; never supply service-role credentials.

Each task has **Start timer**, **Stop timer**, **Actual**, and **Time history** controls. Week exposes them through its existing task editor and shows actual time on calendar entries. A shared compact bar keeps the current timer visible across routes, links to its task, and offers Stop and Inspect time. Stop ends the current work period; Start again creates another session. Closing the browser, navigating, or signing out does not stop the saved session. If a timer was forgotten, stop it and correct its recorded times.

`time_sessions` stores owner, UUID, task reference, start/end UTC timestamps, generated fractional duration in seconds, creation/update timestamps, and an optional removal timestamp. The task reference includes ownership. Sessions have RLS for own SELECT/INSERT/UPDATE, no hard DELETE grant, and an index on task history. A partial unique index permits only one active session per account. The task's total is the sum of non-removed session durations, including the visible elapsed active period; there is no separate cached task total.

`TimeSessionRepository` and its Supabase adapter own all persistence. The account-level TimerProvider loads saved sessions, synchronizes its clock against server time, and updates the display using elapsed monotonic time rather than incrementing a counter. Recorded start/stop timestamps are set by PostgreSQL, so device clock changes cannot corrupt durations. Reload/sign-in reconstructs the active timer from the database. A 30-second refresh and window-focus refresh pick up other devices; this is not realtime synchronization.

Starting a different task asks for confirmation, then a single RPC stops the expected current session and starts the new one transactionally. A stale confirmation fails without stopping an unexpected session. An account lock serializes starts; the unique index also protects direct writes. Request IDs make start retries idempotent; stop targets an exact session and an already-stopped session is a no-op. Task completion and soft deletion close the active session through a database trigger, even for writes outside this UI. Completion uses the same server timestamp as the stopped session. Reopening never starts a timer; ordinary edits leave timing intact.

In **Time history**, stop an active session first, then correct its local start/end timestamps or remove an erroneous session. PostgreSQL enforces `end > start`, finite timestamps, and no future corrections, and automatically recalculates fractional seconds. Correction writes include the previously loaded `updated_at` so stale edits fail instead of overwriting another device's correction. Removal excludes the session from totals but retains its record. Displayed times use the device timezone. Unchanged local fields retain their original UTC instant (corrections normalize to JavaScript millisecond precision); entering an ambiguous repeated local hour during a daylight-saving transition uses the browser's interpretation (usually the earlier occurrence). There is no timezone-setting or advanced timesheet UI.

Failures remain visible and controls require refreshed data before retrying uncertain writes. An old running indication may remain with an error until refreshed: it is not a claim that a failed stop succeeded. A completed server write followed by a failed reload is explicitly reported as saved with stale history. All sessions are currently loaded/paginated for this personal-scale application; future large-history optimization can add aggregation without changing the source of truth.

No prediction, analytics dashboard, task classification, reading tracking, calendar integration, or scheduling was added.


## Week calendar experiment handoff (planned 2026-10-04)

No calendar feature or new migration is shipped by this documentation update. The latest `BUILD_PLAN.md` checkpoints govern current status; earlier acceptance summaries in this README are historical. M4–M5 hosted application and focused acceptance are documented there, and their migrations must not be replayed.

For the authorized Week rebuild, use `WEEK_CALENDAR_PROMPTS.md` in order: setup/scaffold, Phase 1, then Phase 2 after verifying Phase 1. Work only on `experiment/week-calendar`. Setup permits one scoped local commit; neither feature phase permits commits, pushes or merges. No deployment or hosted database changes are authorized by these prompts.

Install the updated context under canonical repo names: `AGENTS.md`, `PROJECT_OVERVIEW.md`, `BUILD_PLAN.md`, `README.md`, and `WEEK_CALENDAR_PROMPTS.md`. Compare with the actual repository first and preserve newer implementation notes. The uploaded filename suffixes do not change repository filenames. The setup survey must confirm repository location and code paths, which were not inspected in the documentation session.

Future calendar migrations must be unique and ordered after the repository's actual latest migration. Record each as authored, locally tested, and NOT applied to hosted. SQL Editor/CLI instructions elsewhere in this README describe operations, not permission for Codex to apply these experiment migrations. Apply/reconcile new migrations only in a separately authorized hosted step, then verify real persistence. Before that, record production-backed acceptance as pending and use the existing local schema-backed QA approach where supported, with fixtures clearly labeled.

Due times and calendar blocks use floating browser-local dates/times, not UTC deadlines. Recurrence remains weekly only. Events/classes use retained removal and restore; deleting a QA event must never physically erase it. Sidebar availability subtracts overlapping recorded blocks once within the visible planning window, and does not measure unrecorded commitments.

### Phase 1 local verification and hosted gate — 2026-10-04

Phase 1 is implemented locally on `experiment/week-calendar`; see the newest `BUILD_PLAN.md` checkpoint. `supabase/migrations/202610040002_task_due_time.sql` is authored and tested against the full embedded PostgreSQL chain, **NOT applied to hosted**. It follows `202610040001_analytics.sql`. Reconcile the actual hosted migration state before any separately authorized application; do not replay applied migrations. No hosted database administration or deployment is authorized by this note.

Do not exercise this branch's task writes against the old hosted schema: direct writes require `due_time`, and the old topic RPC may silently ignore the new JSON field. Use `npm test` for local schema-backed adapter persistence checks and `npm run test:classification-ui` for the explicit local component fixture. After separately authorized migration application/schema refresh, signed-in save/read/clear/reload and ownership acceptance remain required. No new environment variables are needed.

Week organization is an account-scoped browser preference, not cloud-synchronized. Invalid/unavailable storage falls back safely; due times remain floating local `HH:mm` values. Phase 2 local status is recorded below; hosted acceptance remains pending.

### Phase 2 local verification and hosted gate — 2026-10-05

Events and weekly class series are implemented locally, with retained archive/restore and the existing Week task strip above a time grid. The sidebar shows courses, recorded availability and the shared quick-task form. Editing a class occurrence edits its entire series. Weekly instances are derived, never stored; optional date bounds are inclusive. Events/classes use floating local dates and minute-precision same-day times. Availability unions recorded overlapping intervals within the adjustable 08:00–22:00 default window; task estimates and unrecorded commitments are separate. The window is not persisted.

Migration order after reconciling the existing Analytics migration is `202610040002_task_due_time.sql` then `202610050001_calendar_events_classes.sql`. **Both are authored/local-tested and NOT applied to hosted.** The latter adds owner-protected `calendar_events` and `recurring_class_patterns`; neither allows hard DELETE. No environment-variable changes are required. Do not run this branch's new writes against an unmigrated hosted schema. Application, API-schema refresh and signed-in dev-account persistence/ownership acceptance require a separately authorized step; do not replay applied migrations.

Local checks passed: lint, typecheck, 112 tests, production build, and `npm run test:classification-ui`, `npm run test:reading-ui`, `npm run test:analytics-ui`. Embedded PostgreSQL exercises the actual migration chain and production adapters with a local SQL transport; browser fixtures are explicitly synthetic and do not establish hosted acceptance. See the dated Phase 2 checkpoint in BUILD_PLAN.md for exact files, evidence and remaining limitations. No commit, push, merge, deployment or hosted operation occurred.
