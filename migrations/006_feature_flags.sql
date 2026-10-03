-- 006: feature flags and audit log

create table if not exists public.feature_flags (
  id           uuid primary key default gen_random_uuid(),
  flag_name    text not null unique check (flag_name ~ '^[a-z][a-z0-9_]{2,63}$'),
  description  text not null default '',
  is_enabled   boolean not null default false,
  -- Critical flags require explicit confirmation in the admin UI before toggling.
  is_critical  boolean not null default false,
  flag_type    text not null check (flag_type in ('boolean', 'percentage', 'user_list')),
  -- percentage: { "rollout_percentage": 0-100 }, user_list: { "user_ids": ["uuid", ...] }
  flag_value   jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint feature_flags_value_shape check (
    case flag_type
      when 'percentage' then
        jsonb_typeof(flag_value -> 'rollout_percentage') = 'number'
        and (flag_value ->> 'rollout_percentage')::numeric between 0 and 100
      when 'user_list' then jsonb_typeof(flag_value -> 'user_ids') = 'array'
      else true
    end
  )
);

drop trigger if exists feature_flags_set_updated_at on public.feature_flags;
create trigger feature_flags_set_updated_at before update on public.feature_flags
  for each row execute function public.set_updated_at();

create table if not exists public.flag_change_log (
  id          uuid primary key default gen_random_uuid(),
  flag_name   text not null references public.feature_flags (flag_name) on delete cascade on update cascade,
  old_value   jsonb,
  new_value   jsonb not null,
  changed_by  uuid references public.users (id) on delete set null,
  changed_at  timestamptz not null default now()
);

alter table public.feature_flags enable row level security;
alter table public.flag_change_log enable row level security;
