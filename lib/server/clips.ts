import type { ClipRow, UserRow } from '@/types/database';
import { forbidden, notFound } from './handler';
import { supabaseAdmin } from './supabase';
import { trimmedVideoUrl } from './cloudinary';

export async function getClip(id: string): Promise<ClipRow | null> {
  const { data, error } = await supabaseAdmin().from('clips').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as ClipRow | null;
}

export const canManageClip = (clip: Pick<ClipRow, 'uploaded_by'>, user: Pick<UserRow, 'id' | 'role'>) =>
  user.role === 'super_admin' || clip.uploaded_by === user.id;

/** Load a clip the user may manage (owner or super admin), else 404/403. */
export async function getManagedClip(id: string, user: UserRow): Promise<ClipRow> {
  const clip = await getClip(id);
  if (!clip) throw notFound('Clip');
  if (!canManageClip(clip, user)) throw forbidden('You can only manage your own clips.');
  return clip;
}

/** Playable duration after trimming. */
export const playableDuration = (clip: Pick<ClipRow, 'duration_seconds' | 'trim_start' | 'trim_end'>) =>
  Number(clip.trim_end ?? clip.duration_seconds) - Number(clip.trim_start);

/** URL players should see: trimmed version when trimmed, otherwise the original. */
export function clipVideoUrl(clip: Pick<ClipRow, 'cloudinary_public_id' | 'trim_start' | 'trim_end' | 'trimmed_video_url' | 'original_video_url'>): string {
  if (clip.trimmed_video_url) return clip.trimmed_video_url;
  if (Number(clip.trim_start) > 0 || clip.trim_end !== null) {
    return trimmedVideoUrl(clip.cloudinary_public_id, Number(clip.trim_start), clip.trim_end === null ? null : Number(clip.trim_end));
  }
  return clip.original_video_url;
}

/** Normalise numeric columns (PostgREST returns numeric as number or string depending on config). */
export function normaliseClip<T extends Partial<ClipRow>>(clip: T): T {
  return {
    ...clip,
    ...(clip.duration_seconds !== undefined ? { duration_seconds: Number(clip.duration_seconds) } : {}),
    ...(clip.trim_start !== undefined ? { trim_start: Number(clip.trim_start) } : {}),
    ...(clip.trim_end !== undefined ? { trim_end: clip.trim_end === null ? null : Number(clip.trim_end) } : {}),
  };
}

/** Sessions that are still running for a clip (configuration must not change under them). */
export async function hasLiveSessions(clipId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin()
    .from('game_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('clip_id', clipId)
    .in('state', ['lobby', 'recording']);
  if (error) throw error;
  return (count ?? 0) > 0;
}
