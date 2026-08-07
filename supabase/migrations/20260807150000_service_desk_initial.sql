create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.app_role as enum ('user', 'specialist', 'admin');
create type public.user_state as enum ('invited', 'active', 'blocked');
create type public.ticket_status as enum ('new', 'in_progress', 'waiting_for_user', 'resolved', 'closed', 'cancelled');
create type public.ticket_priority as enum ('low', 'medium', 'high', 'critical');
create type public.comment_visibility as enum ('public', 'internal');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_subject text not null unique check (char_length(auth_subject) between 3 and 255),
  display_name text not null check (char_length(display_name) between 2 and 80),
  email text not null unique check (char_length(email) <= 254 and email = lower(email)),
  role public.app_role not null default 'user',
  state public.user_state not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_calendars (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 80),
  timezone text not null default 'Europe/Moscow',
  created_at timestamptz not null default now()
);

create table public.working_intervals (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.business_calendars(id) on delete cascade,
  iso_weekday smallint not null check (iso_weekday between 1 and 7),
  start_time time not null,
  end_time time not null,
  check (start_time < end_time),
  unique (calendar_id, iso_weekday, start_time)
);

create table public.calendar_exceptions (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.business_calendars(id) on delete cascade,
  exception_date date not null,
  name text not null check (char_length(name) between 2 and 120),
  is_working boolean not null default false,
  start_time time,
  end_time time,
  check ((not is_working and start_time is null and end_time is null) or (is_working and start_time is not null and end_time is not null and start_time < end_time)),
  unique (calendar_id, exception_date)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 80),
  is_active boolean not null default true,
  first_response_minutes integer not null check (first_response_minutes between 5 and 10080),
  resolution_minutes integer not null check (resolution_minutes between first_response_minutes and 43200),
  calendar_id uuid not null references public.business_calendars(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.specialist_category_access (
  specialist_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  granted_by uuid not null references public.profiles(id),
  granted_at timestamptz not null default now(),
  primary key (specialist_id, category_id)
);

create sequence public.ticket_number_seq start with 1001;

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.ticket_number_seq'),
  subject text not null check (char_length(subject) between 5 and 80 and subject !~ '[<>]'),
  description text not null check (char_length(description) between 10 and 500 and description !~ '[<>]'),
  category_id uuid not null references public.categories(id),
  priority public.ticket_priority not null default 'medium',
  status public.ticket_status not null default 'new',
  author_id uuid not null references public.profiles(id),
  assignee_id uuid references public.profiles(id),
  first_response_due_at timestamptz,
  resolution_due_at timestamptz,
  first_responded_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete restrict,
  author_id uuid not null references public.profiles(id),
  visibility public.comment_visibility not null default 'public',
  body text not null check (char_length(body) between 2 and 300 and body !~ '[<>]'),
  created_at timestamptz not null default now()
);

create table public.ticket_events (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets(id) on delete restrict,
  actor_id uuid not null references public.profiles(id),
  action text not null check (char_length(action) between 3 and 80),
  occurred_at timestamptz not null default now(),
  request_id text not null check (char_length(request_id) between 8 and 80)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null check (char_length(action) between 3 and 100),
  object_type text not null check (char_length(object_type) between 2 and 50),
  object_id text,
  result text not null check (result in ('success', 'denied', 'failure')),
  request_id text not null check (char_length(request_id) between 8 and 80),
  occurred_at timestamptz not null default now()
);

create table private.request_rate_limits (
  subject text not null,
  action text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  primary key (subject, action, window_start)
);

create index profiles_auth_subject_idx on public.profiles(auth_subject);
create index tickets_author_idx on public.tickets(author_id, created_at desc);
create index tickets_assignee_idx on public.tickets(assignee_id, created_at desc);
create index tickets_category_status_idx on public.tickets(category_id, status, created_at desc);
create index tickets_resolution_due_idx on public.tickets(resolution_due_at) where status not in ('resolved', 'closed', 'cancelled');
create index comments_ticket_idx on public.comments(ticket_id, created_at);
create index ticket_events_ticket_idx on public.ticket_events(ticket_id, occurred_at desc);
create index audit_events_time_idx on public.audit_events(occurred_at desc);
create index rate_limits_expiry_idx on private.request_rate_limits(window_start);

create or replace function private.current_subject()
returns text
language sql
stable
security definer
set search_path = ''
as $$ select nullif(auth.jwt() ->> 'sub', '') $$;

create or replace function private.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.profiles
  where auth_subject = private.current_subject() and state = 'active'
  limit 1
$$;

create or replace function private.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles
  where id = private.current_profile_id()
$$;

create or replace function private.can_access_category(p_category_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when private.current_role() = 'admin' then true
    when private.current_role() = 'specialist' then exists (
      select 1 from public.specialist_category_access
      where specialist_id = private.current_profile_id() and category_id = p_category_id
    )
    else false
  end
$$;

create or replace function private.can_access_ticket(p_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tickets t
    where t.id = p_ticket_id and (
      private.current_role() = 'admin'
      or (private.current_role() = 'user' and t.author_id = private.current_profile_id())
      or (private.current_role() = 'specialist' and private.can_access_category(t.category_id))
    )
  )
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if tg_table_name = 'tickets' then new.version = old.version + 1; end if;
  return new;
end
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger categories_updated_at before update on public.categories for each row execute function private.set_updated_at();
create trigger tickets_updated_at before update on public.tickets for each row execute function private.set_updated_at();

create or replace function private.add_business_minutes(p_start timestamptz, p_minutes integer, p_calendar_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_cursor timestamptz := p_start;
  v_remaining integer := p_minutes;
  v_local_date date;
  v_start timestamptz;
  v_end timestamptz;
  v_available integer;
  v_guard integer := 0;
  v_interval record;
begin
  select timezone into v_timezone from public.business_calendars where id = p_calendar_id;
  if v_timezone is null or p_minutes < 0 then raise exception 'invalid calendar input'; end if;
  if p_minutes = 0 then return p_start; end if;

  while v_remaining > 0 and v_guard < 370 loop
    v_local_date := (v_cursor at time zone v_timezone)::date;
    for v_interval in
      select x.start_time, x.end_time from (
        select ce.start_time, ce.end_time
        from public.calendar_exceptions ce
        where ce.calendar_id = p_calendar_id and ce.exception_date = v_local_date and ce.is_working
        union all
        select wi.start_time, wi.end_time
        from public.working_intervals wi
        where wi.calendar_id = p_calendar_id
          and wi.iso_weekday = extract(isodow from v_local_date)::smallint
          and not exists (
            select 1 from public.calendar_exceptions ce
            where ce.calendar_id = p_calendar_id and ce.exception_date = v_local_date
          )
      ) x order by x.start_time
    loop
      v_start := (v_local_date + v_interval.start_time) at time zone v_timezone;
      v_end := (v_local_date + v_interval.end_time) at time zone v_timezone;
      if v_end > v_cursor then
        v_start := greatest(v_start, v_cursor);
        v_available := floor(extract(epoch from (v_end - v_start)) / 60);
        if v_remaining <= v_available then return v_start + make_interval(mins => v_remaining); end if;
        v_remaining := v_remaining - greatest(v_available, 0);
      end if;
    end loop;
    v_cursor := ((v_local_date + 1)::timestamp at time zone v_timezone);
    v_guard := v_guard + 1;
  end loop;
  raise exception 'business calendar horizon exceeded';
end
$$;

create or replace function private.apply_ticket_sla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category public.categories;
begin
  select * into v_category from public.categories where id = new.category_id and is_active;
  if not found then raise exception 'inactive category'; end if;
  new.first_response_due_at := private.add_business_minutes(new.created_at, v_category.first_response_minutes, v_category.calendar_id);
  new.resolution_due_at := private.add_business_minutes(new.created_at, v_category.resolution_minutes, v_category.calendar_id);
  return new;
end
$$;

create trigger tickets_apply_sla before insert on public.tickets for each row execute function private.apply_ticket_sla();
create trigger tickets_reapply_sla before update of category_id on public.tickets for each row execute function private.apply_ticket_sla();

alter table public.profiles enable row level security;
alter table public.business_calendars enable row level security;
alter table public.working_intervals enable row level security;
alter table public.calendar_exceptions enable row level security;
alter table public.categories enable row level security;
alter table public.specialist_category_access enable row level security;
alter table public.tickets enable row level security;
alter table public.comments enable row level security;
alter table public.ticket_events enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select on public.profiles for select to authenticated
using (auth_subject = private.current_subject() or private.current_role() = 'admin');

create policy calendars_select on public.business_calendars for select to authenticated using (private.current_profile_id() is not null);
create policy intervals_select on public.working_intervals for select to authenticated using (private.current_profile_id() is not null);
create policy exceptions_select on public.calendar_exceptions for select to authenticated using (private.current_profile_id() is not null);

create policy categories_select on public.categories for select to authenticated
using ((is_active and private.current_profile_id() is not null) or private.current_role() = 'admin');

create policy specialist_access_select on public.specialist_category_access for select to authenticated
using (specialist_id = private.current_profile_id() or private.current_role() = 'admin');

create policy tickets_select on public.tickets for select to authenticated
using (
  private.current_role() = 'admin'
  or (private.current_role() = 'user' and author_id = private.current_profile_id())
  or (private.current_role() = 'specialist' and private.can_access_category(category_id))
);

create policy tickets_insert on public.tickets for insert to authenticated
with check (private.current_role() = 'user' and author_id = private.current_profile_id() and assignee_id is null and status = 'new');

create policy comments_select on public.comments for select to authenticated
using (private.can_access_ticket(ticket_id) and (visibility = 'public' or private.current_role() in ('specialist', 'admin')));

create policy comments_insert on public.comments for insert to authenticated
with check (
  author_id = private.current_profile_id()
  and (
    (private.current_role() = 'user' and visibility = 'public' and exists (select 1 from public.tickets t where t.id = ticket_id and t.author_id = private.current_profile_id() and t.status not in ('closed', 'cancelled')))
    or (private.current_role() = 'specialist' and exists (select 1 from public.tickets t where t.id = ticket_id and private.can_access_category(t.category_id)))
  )
);

create policy ticket_events_select on public.ticket_events for select to authenticated
using (private.can_access_ticket(ticket_id) and (action <> 'comment.internal' or private.current_role() in ('specialist', 'admin')));

create policy audit_select on public.audit_events for select to authenticated
using (private.current_role() = 'admin');

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated;
grant select on public.profiles, public.business_calendars, public.working_intervals, public.calendar_exceptions, public.categories, public.specialist_category_access, public.tickets, public.comments, public.ticket_events, public.audit_events to authenticated;
grant insert on public.tickets, public.comments to authenticated;
grant usage, select on sequence public.ticket_number_seq to authenticated;

create or replace function public.check_rate_limit(p_action text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_subject text := private.current_subject();
  v_window timestamptz;
  v_count integer;
begin
  if private.current_profile_id() is null or p_action not in ('ticket.create', 'comment.create') or p_limit not between 1 and 100 or p_window_seconds not between 10 and 86400 then return false; end if;
  v_window := to_timestamp(floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds);
  insert into private.request_rate_limits(subject, action, window_start, request_count)
  values (v_subject, p_action, v_window, 1)
  on conflict (subject, action, window_start)
  do update set request_count = private.request_rate_limits.request_count + 1
  returning request_count into v_count;
  return v_count <= p_limit;
end
$$;

create or replace function public.record_login(p_request_id text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_actor uuid := private.current_profile_id();
begin
  if v_actor is null or char_length(p_request_id) not between 8 and 80 then return false; end if;
  if not exists (select 1 from public.audit_events where actor_id = v_actor and action = 'auth.login' and occurred_at > now() - interval '15 minutes') then
    insert into public.audit_events(actor_id, action, object_type, object_id, result, request_id)
    values (v_actor, 'auth.login', 'session', null, 'success', p_request_id);
  end if;
  return true;
end
$$;

create or replace function public.activate_own_profile()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set state = 'active'
  where auth_subject = private.current_subject() and state = 'invited';
  return found;
end
$$;

create or replace function public.write_ticket_event(p_ticket_id uuid, p_action text, p_request_id text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_actor uuid := private.current_profile_id();
begin
  if v_actor is null or not private.can_access_ticket(p_ticket_id) or p_action not in ('ticket.created', 'comment.public', 'comment.internal') or char_length(p_request_id) not between 8 and 80 then return false; end if;
  insert into public.ticket_events(ticket_id, actor_id, action, request_id) values (p_ticket_id, v_actor, p_action, p_request_id);
  return true;
end
$$;

create or replace function public.update_own_ticket(p_ticket_id uuid, p_subject text, p_description text, p_category_id uuid, p_priority public.ticket_priority, p_request_id text)
returns public.tickets
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_ticket public.tickets; v_actor uuid := private.current_profile_id();
begin
  if private.current_role() <> 'user' then raise exception 'forbidden'; end if;
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found or v_ticket.author_id <> v_actor or v_ticket.status <> 'new' or v_ticket.assignee_id is not null then raise exception 'forbidden'; end if;
  if char_length(p_subject) not between 5 and 80 or p_subject ~ '[<>]' or char_length(p_description) not between 10 and 500 or p_description ~ '[<>]' or p_priority = 'critical' then raise exception 'invalid input'; end if;
  if not exists (select 1 from public.categories where id = p_category_id and is_active) then raise exception 'invalid category'; end if;
  update public.tickets set subject = p_subject, description = p_description, category_id = p_category_id, priority = p_priority where id = p_ticket_id returning * into v_ticket;
  insert into public.ticket_events(ticket_id, actor_id, action, request_id) values (p_ticket_id, v_actor, 'ticket.updated', p_request_id);
  return v_ticket;
end
$$;

create or replace function public.claim_ticket(p_ticket_id uuid, p_request_id text)
returns public.tickets
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_ticket public.tickets; v_actor uuid := private.current_profile_id();
begin
  if private.current_role() <> 'specialist' then raise exception 'forbidden'; end if;
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found or not private.can_access_category(v_ticket.category_id) or v_ticket.assignee_id is not null or v_ticket.status <> 'new' then raise exception 'forbidden'; end if;
  update public.tickets set assignee_id = v_actor, status = 'in_progress' where id = p_ticket_id returning * into v_ticket;
  insert into public.ticket_events(ticket_id, actor_id, action, request_id) values (p_ticket_id, v_actor, 'ticket.claimed', p_request_id);
  return v_ticket;
end
$$;

create or replace function public.transition_ticket(p_ticket_id uuid, p_status public.ticket_status, p_request_id text)
returns public.tickets
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_ticket public.tickets; v_actor uuid := private.current_profile_id(); v_allowed boolean := false;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found then raise exception 'forbidden'; end if;
  if private.current_role() = 'specialist' and v_ticket.assignee_id = v_actor and private.can_access_category(v_ticket.category_id) then
    v_allowed := (v_ticket.status = 'in_progress' and p_status in ('waiting_for_user', 'resolved')) or (v_ticket.status = 'waiting_for_user' and p_status = 'in_progress');
  elsif private.current_role() = 'user' and v_ticket.author_id = v_actor then
    v_allowed := v_ticket.status = 'resolved' and p_status in ('closed', 'in_progress');
  end if;
  if not v_allowed then raise exception 'forbidden'; end if;
  update public.tickets set status = p_status, resolved_at = case when p_status = 'resolved' then now() else resolved_at end, closed_at = case when p_status = 'closed' then now() else closed_at end where id = p_ticket_id returning * into v_ticket;
  insert into public.ticket_events(ticket_id, actor_id, action, request_id) values (p_ticket_id, v_actor, 'ticket.status.' || p_status::text, p_request_id);
  return v_ticket;
end
$$;

create or replace function public.write_admin_audit(p_action text, p_object_type text, p_object_id text, p_request_id text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_actor uuid := private.current_profile_id();
begin
  if private.current_role() <> 'admin' or p_action not in ('user.invited', 'user.role_changed', 'category.created', 'category.updated', 'queue.updated') or char_length(p_object_type) not between 2 and 50 or char_length(p_request_id) not between 8 and 80 then raise exception 'forbidden'; end if;
  insert into public.audit_events(actor_id, action, object_type, object_id, result, request_id) values (v_actor, p_action, p_object_type, p_object_id, 'success', p_request_id);
  return true;
end
$$;

create or replace function public.admin_update_role(p_profile_id uuid, p_role public.app_role, p_request_id text)
returns public.profiles
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_profile public.profiles; v_actor uuid := private.current_profile_id();
begin
  if private.current_role() <> 'admin' or p_profile_id = v_actor then raise exception 'forbidden'; end if;
  update public.profiles set role = p_role where id = p_profile_id returning * into v_profile;
  if not found then raise exception 'not found'; end if;
  if p_role <> 'specialist' then delete from public.specialist_category_access where specialist_id = p_profile_id; end if;
  insert into public.audit_events(actor_id, action, object_type, object_id, result, request_id) values (v_actor, 'user.role_changed', 'profile', p_profile_id::text, 'success', p_request_id);
  return v_profile;
end
$$;

create or replace function public.admin_create_category(p_name text, p_first_response_minutes integer, p_resolution_minutes integer, p_is_active boolean, p_request_id text)
returns public.categories
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_category public.categories; v_actor uuid := private.current_profile_id(); v_calendar uuid;
begin
  if private.current_role() <> 'admin' then raise exception 'forbidden'; end if;
  select id into v_calendar from public.business_calendars order by created_at limit 1;
  if v_calendar is null then raise exception 'calendar unavailable'; end if;
  insert into public.categories(name, is_active, first_response_minutes, resolution_minutes, calendar_id)
  values (p_name, p_is_active, p_first_response_minutes, p_resolution_minutes, v_calendar)
  returning * into v_category;
  insert into public.audit_events(actor_id, action, object_type, object_id, result, request_id) values (v_actor, 'category.created', 'category', v_category.id::text, 'success', p_request_id);
  return v_category;
end
$$;

create or replace function public.admin_set_specialist_categories(p_profile_id uuid, p_category_ids uuid[], p_request_id text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_actor uuid := private.current_profile_id(); v_requested integer := cardinality(p_category_ids); v_valid integer;
begin
  if private.current_role() <> 'admin' or v_requested > 30 or p_category_ids is null then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.profiles where id = p_profile_id and role = 'specialist' and state <> 'blocked') then raise exception 'forbidden'; end if;
  select count(distinct id) into v_valid from public.categories where id = any(p_category_ids) and is_active;
  if v_valid <> v_requested then raise exception 'forbidden'; end if;
  delete from public.specialist_category_access where specialist_id = p_profile_id;
  insert into public.specialist_category_access(specialist_id, category_id, granted_by)
  select p_profile_id, category_id, v_actor from unnest(p_category_ids) as category_id;
  insert into public.audit_events(actor_id, action, object_type, object_id, result, request_id)
  values (v_actor, 'queue.updated', 'profile', p_profile_id::text, 'success', p_request_id);
  return true;
end
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;
grant execute on function public.record_login(text) to authenticated;
grant execute on function public.activate_own_profile() to authenticated;
grant execute on function public.write_ticket_event(uuid, text, text) to authenticated;
grant execute on function public.update_own_ticket(uuid, text, text, uuid, public.ticket_priority, text) to authenticated;
grant execute on function public.claim_ticket(uuid, text) to authenticated;
grant execute on function public.transition_ticket(uuid, public.ticket_status, text) to authenticated;
grant execute on function public.write_admin_audit(text, text, text, text) to authenticated;
grant execute on function public.admin_update_role(uuid, public.app_role, text) to authenticated;
grant execute on function public.admin_create_category(text, integer, integer, boolean, text) to authenticated;
grant execute on function public.admin_set_specialist_categories(uuid, uuid[], text) to authenticated;

insert into public.business_calendars(id, name, timezone)
values ('00000000-0000-0000-0000-000000000001', 'Основной календарь', 'Europe/Moscow');

insert into public.working_intervals(calendar_id, iso_weekday, start_time, end_time)
select '00000000-0000-0000-0000-000000000001', day, '09:00'::time, '18:00'::time
from generate_series(1, 5) as day;

insert into public.categories(name, is_active, first_response_minutes, resolution_minutes, calendar_id) values
('Доступы', true, 60, 240, '00000000-0000-0000-0000-000000000001'),
('Оборудование', true, 120, 480, '00000000-0000-0000-0000-000000000001'),
('Приложения', true, 180, 720, '00000000-0000-0000-0000-000000000001'),
('Консультация', true, 240, 1440, '00000000-0000-0000-0000-000000000001');
