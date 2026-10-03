-- Existing estimates remain deliberate manual overrides. NULL selects automatic
-- estimation. Keep the existing 1..1440 CHECK, ownership, and timer guards.
alter table public.tasks alter column estimated_minutes drop not null;
comment on column public.tasks.estimated_minutes is
  'Manual estimate in minutes; NULL uses derived historical prediction or default. Predictions are not persisted.';
