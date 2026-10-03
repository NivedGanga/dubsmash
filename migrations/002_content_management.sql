-- 002: folders and clips

create table if not exists public.folders (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.users (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 80),
  parent_folder_id  uuid references public.folders (id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint folders_not_own_parent check (parent_folder_id is null or parent_folder_id <> id)
);

-- Sibling folder names are unique per owner (case-insensitive).
create unique index if not exists folders_unique_sibling_name
  on public.folders (owner_id, coalesce(parent_folder_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

drop trigger if exists folders_set_updated_at on public.folders;
create trigger folders_set_updated_at before update on public.folders
  for each row execute function public.set_updated_at();

create table if not exists public.clips (
  id                    uuid primary key default gen_random_uuid(),
  uploaded_by           uuid not null references public.users (id) on delete cascade,
  folder_id             uuid references public.folders (id) on delete set null,
  title                 text not null check (char_length(title) between 1 and 120),
  description           text check (char_length(description) <= 1000),
  status                text not null default 'pending' check (status in ('pending', 'active', 'rejected', 'archived')),
  difficulty            text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  cloudinary_public_id  text not null unique,
  original_video_url    text not null,
  trimmed_video_url     text,
  thumbnail_url         text,
  duration_seconds      numeric(8, 3) not null check (duration_seconds > 0),
  trim_start            numeric(8, 3) not null default 0 check (trim_start >= 0),
  trim_end              numeric(8, 3) check (trim_end is null or trim_end > trim_start),
  -- [{ "id": "A", "name": "Character A", "color": "#ef4444" }]
  characters            jsonb not null default '[]'::jsonb check (jsonb_typeof(characters) = 'array'),
  -- [{ "id": "s1", "start": 0, "end": 7, "character_id": "A", "dialogue": "..." }]
  timeline              jsonb not null default '[]'::jsonb check (jsonb_typeof(timeline) = 'array'),
  character_count       smallint not null default 0 check (character_count between 0 and 4),
  is_configured         boolean not null default false,
  times_played          integer not null default 0,
  rejection_reason      text check (char_length(rejection_reason) <= 1000),
  approved_by           uuid references public.users (id) on delete set null,
  approved_at           timestamptz,
  search_vector         tsvector generated always as (
                          setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
                          setweight(to_tsvector('simple', coalesce(description, '')), 'B')
                        ) stored,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists clips_set_updated_at on public.clips;
create trigger clips_set_updated_at before update on public.clips
  for each row execute function public.set_updated_at();

-- Keep users.clips_created in sync.
create or replace function public.bump_clips_created()
returns trigger
language plpgsql
as $$
begin
  update public.users set clips_created = clips_created + 1 where id = new.uploaded_by;
  return new;
end;
$$;

drop trigger if exists clips_bump_created on public.clips;
create trigger clips_bump_created after insert on public.clips
  for each row execute function public.bump_clips_created();

alter table public.folders enable row level security;
alter table public.clips enable row level security;
