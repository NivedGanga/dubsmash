-- 003: game sessions and recordings

create table if not exists public.game_sessions (
  id                      uuid primary key default gen_random_uuid(),
  clip_id                 uuid not null references public.clips (id) on delete cascade,
  created_by              uuid not null references public.users (id) on delete cascade,
  -- [{ user_id, username, display_name, avatar_model, avatar_color, avatar_outfit, character_ids: [], ready, joined_at }]
  players                 jsonb not null default '[]'::jsonb check (jsonb_typeof(players) = 'array'),
  invited_user_ids        uuid[] not null default '{}',
  state                   text not null default 'lobby'
                            check (state in ('lobby', 'recording', 'playback', 'completed', 'cancelled')),
  current_sequence_index  integer not null default 0 check (current_sequence_index >= 0),
  -- Optimistic-concurrency counter: every update to players/state bumps it.
  version                 integer not null default 0,
  final_video_url         text,
  started_at              timestamptz,
  completed_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

drop trigger if exists game_sessions_set_updated_at on public.game_sessions;
create trigger game_sessions_set_updated_at before update on public.game_sessions
  for each row execute function public.set_updated_at();

create table if not exists public.recordings (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null references public.game_sessions (id) on delete cascade,
  user_id               uuid not null references public.users (id) on delete cascade,
  sequence_id           text not null,
  audio_url             text not null,
  cloudinary_public_id  text not null,
  duration_seconds      numeric(8, 3) not null check (duration_seconds > 0 and duration_seconds <= 900),
  attempt               integer not null default 1 check (attempt >= 1),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- One active recording per sequence; re-recording replaces it (attempt is incremented).
  constraint recordings_unique_sequence unique (session_id, sequence_id)
);

drop trigger if exists recordings_set_updated_at on public.recordings;
create trigger recordings_set_updated_at before update on public.recordings
  for each row execute function public.set_updated_at();

-- Keep users.total_recordings in sync (counts every attempt, including re-records).
create or replace function public.bump_total_recordings()
returns trigger
language plpgsql
as $$
begin
  update public.users set total_recordings = total_recordings + 1 where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists recordings_bump_total_insert on public.recordings;
create trigger recordings_bump_total_insert after insert on public.recordings
  for each row execute function public.bump_total_recordings();

drop trigger if exists recordings_bump_total_update on public.recordings;
create trigger recordings_bump_total_update after update of attempt on public.recordings
  for each row when (new.attempt > old.attempt) execute function public.bump_total_recordings();

-- Called once when a session finishes recording.
create or replace function public.record_game_completed(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.game_sessions;
begin
  select * into v_session from public.game_sessions where id = p_session_id;
  if not found then
    return;
  end if;

  update public.users
     set games_played = games_played + 1
   where id in (select (p ->> 'user_id')::uuid from jsonb_array_elements(v_session.players) p);

  update public.clips set times_played = times_played + 1 where id = v_session.clip_id;
end;
$$;

revoke all on function public.record_game_completed(uuid) from public, anon, authenticated;
grant execute on function public.record_game_completed(uuid) to service_role;

alter table public.game_sessions enable row level security;
alter table public.recordings enable row level security;
