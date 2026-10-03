-- 008: pin search_path on trigger functions (Supabase lint: function_search_path_mutable)
--      and add covering indexes for unindexed foreign keys (lint: unindexed_foreign_keys)

create index if not exists access_requests_responded_by_idx on public.access_requests (responded_by);
create index if not exists clips_approved_by_idx on public.clips (approved_by);
create index if not exists flag_change_log_changed_by_idx on public.flag_change_log (changed_by);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.bump_clips_created()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.users set clips_created = clips_created + 1 where id = new.uploaded_by;
  return new;
end;
$$;

create or replace function public.bump_total_recordings()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.users set total_recordings = total_recordings + 1 where id = new.user_id;
  return new;
end;
$$;

create or replace function public.stamp_notification_read()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_read and not old.is_read and new.read_at is null then
    new.read_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.feature_flag_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.flag_type = 'percentage' and not (new.flag_value ? 'rollout_percentage') then
    new.flag_value := new.flag_value || '{"rollout_percentage": 0}'::jsonb;
  elsif new.flag_type = 'user_list' and not (new.flag_value ? 'user_ids') then
    new.flag_value := new.flag_value || '{"user_ids": []}'::jsonb;
  end if;
  return new;
end;
$$;
