-- 001: users and admin-portal access requests
-- All application access goes through the Next.js API using the service-role key.
-- RLS is enabled with no policies, so the public anon key cannot read or write these tables.

create extension if not exists pgcrypto;

-- Shared trigger function to maintain updated_at columns.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.users (
  id                uuid primary key default gen_random_uuid(),
  firebase_uid      text not null unique,
  email             text not null unique,
  username          text not null,
  display_name      text not null,
  role              text not null default 'user' check (role in ('user', 'admin', 'super_admin')),
  avatar_model      text not null default 'casual_m'
                      check (avatar_model in ('casual_m', 'formal_m', 'casual_f', 'formal_f', 'robot', 'blob')),
  avatar_color      text not null default '#ff2e6e' check (avatar_color ~ '^#[0-9a-fA-F]{6}$'),
  avatar_outfit     text not null default 'tee' check (avatar_outfit in ('tee', 'hoodie', 'suit', 'dress', 'jersey')),
  avatar_url        text,
  status            text not null default 'active' check (status in ('active', 'inactive', 'banned')),
  games_played      integer not null default 0 check (games_played >= 0),
  total_recordings  integer not null default 0 check (total_recordings >= 0),
  clips_created     integer not null default 0 check (clips_created >= 0),
  last_seen_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint users_username_format check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  constraint users_display_name_len check (char_length(display_name) between 1 and 40)
);

-- Usernames are unique case-insensitively.
create unique index if not exists users_username_lower_key on public.users (lower(username));

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

create table if not exists public.access_requests (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id) on delete cascade,
  status            text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  message           text check (char_length(message) <= 500),
  response_message  text check (char_length(response_message) <= 500),
  requested_at      timestamptz not null default now(),
  responded_at      timestamptz,
  responded_by      uuid references public.users (id) on delete set null
);

-- A user can have at most one pending request at a time.
create unique index if not exists access_requests_one_pending_per_user
  on public.access_requests (user_id) where status = 'pending';

alter table public.users enable row level security;
alter table public.access_requests enable row level security;

-- Atomically registers a user. The first user ever (when no super_admin exists) becomes super_admin.
-- An advisory lock serialises concurrent signups so two "first users" cannot both be promoted.
create or replace function public.register_user(
  p_firebase_uid text,
  p_email text,
  p_username text,
  p_display_name text,
  p_default_role text
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_user public.users;
begin
  if p_default_role not in ('user', 'admin') then
    raise exception 'invalid default role %', p_default_role;
  end if;

  perform pg_advisory_xact_lock(hashtext('dubsmash.register_user'));

  if exists (select 1 from public.users where role = 'super_admin') then
    v_role := p_default_role;
  else
    v_role := 'super_admin';
  end if;

  insert into public.users (firebase_uid, email, username, display_name, role)
  values (p_firebase_uid, lower(p_email), p_username, p_display_name, v_role)
  returning * into v_user;

  return v_user;
end;
$$;

revoke all on function public.register_user(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_user(text, text, text, text, text) to service_role;
