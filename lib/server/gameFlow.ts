/**
 * Game session state machine:  lobby -> recording -> playback -> completed   (any -> cancelled)
 * All mutations go through updateSession() (optimistic concurrency) and broadcast a SessionEvent.
 */
import type { ClipRow, GameSessionRow, ProcessingJobPayload, SessionPlayer, UserRow } from '@/types/database';
import { INVITATION_TTL_MS, MAX_PLAYERS } from '@/types/game';
import { assignmentComplete, autoAssignCharacters, buildSequences, nextUnrecordedIndex } from '@/lib/sequences';
import { ApiError, badRequest, conflict, forbidden } from './handler';
import { supabaseAdmin } from './supabase';
import { broadcastSession } from './realtime';
import { notify } from './notify';
import { isFeatureEnabled } from './featureFlags';
import { getClip, normaliseClip } from './clips';
import { friendshipsOf, otherSide } from './friends';
import { getSession, getSessionClip, getSessionRecordings, isHost, isPlayer, playerSnapshot, updateSession } from './sessions';

const invalidState = (msg: string) => new ApiError(409, 'invalid_state', msg);

/** Accepted friends of `userId` among `candidateIds`. */
export async function acceptedFriendIds(userId: string, candidateIds: string[]): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set();
  const friends = new Set((await friendshipsOf(userId, 'accepted')).map((r) => otherSide(r, userId)));
  return new Set(candidateIds.filter((id) => friends.has(id)));
}

async function sendInvitations(session: GameSessionRow, clipTitle: string, host: UserRow, userIds: string[]) {
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
  await notify(
    userIds.map((id) => ({
      userId: id,
      type: 'game_invitation' as const,
      message: `${host.display_name} is inviting you to play "${clipTitle}"`,
      metadata: { session_id: session.id, clip_id: session.clip_id, sender_id: host.id },
      expiresAt,
    })),
  );
}

/** Validate invitees: friend system on, accepted friends only, capacity respected. */
async function validateInvitees(host: UserRow, ids: string[], currentCount: number): Promise<string[]> {
  const unique = [...new Set(ids)].filter((id) => id !== host.id);
  if (unique.length === 0) return [];
  if (!(await isFeatureEnabled('friend_system_enabled', host.id))) throw forbidden('Invitations are currently disabled.');
  if (currentCount + unique.length > MAX_PLAYERS) throw badRequest(`A game can have at most ${MAX_PLAYERS} players.`);
  const friends = await acceptedFriendIds(host.id, unique);
  const notFriends = unique.filter((id) => !friends.has(id));
  if (notFriends.length) throw badRequest('You can only invite people on your friends list.');
  return unique;
}

export async function createSession(host: UserRow, clipId: string, invitedIds: string[]): Promise<GameSessionRow> {
  const clip = await getClip(clipId);
  if (!clip || clip.status !== 'active' || !clip.is_configured) throw badRequest('That clip is not available to play.');
  const invitees = await validateInvitees(host, invitedIds, 1);
  const players = autoAssignCharacters(clip.characters, [playerSnapshot(host)]);
  const { data, error } = await supabaseAdmin()
    .from('game_sessions')
    .insert({ clip_id: clip.id, created_by: host.id, players, invited_user_ids: invitees, state: 'lobby' })
    .select('*')
    .single();
  if (error) throw error;
  const session = data as GameSessionRow;
  if (invitees.length) await sendInvitations(session, clip.title, host, invitees);
  return session;
}

export async function inviteToSession(sessionId: string, host: UserRow, userIds: string[]): Promise<GameSessionRow> {
  const current = await getSession(sessionId);
  if (!isHost(current, host.id)) throw forbidden('Only the host can invite players.');
  if (current.state !== 'lobby') throw invalidState('The game already started.');
  const fresh = userIds.filter((id) => !current.invited_user_ids.includes(id) && !isPlayer(current, id));
  const invitees = await validateInvitees(host, fresh, current.players.length);
  const { after } = await updateSession(sessionId, (s) => {
    if (s.state !== 'lobby') throw invalidState('The game already started.');
    return { invited_user_ids: [...new Set([...s.invited_user_ids, ...invitees])] };
  });
  if (invitees.length) await sendInvitations(after, (await getSessionClipFor(sessionId)).title, host, invitees);
  return after;
}

export async function joinSession(sessionId: string, user: UserRow): Promise<GameSessionRow> {
  const clip = await getSessionClipFor(sessionId);
  const result: { joined: SessionPlayer | null } = { joined: null };
  const { after } = await updateSession(sessionId, (s) => {
    if (isPlayer(s, user.id)) return {};
    if (s.state !== 'lobby') throw invalidState('This game already started.');
    if (!s.invited_user_ids.includes(user.id)) throw forbidden('You need an invitation to join this game.');
    if (s.players.length >= MAX_PLAYERS) throw conflict('This game is full.');
    const joined = playerSnapshot(user);
    result.joined = joined;
    // Re-deal characters for the new line-up; everyone must re-confirm ready.
    const players = autoAssignCharacters(clip.characters, [...s.players, joined]).map((p) => ({ ...p, ready: false }));
    return { players };
  });
  if (result.joined) await broadcastSession(sessionId, { type: 'player:joined', player: result.joined });
  return after;
}

async function getSessionClipId(sessionId: string): Promise<string> {
  const { data, error } = await supabaseAdmin().from('game_sessions').select('clip_id').eq('id', sessionId).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError(404, 'not_found', 'Game not found.');
  return data.clip_id as string;
}

export async function setReady(sessionId: string, user: UserRow, ready: boolean): Promise<GameSessionRow> {
  const { after } = await updateSession(sessionId, (s) => {
    if (!isPlayer(s, user.id)) throw forbidden('You are not in this game.');
    if (s.state !== 'lobby') throw invalidState('The game already started.');
    return { players: s.players.map((p) => (p.user_id === user.id ? { ...p, ready } : p)) };
  });
  await broadcastSession(sessionId, { type: 'player:ready', user_id: user.id, ready });
  return after;
}

export async function assignCharacters(sessionId: string, host: UserRow, assignments: Record<string, string[]>): Promise<GameSessionRow> {
  const clip = await getSessionClipFor(sessionId);
  const { after } = await updateSession(sessionId, (s) => {
    if (!isHost(s, host.id)) throw forbidden('Only the host can assign characters.');
    if (s.state !== 'lobby') throw invalidState('The game already started.');
    const valid = new Set(clip.characters.map((c) => c.id));
    const players = s.players.map((p) => ({
      ...p,
      character_ids: (assignments[p.user_id] ?? []).filter((id) => valid.has(id)),
      ready: false,
    }));
    if (!assignmentComplete(clip.characters, players)) throw badRequest('Every character must be assigned to exactly one player.');
    return { players };
  });
  await broadcastSession(sessionId, { type: 'players:assigned' });
  return after;
}

export async function startSession(sessionId: string, host: UserRow): Promise<GameSessionRow> {
  const clip = await getSessionClipFor(sessionId);
  const { after } = await updateSession(sessionId, (s) => {
    if (!isHost(s, host.id)) throw forbidden('Only the host can start the game.');
    if (s.state !== 'lobby') throw invalidState('The game already started.');
    const notReady = s.players.filter((p) => p.user_id !== s.created_by && !p.ready);
    if (notReady.length) throw invalidState(`Waiting for ${notReady.map((p) => p.display_name).join(', ')} to be ready.`);
    if (!assignmentComplete(clip.characters, s.players)) throw invalidState('Every character needs a player.');
    return {
      state: 'recording',
      current_sequence_index: 0,
      started_at: new Date().toISOString(),
      players: s.players.map((p) => (p.user_id === s.created_by ? { ...p, ready: true } : p)),
    };
  });
  const seqs = buildSequences(clip.timeline, clip.characters, after.players);
  await broadcastSession(sessionId, { type: 'session:started', current_sequence_index: 0 });
  if (seqs[0]?.user_id) {
    await broadcastSession(sessionId, { type: 'recording:start', user_id: seqs[0].user_id, sequence_id: seqs[0].id, sequence_index: 0 });
  }
  return after;
}

/** Remove a player. Host leaving (or the last player) cancels; others' characters go to the host. */
export async function leaveSession(sessionId: string, user: UserRow): Promise<GameSessionRow> {
  const clip = await getSessionClipFor(sessionId);
  const { after } = await updateSession(sessionId, (s) => {
    if (!isPlayer(s, user.id)) return {};
    if (s.state === 'completed' || s.state === 'cancelled' || s.state === 'playback') return {};
    if (isHost(s, user.id) || s.players.length === 1) return { state: 'cancelled' };
    const leaving = s.players.find((p) => p.user_id === user.id)!;
    let players = s.players.filter((p) => p.user_id !== user.id);
    if (s.state === 'lobby') players = autoAssignCharacters(clip.characters, players).map((p) => ({ ...p, ready: false }));
    else players = players.map((p) => (p.user_id === s.created_by ? { ...p, character_ids: [...p.character_ids, ...leaving.character_ids] } : p));
    return { players, invited_user_ids: s.invited_user_ids.filter((id) => id !== user.id) };
  });
  await broadcastSession(sessionId, after.state === 'cancelled' ? { type: 'session:state', state: 'cancelled' } : { type: 'player:left', user_id: user.id });
  return after;
}

/** Player confirms the take for the current sequence -> advance to the next unrecorded sequence or finish. */
export async function submitRecording(sessionId: string, user: UserRow, sequenceId: string) {
  const [clip, recordings] = await Promise.all([getSessionClipFor(sessionId), getSessionRecordings(sessionId)]);
  const recorded = new Set(recordings.map((r) => r.sequence_id));
  const mine = recordings.find((r) => r.sequence_id === sequenceId && r.user_id === user.id);
  if (!mine) throw badRequest('Upload your recording before submitting.');

  const turn: { next: number | null } = { next: null };
  const { after } = await updateSession(sessionId, (s) => {
    if (s.state !== 'recording') throw invalidState('This game is not recording.');
    const seqs = buildSequences(clip.timeline, clip.characters, s.players);
    const current = seqs[s.current_sequence_index];
    if (!current || current.id !== sequenceId) throw invalidState("It's not this line's turn.");
    if (current.user_id !== user.id) throw forbidden('This line belongs to another player.');
    turn.next = nextUnrecordedIndex(seqs, recorded, s.current_sequence_index + 1);
    return { current_sequence_index: turn.next ?? s.current_sequence_index };
  });
  const nextIndex = turn.next;

  await broadcastSession(sessionId, {
    type: 'recording:complete',
    user_id: user.id,
    sequence_id: sequenceId,
    audio_url: mine.audio_url,
    next_sequence_index: nextIndex,
  });
  if (nextIndex === null) return { session: (await completeSession(sessionId)).session, done: true };
  const seqs = buildSequences(clip.timeline, clip.characters, after.players);
  const next = seqs[nextIndex]!;
  if (next.user_id) await broadcastSession(sessionId, { type: 'recording:start', user_id: next.user_id, sequence_id: next.id, sequence_index: nextIndex });
  return { session: after, done: false };
}

async function getSessionClipFor(sessionId: string): Promise<ClipRow> {
  const clip = await getClip(await getSessionClipId(sessionId));
  if (!clip) throw new ApiError(404, 'not_found', 'Clip not found.');
  return normaliseClip(clip);
}

/**
 * All sequences recorded -> move to playback and enqueue the FFmpeg render (non-blocking).
 * Idempotent: repeated calls return the existing job.
 */
export async function completeSession(sessionId: string): Promise<{ session: GameSessionRow; queued: boolean }> {
  const recordings = await getSessionRecordings(sessionId);
  const recorded = new Set(recordings.map((r) => r.sequence_id));
  const flag = { transitioned: false };
  const { after } = await updateSession(sessionId, (s) => {
    flag.transitioned = false;
    if (s.state === 'playback' || s.state === 'completed') return {};
    if (s.state !== 'recording') throw invalidState('Recording has not started.');
    flag.transitioned = true;
    return { state: 'playback' };
  });
  const transitioned = flag.transitioned;
  const clip = await getSessionClip(after);
  const seqs = buildSequences(clip.timeline, clip.characters, after.players);
  const missing = seqs.filter((q) => !recorded.has(q.id));
  if (transitioned && missing.length) {
    // Should not happen via submitRecording; guard against direct calls.
    await updateSession(sessionId, () => ({ state: 'recording' }));
    throw invalidState(`${missing.length} line(s) still need recording.`);
  }

  const payload: ProcessingJobPayload = {
    clip_id: clip.id,
    video_url: clip.original_video_url,
    trim_start: clip.trim_start,
    trim_end: clip.trim_end,
    duration_seconds: clip.duration_seconds,
    tracks: seqs.map((q) => {
      const r = recordings.find((x) => x.sequence_id === q.id)!;
      return { sequence_id: q.id, user_id: r.user_id, audio_url: r.audio_url, start: q.start, end: q.end };
    }),
  };
  const { error } = await supabaseAdmin()
    .from('video_processing_queue')
    .upsert({ session_id: sessionId, recordings: payload, status: 'pending' }, { onConflict: 'session_id', ignoreDuplicates: true });
  if (error) throw error;

  if (transitioned) {
    const { error: statsErr } = await supabaseAdmin().rpc('record_game_completed', { p_session_id: sessionId });
    if (statsErr) console.warn('[game] stats update failed', statsErr.message);
    await broadcastSession(sessionId, { type: 'session:state', state: 'playback' });
    await broadcastSession(sessionId, { type: 'processing:update', status: 'pending' });
  }
  return { session: after, queued: transitioned };
}
