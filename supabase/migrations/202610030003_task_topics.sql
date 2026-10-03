-- Specific subject matter, independent of category/course/type and estimation.
create table public.topics (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id text not null default gen_random_uuid()::text check (length(id) between 1 and 200),
  name text not null check (length(btrim(name)) between 1 and 60),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create unique index topics_user_name on public.topics(user_id, lower(btrim(name)));
create trigger topics_guard before update on public.topics for each row execute function public.guard_record();

create table public.task_topics (
  user_id uuid not null default auth.uid(),
  task_id text not null,
  topic_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, task_id, topic_id),
  foreign key (user_id, task_id) references public.tasks(user_id, id) on delete restrict,
  foreign key (user_id, topic_id) references public.topics(user_id, id) on delete restrict
);
create index task_topics_user_topic on public.task_topics(user_id, topic_id);
alter table public.topics enable row level security;
alter table public.task_topics enable row level security;
revoke all on public.topics, public.task_topics from anon, authenticated;
grant select, insert, update on public.topics to authenticated;
-- Associations can be removed intentionally; topic/task records are retained.
grant select, insert, delete on public.task_topics to authenticated;
create policy topics_read on public.topics for select to authenticated using ((select auth.uid()) = user_id);
create policy topics_create on public.topics for insert to authenticated with check ((select auth.uid()) = user_id);
create policy topics_change on public.topics for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy task_topics_read on public.task_topics for select to authenticated using ((select auth.uid()) = user_id);
create policy task_topics_create on public.task_topics for insert to authenticated with check ((select auth.uid()) = user_id);
create policy task_topics_remove on public.task_topics for delete to authenticated using ((select auth.uid()) = user_id);

create function public.guard_topic_assignment() returns trigger language plpgsql set search_path = '' as $$
begin
  -- Lock in the same order as save_task_with_topics; concurrent task edits serialize.
  perform 1 from public.tasks where user_id = new.user_id and id = new.task_id and deleted_at is null for update;
  if not found then raise exception 'This task is no longer available'; end if;
  perform 1 from public.topics where user_id = new.user_id and id = new.topic_id and archived_at is null for share;
  if not found then raise exception 'Choose an active topic, or restore it first'; end if;
  return new;
end;
$$;
create trigger task_topics_assignment_guard before insert on public.task_topics for each row execute function public.guard_topic_assignment();

-- One transaction for task fields and the complete selection. Unchanged archived
-- associations are retained, never deleted/reinserted. No caller-supplied owner.
create function public.save_task_with_topics(p_task_id text, p_fields jsonb, p_topic_ids text[], expected_user_id uuid)
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
    insert into public.tasks(title, category_id, course_id, task_type_id, priority, due_date, scheduled_date, estimated_minutes)
    values(p_fields->>'title', p_fields->>'category_id', p_fields->>'course_id', p_fields->>'task_type_id',
      p_fields->>'priority', (p_fields->>'due_date')::date, (p_fields->>'scheduled_date')::date, (p_fields->>'estimated_minutes')::integer)
    returning id into saved_id;
  else
    saved_id := p_task_id;
    perform 1 from public.tasks where user_id = owner_id and id = saved_id and deleted_at is null for update;
    if not found then raise exception 'This task is no longer available'; end if;
    update public.tasks set title=p_fields->>'title', category_id=p_fields->>'category_id', course_id=p_fields->>'course_id',
      task_type_id=p_fields->>'task_type_id', priority=p_fields->>'priority', due_date=(p_fields->>'due_date')::date,
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
