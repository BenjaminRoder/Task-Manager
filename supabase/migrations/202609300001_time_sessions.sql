-- Each work period is a durable row. Corrections exclude erroneous rows by
-- voiding them, retaining the record for recovery rather than hard-deleting it.
create table public.time_sessions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id uuid not null default gen_random_uuid(),
  task_id text not null,
  started_at timestamptz not null default clock_timestamp(),
  ended_at timestamptz,
  duration_seconds numeric generated always as (extract(epoch from (ended_at - started_at))) stored,
  voided_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, id),
  foreign key (user_id, task_id) references public.tasks(user_id, id) on delete restrict,
  check (ended_at is null or ended_at > started_at),
  check (voided_at is null or ended_at is not null),
  check (isfinite(started_at) and (ended_at is null or isfinite(ended_at)))
);
create unique index time_sessions_one_active on public.time_sessions(user_id) where ended_at is null;
create index time_sessions_task_history on public.time_sessions(user_id, task_id, started_at);
alter table public.time_sessions enable row level security;
revoke all on public.time_sessions from anon, authenticated;
grant select, insert, update on public.time_sessions to authenticated;
create policy sessions_read on public.time_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy sessions_create on public.time_sessions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy sessions_change on public.time_sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.guard_time_session() returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    -- Same task row lock as completion/deletion: a racing start either precedes
    -- completion and is stopped by it, or observes the completed task and fails.
    perform 1 from public.tasks where user_id = new.user_id and id = new.task_id
      and status = 'incomplete' and deleted_at is null for update;
    if not found then raise exception 'Only your available, incomplete tasks can be timed'; end if;
    new.started_at := clock_timestamp();
    new.ended_at := null;
    new.voided_at := null;
    new.created_at := new.started_at;
  else
    if (new.user_id,new.id,new.task_id) is distinct from (old.user_id,old.id,old.task_id) then
      raise exception 'Session identity and task cannot change';
    end if;
    if old.voided_at is not null then raise exception 'Removed sessions cannot be changed'; end if;
    if old.ended_at is not null and new.ended_at is null then raise exception 'Resume by starting a new session'; end if;
    if old.ended_at is null then
      if new.started_at <> old.started_at then raise exception 'Stop the timer before correcting its times'; end if;
      if new.ended_at is not null then
        new.ended_at := greatest(clock_timestamp(), old.started_at + interval '1 microsecond');
      end if;
    else
      if new.started_at > clock_timestamp() or new.ended_at > clock_timestamp() then
        raise exception 'Recorded times cannot be in the future';
      end if;
    end if;
    new.created_at := old.created_at;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create trigger sessions_guard before insert or update on public.time_sessions for each row execute function public.guard_time_session();

-- Trigger runs under the updating caller and RLS. Works for every task update,
-- not just this app's UI. Reopening and ordinary edits never start a session.
create function public.close_task_timer() returns trigger language plpgsql set search_path = '' as $$
declare stopped_at timestamptz;
begin
  if (new.status = 'completed' and old.status <> 'completed') or
     (new.deleted_at is not null and old.deleted_at is null) then
    update public.time_sessions set ended_at = clock_timestamp()
      where user_id = new.user_id and task_id = new.id and ended_at is null
      returning ended_at into stopped_at;
    if new.status = 'completed' and old.status <> 'completed' then
      new.completed_at := coalesce(stopped_at, clock_timestamp());
    end if;
  end if;
  return new;
end;
$$;
create trigger tasks_close_timer before update of status, deleted_at on public.tasks for each row execute function public.close_task_timer();

create function public.start_task_timer(target_task text, request_id uuid, expected_active uuid, expected_user uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare active public.time_sessions; prior public.time_sessions;
begin
  if auth.uid() is null or auth.uid() is distinct from expected_user then raise exception 'Your session changed. Sign in again'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 3));
  -- Request identity makes a retry after a lost response idempotent, even if
  -- that session has subsequently ended. The UI creates a new ID for resume.
  select * into prior from public.time_sessions where user_id=auth.uid() and id=request_id;
  if found then
    if prior.task_id <> target_task then raise exception 'Request belongs to a different task'; end if;
    return prior.id;
  end if;
  perform 1 from public.tasks where user_id=auth.uid() and id=target_task and status='incomplete' and deleted_at is null for update;
  if not found then raise exception 'This task is unavailable or completed. Reload tasks'; end if;
  select * into active from public.time_sessions where user_id=auth.uid() and ended_at is null for update;
  if active.id is not null and active.task_id=target_task and expected_active is null then return active.id; end if;
  if active.id is distinct from expected_active then raise exception 'The active timer changed. Refresh and confirm again'; end if;
  if active.id is not null then
    update public.time_sessions set ended_at=clock_timestamp() where user_id=auth.uid() and id=active.id;
  end if;
  insert into public.time_sessions(id,task_id) values(request_id,target_task);
  return request_id;
end;
$$;

create function public.stop_task_timer(session_id uuid, expected_user uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from expected_user then raise exception 'Your session changed. Sign in again'; end if;
  update public.time_sessions set ended_at=clock_timestamp() where user_id=auth.uid() and id=session_id and ended_at is null;
  -- Already ended is an idempotent no-op; never stops a different/new session.
end;
$$;
create function public.timer_server_time() returns timestamptz language sql security invoker set search_path = '' as $$ select clock_timestamp() $$;
revoke all on function public.start_task_timer(text,uuid,uuid,uuid), public.stop_task_timer(uuid,uuid), public.timer_server_time() from public, anon;
grant execute on function public.start_task_timer(text,uuid,uuid,uuid), public.stop_task_timer(uuid,uuid), public.timer_server_time() to authenticated;
