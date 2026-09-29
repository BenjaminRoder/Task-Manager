# Personal Task Manager

A focused personal productivity app for school, everyday tasks, and eventually reading and time tracking. See [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) for the product vision, [BUILD_PLAN.md](BUILD_PLAN.md) for verified progress, and [AGENTS.md](AGENTS.md) for engineering instructions.

## Milestone 1

The frontend foundation is functional: Today and Tasks support creation, editing, completion/reopening, confirmed deletion, duration estimates, editable categories, priorities, planned dates, and optional due dates. Sort by Momentum (shortest first), Priority, or Deadline. Analytics, Reading, and History are explicitly future milestones; there is no seeded or fake data.

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
- `components/navigation/`: responsive navigation for the five planned sections.
- `components/tasks/`: task board, reusable form, and task rows.
- `types/task.ts`: typed task fields and sort modes.
- `lib/tasks/task-rules.ts`: validation, local dates, Today selection, sorting, and workload calculations.
- `lib/tasks/task-repository.ts`: asynchronous repository contract and browser-storage adapter.
- `lib/tasks/use-tasks.ts`: loading, saving, refresh, and error state between components and the repository.
- `tests/tasks.test.ts`: business-rule and repository tests using Node's built-in test runner.

The data flow is **components → repository interface → local storage**. A future Supabase adapter can replace the local implementation. Authentication, ownership, category records, migration of local data, and server validation remain future work.

## Persistence and daily behavior

Tasks are saved under `personal-task-manager.tasks.v1` as a versioned JSON document. Components never access local storage directly. Saves complete before the UI reports success. Invalid or inaccessible saved data is not silently reset; the app shows an actionable error. Completed records retain their completion timestamp. Deletion requires confirmation and sets `deletedAt`, hiding the record without destroying it; a restore screen is not part of this milestone.

Today includes incomplete tasks planned for today or earlier, plus tasks due today or overdue, and tasks completed on the current local calendar day. Tasks shows all non-deleted records, including future tasks and older completions. Planned dates default to today. Due dates are calendar dates, not deadlines with times. The day's remaining workload sums the displayed incomplete estimates. Momentum sorting does not change priority. Deadline sorting places undated tasks last.

Data belongs to the current **browser profile and origin**. `localhost` and `127.0.0.1`, different ports, and different browsers have separate stores. Refreshes preserve data; clearing site data removes it. There is no cloud backup, synchronization across devices, authentication, or offline application installation. Other tabs refresh after storage changes, but truly simultaneous edits are last-write-wins. Avoid editing the same task in multiple tabs at once.

## Tooling note

ESLint is pinned to 9.39.5 because ESLint 10.11.0 crashes the React plugin included in `eslint-config-next` 16.3.6 (`contextOrFilename.getFilename is not a function`). npm emits an upstream deprecation warning for ESLint 9. All lint rules remain enabled and pass; the dependency audit reported zero vulnerabilities. Revisit the pin when the upstream plugin supports ESLint 10.

`next.config.ts` scopes Turbopack to this repository and disables automatic generated agent instructions, preserving the project's own `AGENTS.md`. No permanent Git ownership/global-ignore configuration changes were made for the sandbox.

## Next milestone

Add Supabase persistence, migrations, authentication, and ownership policies, including a deliberate migration/import path for local tasks. Do not add timers, prediction, analytics, or reading features until that foundation is verified and the next scope is authorized.
