-- Retained owned records; generated class occurrences are never stored.
create function public.valid_calendar_weekdays(days integer[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(array_ndims(days)=1 and array_lower(days,1)=1
    and cardinality(days) between 1 and 7
    and cardinality(days)=(select count(distinct day) from unnest(days) day)
    and days <@ array[0,1,2,3,4,5,6], false);
$$;

create table public.calendar_events (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id text not null default gen_random_uuid()::text check(length(id) between 1 and 200),
  title text not null check(length(btrim(title)) between 1 and 160),
  event_date date not null check(isfinite(event_date)),
  start_time time without time zone not null,
  end_time time without time zone not null,
  task_id text, course_id text,
  archived_at timestamptz check(archived_at is null or isfinite(archived_at)),
  created_at timestamptz not null default now() check(isfinite(created_at)),
  updated_at timestamptz not null default now() check(isfinite(updated_at)),
  primary key(user_id,id),
  foreign key(user_id,task_id) references public.tasks(user_id,id) on delete restrict,
  foreign key(user_id,course_id) references public.courses(user_id,id) on delete restrict,
  check(end_time>start_time and end_time<time '24:00' and extract(second from start_time)=0 and extract(second from end_time)=0)
);
create table public.recurring_class_patterns (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id text not null default gen_random_uuid()::text check(length(id) between 1 and 200),
  title text not null check(length(btrim(title)) between 1 and 160),
  course_id text,
  weekdays integer[] not null check(public.valid_calendar_weekdays(weekdays)),
  start_time time without time zone not null,
  end_time time without time zone not null,
  start_date date check(start_date is null or isfinite(start_date)),
  end_date date check(end_date is null or isfinite(end_date)),
  archived_at timestamptz check(archived_at is null or isfinite(archived_at)),
  created_at timestamptz not null default now() check(isfinite(created_at)),
  updated_at timestamptz not null default now() check(isfinite(updated_at)),
  primary key(user_id,id),
  foreign key(user_id,course_id) references public.courses(user_id,id) on delete restrict,
  check(start_date is null or end_date is null or start_date<=end_date),
  check(end_time>start_time and end_time<time '24:00' and extract(second from start_time)=0 and extract(second from end_time)=0)
);
create index calendar_events_user_date on public.calendar_events(user_id,event_date);
create index calendar_events_user_task on public.calendar_events(user_id,task_id) where task_id is not null;
create index calendar_events_user_course on public.calendar_events(user_id,course_id) where course_id is not null;
create index recurring_classes_user_course on public.recurring_class_patterns(user_id,course_id) where course_id is not null;

create trigger calendar_events_guard before update on public.calendar_events for each row execute function public.guard_record();
create trigger recurring_classes_guard before update on public.recurring_class_patterns for each row execute function public.guard_record();

-- Unchanged links remain readable/editable after linked records are archived.
-- Share locks serialize new assignments against archive/removal updates.
create function public.guard_calendar_course() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.course_id is null then return new; end if;
  if TG_OP='UPDATE' then
    if new.course_id is not distinct from old.course_id then return new; end if;
  end if;
  perform 1 from public.courses where user_id=new.user_id and id=new.course_id and archived_at is null for share;
  if not found then raise exception 'Choose an active course, or restore it first'; end if;
  return new;
end; $$;
create function public.guard_calendar_task() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.task_id is null then return new; end if;
  if TG_OP='UPDATE' then
    if new.task_id is not distinct from old.task_id then return new; end if;
  end if;
  perform 1 from public.tasks where user_id=new.user_id and id=new.task_id and deleted_at is null for share;
  if not found then raise exception 'Choose an available task, or clear the task link'; end if;
  return new;
end; $$;
create trigger calendar_events_course before insert or update of course_id on public.calendar_events for each row execute function public.guard_calendar_course();
create trigger calendar_events_task before insert or update of task_id on public.calendar_events for each row execute function public.guard_calendar_task();
create trigger recurring_classes_course before insert or update of course_id on public.recurring_class_patterns for each row execute function public.guard_calendar_course();

alter table public.calendar_events enable row level security;
alter table public.recurring_class_patterns enable row level security;
revoke all on public.calendar_events,public.recurring_class_patterns from public,anon,authenticated;
grant select,insert,update on public.calendar_events,public.recurring_class_patterns to authenticated;
create policy calendar_events_read on public.calendar_events for select to authenticated using((select auth.uid())=user_id);
create policy calendar_events_create on public.calendar_events for insert to authenticated with check((select auth.uid())=user_id);
create policy calendar_events_change on public.calendar_events for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy recurring_classes_read on public.recurring_class_patterns for select to authenticated using((select auth.uid())=user_id);
create policy recurring_classes_create on public.recurring_class_patterns for insert to authenticated with check((select auth.uid())=user_id);
create policy recurring_classes_change on public.recurring_class_patterns for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
