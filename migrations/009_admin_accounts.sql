-- 009: separate admin portal accounts.
--
-- The admin portal gets its own credential store (email + bcrypt password + signed session
-- token), independent of game 'users'/Firebase. A game account can never sign in to the admin
-- portal and vice versa — admins register separately at /admin/signup. The first admin account
-- becomes an active super_admin; later signups stay 'pending' until a super admin approves them.
--
-- Ownership/audit columns that used to point at public.users now point at admin_accounts,
-- because only admins own folders, upload/approve clips, answer access requests and change flags.

create table if not exists public.admin_accounts (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  display_name  text not null check (char_length(display_name) between 1 and 60),
  role          text not null default 'admin' check (role in ('admin', 'super_admin')),
  status        text not null default 'pending' check (status in ('pending', 'active', 'rejected', 'banned')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.admin_accounts enable row level security;

drop trigger if exists admin_accounts_set_updated_at on public.admin_accounts;
create trigger admin_accounts_set_updated_at before update on public.admin_accounts
  for each row execute function public.set_updated_at();

-- Repoint ownership/audit foreign keys at admin_accounts.
alter table public.folders drop constraint folders_owner_id_fkey;
alter table public.folders alter column owner_id drop not null;
alter table public.folders
  add constraint folders_owner_id_fkey foreign key (owner_id) references public.admin_accounts (id) on delete cascade;

alter table public.clips drop constraint clips_uploaded_by_fkey;
alter table public.clips alter column uploaded_by drop not null;
alter table public.clips
  add constraint clips_uploaded_by_fkey foreign key (uploaded_by) references public.admin_accounts (id) on delete set null;

alter table public.clips drop constraint clips_approved_by_fkey;
alter table public.clips
  add constraint clips_approved_by_fkey foreign key (approved_by) references public.admin_accounts (id) on delete set null;

alter table public.access_requests drop constraint access_requests_responded_by_fkey;
alter table public.access_requests
  add constraint access_requests_responded_by_fkey foreign key (responded_by) references public.admin_accounts (id) on delete set null;

alter table public.flag_change_log drop constraint flag_change_log_changed_by_fkey;
alter table public.flag_change_log
  add constraint flag_change_log_changed_by_fkey foreign key (changed_by) references public.admin_accounts (id) on delete set null;

-- users.clips_created only tracked admin clip uploads; with uploads attributed to
-- admin_accounts the counter is retired (the column stays, it just stops incrementing).
drop trigger if exists clips_bump_created on public.clips;
drop function if exists public.bump_clips_created();

-- Atomically registers an admin account. The first ever becomes an active super_admin;
-- later signups start 'pending' until a super admin activates them. An advisory lock
-- serialises concurrent signups so two "first accounts" cannot both be promoted.
create or replace function public.register_admin_account(
  p_email text,
  p_password_hash text,
  p_display_name text
)
returns public.admin_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_status text;
  v_account public.admin_accounts;
begin
  perform pg_advisory_xact_lock(hashtext('dubsmash.register_admin_account'));

  if exists (select 1 from public.admin_accounts where role = 'super_admin' and status = 'active') then
    v_role := 'admin';
    v_status := 'pending';
  else
    v_role := 'super_admin';
    v_status := 'active';
  end if;

  insert into public.admin_accounts (email, password_hash, display_name, role, status)
  values (lower(p_email), p_password_hash, p_display_name, v_role, v_status)
  returning * into v_account;

  return v_account;
end;
$$;

revoke all on function public.register_admin_account(text, text, text) from public, anon, authenticated;
grant execute on function public.register_admin_account(text, text, text) to service_role;
