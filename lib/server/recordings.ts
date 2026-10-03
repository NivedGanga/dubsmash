import type { RecordingRow, UserRow } from '@/types/database';
import { buildSequences } from '@/lib/sequences';
import { ApiError, badRequest, forbidden } from './handler';
import { supabaseAdmin } from './supabase';
import { verifyAsset } from './cloudinary';
import { getSession, getSessionClip, isPlayer } from './sessions';

/**
 * Save (or replace, on re-record) the take for one sequence. The audio was uploaded directly to
 * Cloudinary; we verify the asset lives in this player's folder for this session.
 */
export async function saveRecording(user: UserRow, sessionId: string, sequenceId: string, publicId: string): Promise<RecordingRow> {
  const session = await getSession(sessionId);
  if (!isPlayer(session, user.id)) throw forbidden('You are not in this game.');
  if (session.state !== 'recording') throw new ApiError(409, 'invalid_state', 'This game is not recording.');
  const clip = await getSessionClip(session);
  const seq = buildSequences(clip.timeline, clip.characters, session.players).find((s) => s.id === sequenceId);
  if (!seq) throw badRequest('Unknown dialogue line.');
  if (seq.user_id !== user.id) throw forbidden('This line belongs to another player.');

  let asset;
  try {
    asset = await verifyAsset('recording', publicId, user.id, session.id);
  } catch (err) {
    throw badRequest(err instanceof Error ? err.message : 'Invalid recording upload.');
  }
  const lineLength = seq.end - seq.start;
  const duration = asset.duration ?? lineLength;
  if (duration <= 0) throw badRequest('The recording is empty.');
  if (duration > lineLength + 5) throw badRequest('The recording is much longer than the line. Please re-record.');

  const sb = supabaseAdmin();
  const { data: existing, error: exErr } = await sb
    .from('recordings')
    .select('*')
    .eq('session_id', session.id)
    .eq('sequence_id', sequenceId)
    .maybeSingle();
  if (exErr) throw exErr;

  const row = { audio_url: asset.secure_url, cloudinary_public_id: asset.public_id, duration_seconds: Math.round(duration * 1000) / 1000 };
  const { data, error } = existing
    ? await sb.from('recordings').update({ ...row, attempt: (existing as RecordingRow).attempt + 1 }).eq('id', existing.id).select('*').single()
    : await sb.from('recordings').insert({ ...row, session_id: session.id, user_id: user.id, sequence_id: sequenceId }).select('*').single();
  if (error) throw error;
  return data as RecordingRow;
}

export async function getRecordingForViewer(id: string, viewer: UserRow): Promise<RecordingRow> {
  const { data, error } = await supabaseAdmin().from('recordings').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, 'not_found', 'Recording not found.');
  const rec = data as RecordingRow;
  if (!isPlayer(await getSession(rec.session_id), viewer.id)) throw forbidden('You are not in this game.');
  return rec;
}
