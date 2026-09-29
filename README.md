# Personal Task Manager

A focused personal productivity app for school, everyday tasks, and eventually reading and time tracking. See [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) for the product vision, [BUILD_PLAN.md](BUILD_PLAN.md) for verified progress, and [AGENTS.md](AGENTS.md) for engineering instructions.

## Milestones 1 and 1.5

The frontend foundation is functional: Today and Tasks support creation, editing, completion/reopening, confirmed deletion, duration estimates, editable categories, priorities, planned dates, and optional due dates. Sort by Momentum (shortest first), Priority, or Deadline. Analytics, Reading, and History are explicitly future milestones; there is no seeded or fake data.

Milestone 1.5 adds user-created color categories and a Week view. Use **Manage categories** in Today, Tasks, or Week to create a category, rename it, choose a preset/custom color, archive it, or restore it. Select categories by name in the task form. Names and colors update everywhere because tasks reference stable category IDs. Archived categories remain on existing tasks but cannot be assigned to other tasks until restored; no categories are hard-deleted.

**Week** shows Monday–Sunday by task **due date**, with previous/current/next-week controls. Each day displays its incomplete task count and estimated workload; a relative workload bar helps compare days. Completed tasks stay visible with a label and strikethrough, but do not count toward remaining workload. Click a task to open the same form used in Today and Tasks, with completion/reopening and deletion controls. Undated tasks remain in Tasks. Desktop uses seven columns, intermediate widths scroll within the calendar, and mobile stacks readable day sections. This is not hourly time-blocking.

## Run locally

Use Node.js 22.18 or newer (verified with Node 24.13.1) and npm. Run these commands from the actual repository root, which is the **inner** `Task-Manager` directory containing `package.json`:

```powershell
# From the outer workspace folder, enter the existing repository once:
cd Task-Manager
npm ci
npm run dev
```

Open <http://localhost:3000>. The root route redirects to `/today`. No environment variables or backend services are needed for this milestone; `.env.example` documents that intentionally empty configuration.

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

Run `npm start` after a successful build, with the dev server stopped if both use port 3000. Dependencies are locked in `package-lock.json`.

## Architecture

- `app/`: Next.js App Router pages, shared layout, loading/error states, and Tailwind-backed styles.
- `components/navigation/`: responsive navigation including Week.
- `components/tasks/`: task board, reusable form/rows, and Week board/calendar.
- `components/categories/`: lightweight category manager and shared color badge.
- `types/task.ts`: typed task fields and sort modes.
- `lib/tasks/task-rules.ts`: validation, local dates, Today selection, sorting, and workload calculations.
- `types/category.ts`: stable category identity, name, color, and archive timestamp.
- `lib/tasks/week-rules.ts`: calendar-date arithmetic, week grouping, and daily totals.
- `lib/tasks/task-repository.ts` and `lib/categories/category-repository.ts`: asynchronous repository contracts and local adapters.
- `lib/storage/local-store.ts`: shared versioned storage, validation, and legacy-data migration.
- `lib/tasks/use-tasks.ts`: loads tasks/categories together and coordinates repository mutations and refreshes.
- `tests/`: task/category repository, migration, sorting, workload, and calendar tests using Node's built-in test runner.

The data flow is **components → task/category repository interfaces → shared local store**. A future Supabase adapter can replace the local implementation. Category IDs are ready for database foreign keys; authentication, ownership policies, database migrations, local-data import, and server validation remain Milestone 2 work. No new runtime dependency or global state library was added.

## Persistence and daily behavior

Tasks and categories are saved together under `personal-task-manager.data.v2`. A single storage write keeps category records and task references consistent. Categories have `{ id, name, color, archivedAt }`; tasks store `categoryId`. Components never access local storage directly. Saves complete before the UI reports success. Invalid or inaccessible saved data is not silently reset; the app shows an actionable error. Completed records retain their completion timestamp. Task deletion requires confirmation and sets `deletedAt`, hiding the record without destroying it; a task-restore screen is not part of this milestone.

On first load, Milestone 1 data under `personal-task-manager.tasks.v1` is validated and migrated automatically. Names are trimmed and matched case-insensitively so repeated names share one category; the first spelling is retained. Initial category colors come from a small palette and can be changed immediately. Task IDs, dates, estimates, priorities, completion/deletion timestamps, and all task records are preserved. The entire migrated document is validated before it is saved. The original v1 document is left untouched as a recovery copy, and later loads use v2 without repeating migration. If migration fails, no partial v2 document is written. A fresh installation gets one editable Personal category.

Use the updated app in all tabs after upgrading. Older Milestone 1 builds still write v1, and those later edits are not automatically merged into v2. The retained v1 document is a recovery snapshot, not a synchronized backup.

Today includes incomplete tasks planned for today or earlier, plus tasks due today or overdue, and tasks completed on the current local calendar day. Tasks shows all non-deleted records, including future tasks and older completions. Planned dates default to today. Due dates are calendar dates, not deadlines with times. The day's remaining workload sums the displayed incomplete estimates. Momentum sorting does not change priority. Deadline sorting places undated tasks last.

Data belongs to the current **browser profile and origin**. `localhost` and `127.0.0.1`, different ports, and different browsers have separate stores. Refreshes preserve data; clearing site data removes it. There is no cloud backup, synchronization across devices, authentication, or offline application installation. Other tabs refresh after storage changes, but truly simultaneous edits are last-write-wins. Avoid editing the same task in multiple tabs at once.

## Tooling note

ESLint is pinned to 9.39.5 because ESLint 10.11.0 crashes the React plugin included in `eslint-config-next` 16.3.6 (`contextOrFilename.getFilename is not a function`). npm emits an upstream deprecation warning for ESLint 9. All lint rules remain enabled and pass; the dependency audit reported zero vulnerabilities. Revisit the pin when the upstream plugin supports ESLint 10.

`next.config.ts` scopes Turbopack to this repository and disables automatic generated agent instructions, preserving the project's own `AGENTS.md`. No permanent Git ownership/global-ignore configuration changes were made for the sandbox.

## Next milestone

Add Supabase persistence, migrations, authentication, and ownership policies, including a deliberate migration/import path for local tasks. Do not add timers, prediction, analytics, or reading features until that foundation is verified and the next scope is authorized.
