-- 004: notifications and friendships

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  type        text not null check (type in (
                'friend_request', 'friend_accepted', 'game_invitation', 'video_ready',
                'clip_uploaded', 'clip_approved', 'clip_rejected',
                'access_request', 'access_approved', 'access_rejected', 'lobby_update')),
  message     text not null check (char_length(message) <= 500),
  metadata    jsonb not null default '{}'::jsonb,
  is_read     boolean not null default false,
  -- Game invitations expire after one hour.
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);

-- A friend request is stored as a single row: user_id = requester, friend_id = recipient.
-- Rejected requests are deleted so they leave no history.
create table if not exists public.user_friends (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  friend_id     uuid not null references public.users (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  constraint user_friends_unique_pair unique (user_id, friend_id),
  constraint user_friends_no_self check (user_id <> friend_id)
);

-- Prevent A->B and B->A rows from both existing.
create unique index if not exists user_friends_unique_unordered_pair
  on public.user_friends (least(user_id, friend_id), greatest(user_id, friend_id));

alter table public.notifications enable row level security;
alter table public.user_friends enable row level security;
