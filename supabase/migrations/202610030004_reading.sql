-- Books retain an explicit progress offset; ledger pages are derived, never cached.
create table public.books (
  user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  id text not null default gen_random_uuid()::text check(length(id) between 1 and 200),
  title text not null check(length(btrim(title)) between 1 and 160),
  author text check(author is null or length(btrim(author)) between 1 and 120),
  total_pages integer not null check(total_pages between 1 and 100000),
  progress_offset integer not null default 0,
  status text not null default 'want_to_read' check(status in ('want_to_read','reading','paused','completed')),
  started_date date, completed_date date,
  weekly_page_goal integer check(weekly_page_goal between 1 and 100000),
  archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(user_id,id),
  check((status='completed')=(completed_date is not null)),
  check(status='want_to_read' or started_date is not null),
  check(completed_date is null or completed_date>=started_date),
  check((started_date is null or isfinite(started_date)) and (completed_date is null or isfinite(completed_date)))
);
create index books_user_status on public.books(user_id,status) where archived_at is null;
create table public.reading_sessions (
  user_id uuid not null default auth.uid(),
  id uuid not null default gen_random_uuid(), book_id text not null,
  session_date date not null check(isfinite(session_date)),
  start_page integer not null check(start_page>=0),
  end_page integer not null check(end_page>start_page and end_page<=100000),
  pages_read integer generated always as (end_page-start_page) stored,
  minutes integer check(minutes between 1 and 1440),
  time_source text not null default 'reading' check(time_source in ('reading','task_timer')),
  voided_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(user_id,id),
  foreign key(user_id,book_id) references public.books(user_id,id) on delete restrict
);
create index reading_sessions_book_history on public.reading_sessions(user_id,book_id,session_date);
alter table public.books enable row level security;
alter table public.reading_sessions enable row level security;
revoke all on public.books,public.reading_sessions from anon,authenticated;
grant select,insert,update on public.books,public.reading_sessions to authenticated;
create policy books_read on public.books for select to authenticated using((select auth.uid())=user_id);
create policy books_create on public.books for insert to authenticated with check((select auth.uid())=user_id);
create policy books_change on public.books for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy reading_sessions_read on public.reading_sessions for select to authenticated using((select auth.uid())=user_id);
create policy reading_sessions_create on public.reading_sessions for insert to authenticated with check((select auth.uid())=user_id);
create policy reading_sessions_change on public.reading_sessions for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);

create view public.books_with_progress with(security_invoker=true) as
select b.*, (b.progress_offset+coalesce((select sum(s.pages_read) from public.reading_sessions s
  where s.user_id=b.user_id and s.book_id=b.id and s.voided_at is null),0))::integer as current_page from public.books b;
revoke all on public.books_with_progress from public,anon,authenticated;
grant select on public.books_with_progress to authenticated;

create function public.guard_book_progress() returns trigger language plpgsql set search_path='' as $$
declare progress bigint;
begin
  if TG_OP='UPDATE' then
    if (new.user_id,new.id) is distinct from (old.user_id,old.id) then raise exception 'Book identity cannot change'; end if;
    new.created_at:=old.created_at;
  end if;
  new.updated_at:=clock_timestamp();
  select new.progress_offset+coalesce(sum(pages_read),0) into progress from public.reading_sessions where user_id=new.user_id and book_id=new.id and voided_at is null;
  if progress<0 or progress>new.total_pages then raise exception 'Current page must be within the book'; end if;
  if new.status='completed' and progress<>new.total_pages then raise exception 'A completed book must be at its final page'; end if;
  if exists(select 1 from public.reading_sessions where user_id=new.user_id and book_id=new.id and voided_at is null and end_page>new.total_pages) then
    raise exception 'Total pages cannot exclude retained session ranges';
  end if;
  return new;
end; $$;
create trigger books_progress_guard before insert or update on public.books for each row execute function public.guard_book_progress();

create function public.guard_reading_session() returns trigger language plpgsql set search_path='' as $$
declare book public.books; progress bigint; old_pages integer:=0;
begin
  if TG_OP='UPDATE' then
    if (new.user_id,new.id,new.book_id) is distinct from (old.user_id,old.id,old.book_id) then raise exception 'Reading session identity cannot change'; end if;
    if old.voided_at is not null then raise exception 'Removed reading sessions cannot change'; end if;
    new.created_at:=old.created_at;
    old_pages:=old.end_page-old.start_page;
  else
    if new.voided_at is not null then raise exception 'New sessions cannot be removed'; end if;
    new.created_at:=clock_timestamp();
  end if;
  select * into book from public.books where user_id=new.user_id and id=new.book_id for update;
  if not found then raise exception 'This book is not available'; end if;
  select book.progress_offset+coalesce(sum(pages_read),0) into progress from public.reading_sessions where user_id=new.user_id and book_id=new.book_id and voided_at is null;
  if TG_OP='INSERT' then
    if book.archived_at is not null or book.status<>'reading' then raise exception 'Start or restore the book before logging reading'; end if;
    if new.start_page<>progress then raise exception 'Reading progress changed. Reload before logging from the current page'; end if;
  end if;
  if new.end_page>book.total_pages then raise exception 'Ending page cannot exceed total pages'; end if;
  progress:=progress-old_pages+case when new.voided_at is null then new.end_page-new.start_page else 0 end;
  if progress<0 or progress>book.total_pages then raise exception 'Correction would put current page outside the book. Adjust current page first'; end if;
  new.updated_at:=clock_timestamp();
  return new;
end; $$;
create trigger reading_sessions_guard before insert or update on public.reading_sessions for each row execute function public.guard_reading_session();

-- Any ledger change advances book revision so stale manual progress cannot overwrite it.
create function public.reading_progress_changed() returns trigger language plpgsql set search_path='' as $$
begin
  update public.books b set status=case when b.status='completed' and p.current_page<>b.total_pages then 'reading' else b.status end,
    completed_date=case when b.status='completed' and p.current_page<>b.total_pages then null else b.completed_date end
    from public.books_with_progress p where b.user_id=new.user_id and b.id=new.book_id and p.user_id=b.user_id and p.id=b.id;
  return new;
end; $$;
create trigger reading_progress_changed after insert or update on public.reading_sessions for each row execute function public.reading_progress_changed();

create function public.save_reading_book(p_id text,p_fields jsonb,p_updated_at timestamptz,expected_user_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); page_total bigint;
begin
  if owner_id is null or owner_id is distinct from expected_user_id then raise exception 'Your session changed. Sign in again'; end if;
  if p_id is null then
    insert into public.books(title,author,total_pages,progress_offset,status,started_date,completed_date,weekly_page_goal)
    values(p_fields->>'title',p_fields->>'author',(p_fields->>'total_pages')::integer,(p_fields->>'current_page')::integer,
      p_fields->>'status',(p_fields->>'started_date')::date,(p_fields->>'completed_date')::date,(p_fields->>'weekly_page_goal')::integer);
  else
    perform 1 from public.books where user_id=owner_id and id=p_id and updated_at=p_updated_at for update;
    if not found then raise exception 'Book changed. Reload before editing'; end if;
    select coalesce(sum(pages_read),0) into page_total from public.reading_sessions where user_id=owner_id and book_id=p_id and voided_at is null;
    update public.books set title=p_fields->>'title',author=p_fields->>'author',total_pages=(p_fields->>'total_pages')::integer,
      progress_offset=(p_fields->>'current_page')::integer-page_total,status=p_fields->>'status',
      started_date=(p_fields->>'started_date')::date,completed_date=(p_fields->>'completed_date')::date,
      weekly_page_goal=(p_fields->>'weekly_page_goal')::integer where user_id=owner_id and id=p_id;
  end if;
end; $$;
revoke all on function public.save_reading_book(text,jsonb,timestamptz,uuid) from public,anon;
grant execute on function public.save_reading_book(text,jsonb,timestamptz,uuid) to authenticated;

-- Request UUID prevents duplicated reading on a retry after an uncertain response.
create function public.log_reading_session(p_id uuid,p_fields jsonb,expected_user_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid(); existing public.reading_sessions;
begin
  if owner_id is null or owner_id is distinct from expected_user_id then raise exception 'Your session changed. Sign in again'; end if;
  perform 1 from public.books where user_id=owner_id and id=p_fields->>'book_id' for update;
  if not found then raise exception 'This book is not available'; end if;
  select * into existing from public.reading_sessions where user_id=owner_id and id=p_id;
  if found then
    if (existing.book_id,existing.session_date,existing.start_page,existing.end_page,existing.minutes,existing.time_source)
      is distinct from (p_fields->>'book_id',(p_fields->>'session_date')::date,(p_fields->>'start_page')::integer,
        (p_fields->>'end_page')::integer,(p_fields->>'minutes')::integer,p_fields->>'time_source') then
      raise exception 'This request was already saved with different details';
    end if;
    return;
  end if;
  insert into public.reading_sessions(id,book_id,session_date,start_page,end_page,minutes,time_source)
  values(p_id,p_fields->>'book_id',(p_fields->>'session_date')::date,(p_fields->>'start_page')::integer,
    (p_fields->>'end_page')::integer,(p_fields->>'minutes')::integer,p_fields->>'time_source');
end; $$;
revoke all on function public.log_reading_session(uuid,jsonb,uuid) from public,anon;
grant execute on function public.log_reading_session(uuid,jsonb,uuid) to authenticated;
