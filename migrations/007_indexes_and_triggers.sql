-- 007: performance indexes, realtime publication, feature-flag defaults

-- users
create index if not exists users_role_idx on public.users (role);
create index if not exists users_username_trgm_prefix_idx on public.users (lower(username) text_pattern_ops);

-- access_requests
create index if not exists access_requests_status_idx on public.access_requests (status, requested_at desc);
create index if not exists access_requests_user_idx on public.access_requests (user_id, requested_at desc);

-- folders
create index if not exists folders_owner_idx on public.folders (owner_id);
create index if not exists folders_parent_idx on public.folders (parent_folder_id);

-- clips
create index if not exists clips_uploaded_by_idx on public.clips (uploaded_by, created_at desc);
create index if not exists clips_folder_idx on public.clips (folder_id);
create index if not exists clips_status_idx on public.clips (status, created_at desc);
create index if not exists clips_character_count_idx on public.clips (character_count) where status = 'active';
create index if not exists clips_search_idx on public.clips using gin (search_vector);

-- game sessions / recordings
create index if not exists game_sessions_clip_idx on public.game_sessions (clip_id);
create index if not exists game_sessions_created_by_idx on public.game_sessions (created_by, created_at desc);
create index if not exists game_sessions_state_idx on public.game_sessions (state, created_at desc);
create index if not exists game_sessions_players_idx on public.game_sessions using gin (players jsonb_path_ops);
create index if not exists recordings_session_idx on public.recordings (session_id);
create index if not exists recordings_user_idx on public.recordings (user_id);

-- notifications
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id) where is_read = false;

-- friends
create index if not exists user_friends_friend_idx on public.user_friends (friend_id, status);
create index if not exists user_friends_user_idx on public.user_friends (user_id, status);

-- processing queue
create index if not exists video_processing_queue_status_idx on public.video_processing_queue (status, created_at);

-- flag log
create index if not exists flag_change_log_flag_idx on public.flag_change_log (flag_name, changed_at desc);

-- Realtime: expose notifications and the processing queue to Supabase Realtime (postgres_changes).
-- The app primarily uses broadcast channels (see lib/realtime.ts); this keeps postgres_changes available
-- for future use once Supabase third-party auth (Firebase) + RLS policies are configured.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.notifications;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.video_processing_queue;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.user_friends;
    exception when duplicate_object then null;
    end;
  end if;
end;
$$;

-- Notification housekeeping: when a notification is marked read, stamp read_at.
create or replace function public.stamp_notification_read()
returns trigger
language plpgsql
as $$
begin
  if new.is_read and not old.is_read and new.read_at is null then
    new.read_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_stamp_read on public.notifications;
create trigger notifications_stamp_read before update on public.notifications
  for each row execute function public.stamp_notification_read();

-- Default constraint for feature flags: percentage flags default to 0% rollout, user lists to empty.
create or replace function public.feature_flag_defaults()
returns trigger
language plpgsql
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

drop trigger if exists feature_flags_defaults on public.feature_flags;
create trigger feature_flags_defaults before insert or update on public.feature_flags
  for each row execute function public.feature_flag_defaults();
