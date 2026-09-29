# Personal Task Manager

Private task management with Today, Tasks, Week, custom color categories, and Supabase-backed accounts. Momentum, Priority, and Deadline sorting remain independent of manual task priority. Completed tasks and soft-deleted records are retained. Timers, prediction, analytics, reading, and calendar integration are not implemented.

See [BUILD_PLAN.md](BUILD_PLAN.md), [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md), and [AGENTS.md](AGENTS.md).

## Set up Supabase (one time)

1. Create a project at https://supabase.com/dashboard. Keep its database password private.
2. Open the project's **SQL Editor**, create a query, paste the entire contents of `supabase/migrations/202609290001_milestone2.sql`, and run it **once**. This creates all tables, constraints, indexes, triggers, RLS policies, and the transactional import function. Do not create tables manually. Use a fresh project/schema; subsequent schema changes should be new migrations.
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

**Requires live Supabase verification:** apply the migration on a hosted project; sign in/out and refresh; verify session expiry and cross-tab account changes; exercise task/category CRUD across Today/Tasks/Week; import a recovery copy and retry; test offline/save failures; use two real accounts to verify direct REST requests cannot read/write each other's data. No hosted connection was tested because credentials were unavailable. Complete those checks before treating Milestone 2 as operationally accepted.

ESLint remains pinned to 9.39.5 for compatibility with the current Next.js React plugin. No timers, analytics, prediction, reading, or calendar features were added. Recommended next milestone: after live acceptance, persistent task timer sessions with refresh recovery, subject to a new scope authorization.
