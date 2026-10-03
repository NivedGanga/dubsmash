/** Video render job lifecycle, shared by the FFmpeg worker script and the completion webhook. */
import type { GameSessionRow, VideoProcessingJobRow } from '@/types/database';
import { supabaseAdmin } from './supabase';
import { broadcastSession } from './realtime';
import { notify } from './notify';

export const MAX_RETRIES = 3;

export async function claimNextJob(): Promise<VideoProcessingJobRow | null> {
  const { data, error } = await supabaseAdmin().rpc('claim_next_video_job');
  if (error) throw error;
  const rows = (data ?? []) as VideoProcessingJobRow[];
  return rows[0] ?? null;
}

export async function getJobBySession(sessionId: string): Promise<VideoProcessingJobRow | null> {
  const { data, error } = await supabaseAdmin().from('video_processing_queue').select('*').eq('session_id', sessionId).maybeSingle();
  if (error) throw error;
  return data as VideoProcessingJobRow | null;
}

/** Mark completed, attach the MP4 to the session, notify players in-app + realtime. */
export async function completeJob(job: VideoProcessingJobRow, finalVideoUrl: string, publicId?: string): Promise<void> {
  const sb = supabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await sb
    .from('video_processing_queue')
    .update({ status: 'completed', completed_at: now, error_message: null, result: { final_video_url: finalVideoUrl, public_id: publicId } })
    .eq('id', job.id);
  if (error) throw error;

  const { data: sessionData, error: sErr } = await sb
    .from('game_sessions')
    .update({ final_video_url: finalVideoUrl, state: 'completed', completed_at: now })
    .eq('id', job.session_id)
    .select('*')
    .single();
  if (sErr) throw sErr;
  const session = sessionData as GameSessionRow;

  const { data: clip } = await sb.from('clips').select('title').eq('id', session.clip_id).maybeSingle();
  await notify(
    session.players.map((p) => ({
      userId: p.user_id,
      type: 'video_ready' as const,
      message: `Your dubbed video of "${(clip?.title as string | undefined) ?? 'your scene'}" is ready to watch and share!`,
      metadata: { session_id: session.id, clip_id: session.clip_id, final_video_url: finalVideoUrl },
    })),
  );
  await broadcastSession(session.id, { type: 'processing:update', status: 'completed', final_video_url: finalVideoUrl });
}

/** Record a failure; re-queue (pending) until MAX_RETRIES, then mark failed. */
export async function failJob(job: VideoProcessingJobRow, err: unknown): Promise<'pending' | 'failed'> {
  const retryCount = job.retry_count + 1;
  const status = retryCount < MAX_RETRIES ? 'pending' : 'failed';
  const message = (err instanceof Error ? err.message : String(err)).slice(0, 2000);
  const { error } = await supabaseAdmin()
    .from('video_processing_queue')
    .update({ status, retry_count: retryCount, error_message: message, ...(status === 'failed' ? { completed_at: new Date().toISOString() } : {}) })
    .eq('id', job.id);
  if (error) throw error;
  await broadcastSession(job.session_id, { type: 'processing:update', status });
  return status;
}

export async function markProcessingBroadcast(job: VideoProcessingJobRow): Promise<void> {
  await broadcastSession(job.session_id, { type: 'processing:update', status: 'processing' });
}
