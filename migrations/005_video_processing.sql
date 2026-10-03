-- 005: asynchronous video processing queue (consumed by scripts/process-videos.ts on GitHub Actions)

create table if not exists public.video_processing_queue (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null unique references public.game_sessions (id) on delete cascade,
  -- { clip_id, video_url, trim_start, trim_end, duration_seconds, tracks: [{ sequence_id, user_id, audio_url, start, end }] }
  recordings     jsonb not null,
  status         text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  retry_count    integer not null default 0 check (retry_count >= 0),
  error_message  text,
  -- { final_video_url, public_id }
  result         jsonb,
  created_at     timestamptz not null default now(),
  started_at     timestamptz,
  completed_at   timestamptz,
  updated_at     timestamptz not null default now()
);

drop trigger if exists video_processing_queue_set_updated_at on public.video_processing_queue;
create trigger video_processing_queue_set_updated_at before update on public.video_processing_queue
  for each row execute function public.set_updated_at();

-- Atomically claims the oldest pending job. Jobs stuck in "processing" for more than 30 minutes
-- (crashed worker) are considered abandoned and become claimable again.
create or replace function public.claim_next_video_job()
returns setof public.video_processing_queue
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.video_processing_queue q
     set status = 'processing',
         started_at = now(),
         error_message = null
   where q.id = (
     select id
       from public.video_processing_queue
      where status = 'pending'
         or (status = 'processing' and started_at < now() - interval '30 minutes')
      order by created_at
      limit 1
      for update skip locked
   )
  returning q.*;
end;
$$;

revoke all on function public.claim_next_video_job() from public, anon, authenticated;
grant execute on function public.claim_next_video_job() to service_role;

alter table public.video_processing_queue enable row level security;
