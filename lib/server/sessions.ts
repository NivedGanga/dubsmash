import type { ClipRow, GameSessionRow, RecordingRow, SessionPlayer, UserRow, VideoProcessingJobRow } from '@/types/database';
import type { SessionDetails } from '@/types/api';
import { buildSequences } from '@/lib/sequences';
import { ApiError, forbidden, notFound } from './handler';
import { supabaseAdmin } from './supabase';
import { clipVideoUrl, getClip, normaliseClip } from './clips';

export async function getSession(id: string): Promise<GameSessionRow> {
  const { data, error } = await supabaseAdmin().from('game_sessions').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound('Game');
  return data as GameSessionRow;
}

export const isPlayer = (s: Pick<GameSessionRow, 'players'>, userId: string) => s.players.some((p) => p.user_id === userId);
export const isHost = (s: Pick<GameSessionRow, 'created_by'>, userId: string) => s.created_by === userId;

export function playerSnapshot(user: UserRow): SessionPlayer {
  return {
    user_id: user.id,
    username: user.username,
    display_name: user.display_name,
    avatar_model: user.avatar_model,
    avatar_color: user.avatar_color,
    avatar_outfit: user.avatar_outfit,
    character_ids: [],
    ready: false,
    joined_at: new Date().toISOString(),
  };
}

type Patch = Partial<Pick<GameSessionRow, 'players' | 'state' | 'current_sequence_index' | 'final_video_url' | 'started_at' | 'completed_at' | 'invited_user_ids'>>;

/**
 * Read-modify-write with optimistic concurrency on `version`. `mutate` receives the latest row and
 * returns the patch (or throws ApiError to abort). Retries on concurrent modification.
 */
export async function updateSession(
  id: string,
  mutate: (s: GameSessionRow) => Patch,
  maxAttempts = 6,
): Promise<{ before: GameSessionRow; after: GameSessionRow }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const before = await getSession(id);
    const patch = mutate(before);
    const { data, error } = await supabaseAdmin()
      .from('game_sessions')
      .update({ ...patch, version: before.version + 1 })
      .eq('id', id)
      .eq('version', before.version)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (data) return { before, after: data as GameSessionRow };
    await new Promise((r) => setTimeout(r, 25 * (attempt + 1) + Math.random() * 25));
  }
  throw new ApiError(409, 'busy', 'The game is busy. Please try again.');
}

export async function getSessionRecordings(sessionId: string): Promise<RecordingRow[]> {
  const { data, error } = await supabaseAdmin().from('recordings').select('*').eq('session_id', sessionId);
  if (error) throw error;
  return ((data ?? []) as RecordingRow[]).map((r) => ({ ...r, duration_seconds: Number(r.duration_seconds) }));
}

export async function getProcessingJob(sessionId: string): Promise<VideoProcessingJobRow | null> {
  const { data, error } = await supabaseAdmin().from('video_processing_queue').select('*').eq('session_id', sessionId).maybeSingle();
  if (error) throw error;
  return data as VideoProcessingJobRow | null;
}

export async function getSessionClip(session: GameSessionRow): Promise<ClipRow> {
  const clip = await getClip(session.clip_id);
  if (!clip) throw notFound('Clip');
  return normaliseClip(clip);
}

/** Full view for players (and invitees, who can see the lobby before joining). */
export async function loadSessionDetails(session: GameSessionRow, viewer: UserRow): Promise<SessionDetails> {
  const invited = session.invited_user_ids.includes(viewer.id);
  if (!isPlayer(session, viewer.id) && !invited && viewer.role !== 'super_admin') throw forbidden('You are not in this game.');
  const [clip, recordings, job] = await Promise.all([getSessionClip(session), getSessionRecordings(session.id), getProcessingJob(session.id)]);
  return {
    session,
    clip: {
      id: clip.id,
      title: clip.title,
      description: clip.description,
      characters: clip.characters,
      timeline: clip.timeline,
      duration_seconds: clip.duration_seconds,
      thumbnail_url: clip.thumbnail_url,
      trim_start: clip.trim_start,
      trim_end: clip.trim_end,
      difficulty: clip.difficulty,
      video_url: clipVideoUrl(clip),
    },
    sequences: buildSequences(clip.timeline, clip.characters, session.players),
    recordings,
    processing: { status: job?.status ?? null, final_video_url: job?.result?.final_video_url ?? session.final_video_url },
  };
}
