-- Optional hosted SQL acceptance test. Requires an existing Auth user.
-- Run as postgres in SQL Editor. All test records are rolled back, and all
-- application operations below run as authenticated with actual RLS enabled.
begin;
select set_config('request.jwt.claim.sub', (select id::text from auth.users order by created_at limit 1), true);
set local role authenticated;
do $$
declare
  owner uuid := auth.uid(); category_key text := gen_random_uuid()::text;
  task_a text := gen_random_uuid()::text; task_b text := gen_random_uuid()::text;
  first_session uuid := gen_random_uuid(); second_session uuid := gen_random_uuid();
  third_session uuid := gen_random_uuid(); total numeric;
begin
  if owner is null then raise exception 'Create an Auth user before running this test'; end if;
  -- Do not interrupt a user's real active timer.
  if exists(select 1 from public.time_sessions where ended_at is null) then
    raise exception 'Stop your active timer before this isolated test';
  end if;
  insert into public.categories(id,name,color) values(category_key,'Timer SQL QA '||left(category_key,8),'#123456');
  insert into public.tasks(id,title,category_id,priority,scheduled_date,estimated_minutes)
    values(task_a,'Timer SQL QA A',category_key,'low',current_date,10),(task_b,'Timer SQL QA B',category_key,'low',current_date,10);
  perform public.start_task_timer(task_a,first_session,null,owner);
  perform public.start_task_timer(task_a,first_session,null,owner);
  if (select count(*) from public.time_sessions where id=first_session) <> 1 then raise exception 'Start retry duplicated a session'; end if;
  begin
    perform public.start_task_timer(task_b,second_session,null,owner);
    raise exception 'Missing active-session protection' using errcode='check_violation';
  exception when raise_exception then
    if sqlerrm not like '%active timer changed%' then raise; end if;
  end;
  perform public.start_task_timer(task_b,second_session,first_session,owner);
  if exists(select 1 from public.time_sessions where id=first_session and ended_at is null) then raise exception 'Switch did not stop previous session'; end if;
  perform public.stop_task_timer(second_session,owner);
  perform public.stop_task_timer(second_session,owner);
  update public.time_sessions set started_at=clock_timestamp()-interval '20 minutes',ended_at=clock_timestamp()-interval '10 minutes' where id=first_session;
  select duration_seconds into total from public.time_sessions where id=first_session;
  if total < 600 or total > 601 then raise exception 'Correction duration incorrect'; end if;
  perform public.start_task_timer(task_a,third_session,null,owner);
  update public.tasks set status='completed',completed_at=now() where id=task_a;
  if exists(select 1 from public.time_sessions where id=third_session and ended_at is null) then raise exception 'Completion left running timer'; end if;
  if not exists(select 1 from public.tasks t join public.time_sessions s on s.user_id=t.user_id and s.task_id=t.id where s.id=third_session and s.ended_at=t.completed_at) then raise exception 'Completion timestamp mismatch'; end if;
  update public.tasks set status='incomplete',completed_at=null where id=task_a;
  if exists(select 1 from public.time_sessions where ended_at is null) then raise exception 'Reopen started a timer'; end if;
  update public.time_sessions set voided_at=now() where id=first_session;
  if not exists(select 1 from public.time_sessions where id=first_session and voided_at is not null) then raise exception 'Session removal lost history'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  if exists(select 1 from public.time_sessions where id in(first_session,second_session,third_session)) then raise exception 'Cross-owner read leaked'; end if;
  begin
    perform public.start_task_timer(task_a,gen_random_uuid(),null,auth.uid());
    raise exception 'Cross-owner start allowed' using errcode='check_violation';
  exception when raise_exception then
    if sqlerrm not like '%unavailable or completed%' then raise; end if;
  end;
end;
$$;
rollback;
select 'PASS: live SQL lifecycle, retry, switching, corrections, completion, history, and simulated cross-owner RLS; all test data rolled back' as result;
