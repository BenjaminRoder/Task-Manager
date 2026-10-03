-- Independent owned dimensions; archives preserve historical task references.
create table public.courses (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id text not null default gen_random_uuid()::text check (length(id) between 1 and 200),
  name text not null check (length(btrim(name)) between 1 and 60),
  code text check (code is null or length(btrim(code)) between 1 and 20),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create unique index courses_user_name on public.courses(user_id, lower(btrim(name)));

create table public.task_types (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id text not null default gen_random_uuid()::text check (length(id) between 1 and 200),
  name text not null check (length(btrim(name)) between 1 and 60),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create unique index task_types_user_name on public.task_types(user_id, lower(btrim(name)));

alter table public.courses enable row level security;
alter table public.task_types enable row level security;
revoke all on public.courses, public.task_types from anon, authenticated;
grant select, insert, update on public.courses, public.task_types to authenticated;
create policy courses_read on public.courses for select to authenticated using ((select auth.uid()) = user_id);
create policy courses_create on public.courses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy courses_change on public.courses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy task_types_read on public.task_types for select to authenticated using ((select auth.uid()) = user_id);
create policy task_types_create on public.task_types for insert to authenticated with check ((select auth.uid()) = user_id);
create policy task_types_change on public.task_types for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create trigger courses_guard before update on public.courses for each row execute function public.guard_record();
create trigger task_types_guard before update on public.task_types for each row execute function public.guard_record();

-- Existing tasks remain unchanged; all three dimensions can be omitted.
alter table public.tasks alter column category_id drop not null;
alter table public.tasks add column course_id text;
alter table public.tasks add column task_type_id text;
alter table public.tasks add foreign key (user_id, course_id) references public.courses(user_id, id) on delete restrict;
alter table public.tasks add foreign key (user_id, task_type_id) references public.task_types(user_id, id) on delete restrict;
create index tasks_user_course on public.tasks(user_id, course_id) where course_id is not null;
create index tasks_user_task_type on public.tasks(user_id, task_type_id) where task_type_id is not null;

create or replace function public.guard_category_assignment() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.category_id is null then return new; end if;
  if TG_OP = 'UPDATE' then
    if new.category_id is not distinct from old.category_id then return new; end if;
  end if;
  perform 1 from public.categories where user_id = new.user_id and id = new.category_id and archived_at is null for share;
  if not found then raise exception 'Choose an active category, or restore the archived category first'; end if;
  return new;
end;
$$;

create function public.guard_task_classification() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.course_id is not null then
    if TG_OP = 'INSERT' then
      perform 1 from public.courses where user_id = new.user_id and id = new.course_id and archived_at is null for share;
      if not found then raise exception 'Choose an active course, or restore it first'; end if;
    elsif new.course_id is distinct from old.course_id then
      perform 1 from public.courses where user_id = new.user_id and id = new.course_id and archived_at is null for share;
      if not found then raise exception 'Choose an active course, or restore it first'; end if;
    end if;
  end if;
  if new.task_type_id is not null then
    if TG_OP = 'INSERT' then
      perform 1 from public.task_types where user_id = new.user_id and id = new.task_type_id and archived_at is null for share;
      if not found then raise exception 'Choose an active task type, or restore it first'; end if;
    elsif new.task_type_id is distinct from old.task_type_id then
      perform 1 from public.task_types where user_id = new.user_id and id = new.task_type_id and archived_at is null for share;
      if not found then raise exception 'Choose an active task type, or restore it first'; end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger tasks_classification_guard before insert or update of course_id, task_type_id on public.tasks
  for each row execute function public.guard_task_classification();
