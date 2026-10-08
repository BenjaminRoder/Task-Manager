-- Floating browser-local minute precision; legacy dates remain untimed.
alter table public.tasks add column due_time time without time zone;
alter table public.tasks add constraint tasks_due_time_valid check (
  due_time is null or (
    due_date is not null and due_time < time '24:00'
    and extract(second from due_time) = 0
  )
);
comment on column public.tasks.due_time is
  'Optional floating local HH:mm, requires due_date; not a UTC instant.';

-- Clearing an existing date clears its time, including direct partial writes.
create function public.clear_task_due_time() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.due_date is null and old.due_date is not null then new.due_time := null; end if;
  return new;
end;
$$;
create trigger tasks_clear_due_time before update of due_date on public.tasks
  for each row execute function public.clear_task_due_time();

create or replace function public.save_task_with_topics(p_task_id text, p_fields jsonb, p_topic_ids text[], expected_user_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare owner_id uuid := auth.uid(); saved_id text;
begin
  if owner_id is null or owner_id is distinct from expected_user_id then
    raise exception 'Your session changed. Sign in before saving';
  end if;
  if p_topic_ids is null or exists (select 1 from unnest(p_topic_ids) x where x is null or length(btrim(x)) not between 1 and 200) then
    raise exception 'Choose valid topics';
  end if;
  if p_task_id is null then
    insert into public.tasks(title, category_id, course_id, task_type_id, priority, due_date, due_time, scheduled_date, estimated_minutes)
    values(p_fields->>'title', p_fields->>'category_id', p_fields->>'course_id', p_fields->>'task_type_id',
      p_fields->>'priority', (p_fields->>'due_date')::date, (p_fields->>'due_time')::time, (p_fields->>'scheduled_date')::date, (p_fields->>'estimated_minutes')::integer)
    returning id into saved_id;
  else
    saved_id := p_task_id;
    perform 1 from public.tasks where user_id = owner_id and id = saved_id and deleted_at is null for update;
    if not found then raise exception 'This task is no longer available'; end if;
    update public.tasks set title=p_fields->>'title', category_id=p_fields->>'category_id', course_id=p_fields->>'course_id',
      task_type_id=p_fields->>'task_type_id', priority=p_fields->>'priority', due_date=(p_fields->>'due_date')::date,
      due_time=case when p_fields ? 'due_time' then (p_fields->>'due_time')::time else due_time end,
      scheduled_date=(p_fields->>'scheduled_date')::date, estimated_minutes=(p_fields->>'estimated_minutes')::integer
      where user_id=owner_id and id=saved_id;
  end if;
  delete from public.task_topics where user_id=owner_id and task_id=saved_id and not (topic_id = any(p_topic_ids));
  insert into public.task_topics(task_id,topic_id)
    select saved_id, x from (select distinct unnest(p_topic_ids) as x) requested
    where not exists (select 1 from public.task_topics where user_id=owner_id and task_id=saved_id and topic_id=x)
    order by x;
end;
$$;
revoke all on function public.save_task_with_topics(text,jsonb,text[],uuid) from public, anon;
grant execute on function public.save_task_with_topics(text,jsonb,text[],uuid) to authenticated;

create or replace function public.import_local_data(dataset_id text, payload jsonb, expected_user_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare inserted integer;
begin
  if auth.uid() is null or auth.uid() is distinct from expected_user_id then raise exception 'Your session changed. Sign in before importing'; end if;
  if payload->>'version' is distinct from '2'
    or jsonb_typeof(payload->'categories') is distinct from 'array'
    or jsonb_typeof(payload->'tasks') is distinct from 'array' then
    raise exception 'Invalid local dataset';
  end if;
  insert into public.local_imports(dataset_id) values(import_local_data.dataset_id) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return; end if;

  insert into public.categories(id, name, color)
    select x->>'id', x->>'name', x->>'color' from jsonb_array_elements(payload->'categories') x;
  insert into public.tasks(id,title,category_id,priority,due_date,due_time,scheduled_date,estimated_minutes,status,created_at,completed_at,deleted_at)
    select x->>'id',x->>'title',x->>'categoryId',x->>'priority',(x->>'dueDate')::date,(x->>'dueTime')::time,
      (x->>'scheduledDate')::date,(x->>'estimatedMinutes')::integer,x->>'status',
      (x->>'createdAt')::timestamptz,(x->>'completedAt')::timestamptz,(x->>'deletedAt')::timestamptz
    from jsonb_array_elements(payload->'tasks') x;
  update public.categories c set archived_at = (x->>'archivedAt')::timestamptz
    from jsonb_array_elements(payload->'categories') x
    where c.user_id = auth.uid() and c.id = x->>'id';
end;
$$;
revoke all on function public.import_local_data(text,jsonb,uuid) from public, anon;
grant execute on function public.import_local_data(text,jsonb,uuid) to authenticated;
