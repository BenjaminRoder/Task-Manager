-- Immutable, narrow estimate snapshots; actuals always come from time_sessions.
-- Existing completions are deliberately NOT backfilled with today's predictions.
create table public.completion_estimates (
  user_id uuid not null references auth.users(id) on delete restrict,
  id uuid not null default gen_random_uuid(),
  task_id text not null,
  completed_at timestamptz not null check(isfinite(completed_at)),
  manual_minutes integer check(manual_minutes between 1 and 1440),
  predicted_minutes numeric check(predicted_minutes > 0),
  effective_minutes numeric not null check(effective_minutes > 0),
  effective_source text not null check(effective_source in ('manual','prediction','default')),
  prediction_source text not null check(prediction_source in ('course_task_type','course','category_task_type','task_type','category','global','fallback')),
  sample_size integer not null check(sample_size between 0 and 20),
  created_at timestamptz not null default clock_timestamp(),
  primary key(user_id,id),
  unique(user_id,task_id,completed_at),
  foreign key(user_id,task_id) references public.tasks(user_id,id) on delete restrict,
  check(effective_minutes=coalesce(manual_minutes,predicted_minutes,25)),
  check(effective_source=case when manual_minutes is not null then 'manual' when predicted_minutes is not null then 'prediction' else 'default' end),
  check((predicted_minutes is null)=(prediction_source='fallback'))
);
create index completion_estimates_period on public.completion_estimates(user_id,completed_at);
alter table public.completion_estimates enable row level security;
revoke all on public.completion_estimates from public,anon,authenticated;
grant select on public.completion_estimates to authenticated;
create policy completion_estimates_read on public.completion_estimates for select to authenticated using((select auth.uid())=user_id);

-- Definer is needed solely to write the read-only snapshot table. Every history
-- query is explicitly owner scoped; no application RPC or arbitrary write grant.
create function public.capture_completion_estimate() returns trigger
language plpgsql security definer set search_path='' as $$
declare prediction numeric; source text; samples integer;
begin
  if new.status<>'completed' then return new; end if;
  if TG_OP='UPDATE' then
    if old.status='completed' then return new; end if;
  else
    -- Imported already-completed tasks have no trustworthy completion-time estimate.
    return new;
  end if;
  if auth.uid() is distinct from new.user_id then raise exception 'Completion owner does not match session'; end if;
  with observations as (
    select t.id,t.category_id,t.course_id,t.task_type_id,t.completed_at,
      sum(s.duration_seconds)/60 as minutes
    from public.tasks t join public.time_sessions s on s.user_id=t.user_id and s.task_id=t.id
    where t.user_id=new.user_id and t.id<>new.id and t.status='completed'
      and isfinite(t.completed_at) and s.ended_at is not null and s.voided_at is null and s.duration_seconds>0
      and not exists(select 1 from public.time_sessions a where a.user_id=t.user_id and a.task_id=t.id and a.ended_at is null and a.voided_at is null)
    group by t.user_id,t.id
  ), matches as (
    select o.*,l.level from observations o cross join generate_series(1,6) l(level)
    where case l.level
      when 1 then new.course_id is not null and new.task_type_id is not null and o.course_id=new.course_id and o.task_type_id=new.task_type_id
      when 2 then new.course_id is not null and o.course_id=new.course_id
      when 3 then new.category_id is not null and new.task_type_id is not null and o.category_id=new.category_id and o.task_type_id=new.task_type_id
      when 4 then new.task_type_id is not null and o.task_type_id=new.task_type_id
      when 5 then new.category_id is not null and o.category_id=new.category_id
      else true end
  ), chosen as (
    select coalesce(min(level),6) as level from (select level from matches group by level having count(*)>=3) sufficient
  ), ranked as (
    select m.*,row_number() over(order by completed_at desc,id collate "C") as rank
    from matches m join chosen c using(level)
  ), recent as (select * from ranked where rank<=20), weighted as (
    select *,count(*) over() as n from recent
  )
  select case when count(*)>=3 then greatest(5,round(sum(minutes*(n-rank+1))/sum(n-rank+1)/5)*5) end,
    case when count(*)<3 then 'fallback' else (array['course_task_type','course','category_task_type','task_type','category','global'])[min(level)] end,
    count(*)::integer into prediction,source,samples from weighted;
  insert into public.completion_estimates(user_id,task_id,completed_at,manual_minutes,predicted_minutes,effective_minutes,effective_source,prediction_source,sample_size)
    values(new.user_id,new.id,new.completed_at,new.estimated_minutes,prediction,coalesce(new.estimated_minutes,prediction,25),
      case when new.estimated_minutes is not null then 'manual' when prediction is not null then 'prediction' else 'default' end,source,samples);
  return new;
end; $$;
revoke all on function public.capture_completion_estimate() from public,anon,authenticated;
-- AFTER sees the timestamp assigned by M3's timer-closing BEFORE trigger.
create trigger tasks_capture_completion after update of status on public.tasks for each row execute function public.capture_completion_estimate();

-- Ordinary edits cannot detach a completed task from its frozen estimate.
create function public.preserve_completion_timestamp() returns trigger language plpgsql set search_path='' as $$
begin
  if old.status='completed' and new.status='completed' then new.completed_at:=old.completed_at; end if;
  return new;
end; $$;
revoke all on function public.preserve_completion_timestamp() from public,anon,authenticated;
create trigger tasks_preserve_completion_timestamp before update on public.tasks for each row execute function public.preserve_completion_timestamp();
