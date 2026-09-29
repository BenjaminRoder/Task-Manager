# Agent Instructions

## Read First

Before architectural or feature-level work, read `PROJECT_OVERVIEW.md`, the relevant task in `BUILD_PLAN.md`, and the existing implementation. The repository and `BUILD_PLAN.md` are the source of truth for implementation status; when chat history conflicts with verified code, inspect the repository and update the plan.

Use Codex skills only when they fit the active milestone. Prefer Next.js guidance for App Router work, React guidance for component performance, Supabase/Postgres guidance for schema and RLS, and browser verification for user-facing flows. Request a focused security review at the security milestone. Skills supplement these repository rules and do not change product scope or replace acceptance tests. `BUILD_PLAN.md` lists the recommended skills and their sources.

## Product Priorities

- Keep daily task capture and completion fast.
- Keep manual priority distinct from automatic sorting.
- Momentum sorting uses the best available duration estimate and orders shortest first.
- Persist timer timestamps so active timers survive refresh; the browser counter is display-only.
- Preserve historical task/session data for analytics and future estimates.
- Treat Reading as a first-class workflow with page progress and weekly quotas.
- Keep V1 focused on Today, Tasks, Week, Analytics, Reading, and History. Week is the due-date workload view authorized in Milestone 1.5.
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
5. Update completed checklist items and implementation notes in `BUILD_PLAN.md`.
6. Record unresolved issues or plan changes, and commit the verified milestone when the Git workflow permits.

Use the repository's actual scripts. Typical checks are `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Do not report a requirement complete while a relevant check or acceptance criterion fails.
