# Agent Instructions

## Read First

Before architectural or feature-level work, read `PROJECT_OVERVIEW.md`, the relevant task in `BUILD_PLAN.md`, and the existing implementation. The repository and `BUILD_PLAN.md` are the source of truth for implementation status; when chat history conflicts with verified code, inspect the repository and update the plan.

Use Codex skills only when they fit the active milestone. Prefer Next.js guidance for App Router work, React guidance for component performance, Supabase/Postgres guidance for schema and RLS, and browser verification for user-facing flows. Request a focused security review at the security milestone. Skills supplement these repository rules and do not change product scope or replace acceptance tests. Use available skills that fit the work; installing skills is optional.

## Product Priorities

- Keep daily task capture and completion fast.
- Keep manual priority distinct from automatic sorting.
- Momentum sorting uses the best available duration estimate and orders shortest first.
- Persist timer timestamps so active timers survive refresh; the browser counter is display-only.
- Preserve historical task/session data for analytics and future estimates.
- Treat Reading as a first-class workflow with page progress and weekly quotas.
- Keep V1 focused on Today, Tasks, Week, Analytics, Reading, and History. Week retains its due-date workload behavior and has an authorized calendar experiment described in `PROJECT_OVERVIEW.md` and `BUILD_PLAN.md`.
- Do not add speculative features unless `BUILD_PLAN.md` is explicitly updated.

## Engineering Rules

- Use TypeScript and explicit types for business-domain objects.
- Follow existing repository conventions before adding patterns, hooks, services, utilities, routes, or abstractions.
- Keep business logic out of presentation components.
- Keep duration-estimation logic in a dedicated estimation module.
- Keep analytics calculations in a dedicated analytics module.
- Prefer small composable functions/components, stable dependencies, and the platform's existing capabilities.
- Add abstractions only when they reduce real duplication or complexity.

## Database and Security

- Use Supabase migrations for schema changes, with foreign keys, consistent timestamps, and appropriate indexes.
- Enable Row Level Security on user-owned tables and test ownership behavior.
- Derive ownership from the authenticated user; never trust client-provided `user_id` values.
- Preserve records needed for history, analytics, and estimation unless a documented requirement says otherwise.
- Never commit secrets, bypass RLS, or replace real database behavior with mocks outside explicit test fixtures.

## UI and Reliability

- Build responsive, accessible core flows from the start, especially Today.
- Provide loading, empty, success, validation, and actionable error states.
- Prevent unsafe duplicate submissions and handle timer edge cases explicitly.
- Do not hide failures by disabling lint rules, deleting failing tests, swallowing errors, or using unjustified broad `any` types.

## Work Cycle

For each milestone:

1. Inspect the implementation and relevant plan task.
2. Implement the smallest coherent change without unrelated refactors.
3. Run relevant repository checks and manual verification.
4. Verify acceptance criteria.
5. Update status, acceptance evidence, and remaining work in `BUILD_PLAN.md`; check items only after verification.
6. Record unresolved issues or plan changes, and commit the verified milestone when the Git workflow permits.

Use the repository's actual scripts. Typical checks are `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Do not report a requirement complete while a relevant check or acceptance criterion fails.

## Context Maintenance

Each document has one owner: this file for durable agent rules, `PROJECT_OVERVIEW.md` for product scope, `BUILD_PLAN.md` for implementation state and pending requirements, and `README.md` for operations. Read the relevant sections rather than loading every document for each small task. After acceptance, consolidate milestone notes into outcomes, decisions, verification, and limitations. Do not prepend recovery journals, duplicate rules, or leave superseded checklists appearing active. Preserve unfinished requirements explicitly.


## Week calendar experiment

Read the active Week calendar checkpoint in `BUILD_PLAN.md` and `WEEK_CALENDAR_PROMPTS.md` before this work. The latter contains staged execution prompts, not permission to execute every phase at once. Work only on `experiment/week-calendar`; never merge to main, push, deploy, or apply hosted migrations without explicit authorization. Setup alone permits a scoped local commit; Phase 1 and Phase 2 explicitly do not permit commits. Preserve existing staged/unstaged user work and inspect branch state before mutations. Reuse an existing experiment branch after verifying its provenance; do not reset or recreate it destructively.

Restructure the existing Week view, with no second week-like destination. Recurrence is weekly weekdays only. Preserve task/timer/reading history and existing QA cleanup semantics. Events and class patterns use retained removal/archive with restore, not hard deletes. New owned relationships must enforce ownership in the database as well as repositories. Pure date/sorting/recurrence/availability logic belongs outside components. Follow actual repository layout and existing kebab-case naming; do not invent parallel architecture from planning examples.

Update schema/domain validation, repository mappings, local recovery compatibility, and every task-save path together when adding a task field, including `save_task_with_topics` if the actual implementation uses it. Distinguish migrations authored, locally tested, and applied to hosted. Never label scaffold or planned work implemented. Record baseline failures honestly and do not weaken checks to pass.
