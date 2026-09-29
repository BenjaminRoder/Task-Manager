-- IDs are text to preserve the existing local model, including older non-UUID IDs.
-- Composite keys allow identical local IDs in different accounts without collisions.
create table public.categories (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id text not null default gen_random_uuid()::text check (length(id) between 1 and 200),
  name text not null check (length(btrim(name)) between 1 and 60),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create unique index categories_user_name on public.categories (user_id, lower(btrim(name)));

create table public.tasks (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id text not null default gen_random_uuid()::text check (length(id) between 1 and 200),
  title text not null check (length(btrim(title)) between 1 and 160),
  category_id text not null,
  priority text not null check (priority in ('low','medium','high','critical')),
  due_date date,
  scheduled_date date not null,
  estimated_minutes integer not null check (estimated_minutes between 1 and 1440),
  status text not null default 'incomplete' check (status in ('incomplete','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz,
  primary key (user_id, id),
  foreign key (user_id, category_id) references public.categories(user_id, id) on delete restrict,
  check ((status = 'completed') = (completed_at is not null))
);
create index tasks_user_category on public.tasks(user_id, category_id);
create index tasks_user_due on public.tasks(user_id, due_date) where deleted_at is null;
create index tasks_user_scheduled on public.tasks(user_id, scheduled_date) where deleted_at is null;

create table public.local_imports (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  dataset_id text not null check (dataset_id ~ '^[0-9a-f]{64}$'),
  imported_at timestamptz not null default now(),
  primary key(user_id, dataset_id)
);

alter table public.tasks enable row level security;
alter table public.categories enable row level security;
alter table public.local_imports enable row level security;

-- No DELETE grants/policies: task removal and category archival preserve history.
revoke all on public.tasks, public.categories, public.local_imports from anon, authenticated;
grant select, insert, update on public.tasks, public.categories to authenticated;
grant select, insert on public.local_imports to authenticated;
create policy tasks_read on public.tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy tasks_create on public.tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy tasks_change on public.tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy categories_read on public.categories for select to authenticated using ((select auth.uid()) = user_id);
create policy categories_create on public.categories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy categories_change on public.categories for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy imports_read on public.local_imports for select to authenticated using ((select auth.uid()) = user_id);
create policy imports_create on public.local_imports for insert to authenticated with check ((select auth.uid()) = user_id);

create function public.guard_record() returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    if new.user_id <> old.user_id or new.id <> old.id then
      raise exception 'Record identity cannot change';
    end if;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger categories_guard before update on public.categories for each row execute function public.guard_record();
create trigger tasks_guard before update on public.tasks for each row execute function public.guard_record();

create function public.guard_category_assignment() returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    if new.category_id = old.category_id then return new; end if;
  end if;
  perform 1 from public.categories where user_id = new.user_id and id = new.category_id and archived_at is null for share;
  if not found then raise exception 'Choose an active category, or restore the archived category first'; end if;
  return new;
end;
$$;
create trigger tasks_category_guard before insert or update of category_id on public.tasks for each row execute function public.guard_category_assignment();

-- SECURITY INVOKER: all statements below are subject to the caller's RLS.
-- The ledger insert and all records commit together; concurrent retries serialize
-- on the ledger primary key. Conflicts abort everything, never overwrite cloud data.
create function public.import_local_data(dataset_id text, payload jsonb, expected_user_id uuid) returns void
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
  insert into public.tasks(id,title,category_id,priority,due_date,scheduled_date,estimated_minutes,status,created_at,completed_at,deleted_at)
    select x->>'id',x->>'title',x->>'categoryId',x->>'priority',(x->>'dueDate')::date,
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
